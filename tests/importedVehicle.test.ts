import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { IMPORTED_VEHICLES, assembleImportedVehicle, type ImportedVehicleKind } from '../src/render/importedVehicle';
import { createRigRuntime } from '../src/render/rigRuntime';
import { createRigBuild, fitRigPart, partsForRig, rigComplete, rigRequirements } from '../src/rules/rigBuild';
import { addItem, countItem, createInventory } from '../src/rules/inventory';

async function load(kind: ImportedVehicleKind) {
  const bytes = Uint8Array.from(readFileSync(resolve('public', 'models', 'salvage-vehicles', IMPORTED_VEHICLES[kind].file)));
  return new GLTFLoader().parseAsync(bytes.buffer, '');
}

for (const kind of ['salvage-pickup', 'step-van'] as const) describe(kind, () => {
  it('uses the supplied GLB, converts its axes and creates four centered wheel pivots', async () => {
    const gltf = await load(kind), model = assembleImportedVehicle(gltf.scene, kind);
    for (const id of partsForRig(kind).filter(id => id !== 'tire')) {
      expect(model.getObjectByName(id)?.children.length, id).toBeGreaterThan(0);
    }
    const wheels = model.children.filter(child => child.name.startsWith('Rig tire '));
    expect(wheels).toHaveLength(4);
    wheels.forEach((wheel, index) => {
      expect(wheel.children.some(child => child instanceof THREE.Mesh && child.geometry.type === 'LatheGeometry')).toBe(true);
      expect(wheel.position.z).toBeCloseTo(index < 2 ? IMPORTED_VEHICLES[kind].front : IMPORTED_VEHICLES[kind].rear);
      const bounds = new THREE.Box3().setFromObject(wheel);
      expect(bounds.getCenter(new THREE.Vector3()).distanceTo(wheel.position)).toBeLessThan(.08);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.y).toBeCloseTo(IMPORTED_VEHICLES[kind].radius * 2, 1);
      expect(size.z).toBeCloseTo(IMPORTED_VEHICLES[kind].radius * 2, 1);
      expect(size.x).toBeLessThan(IMPORTED_VEHICLES[kind].radius);
    });
    const bounds = new THREE.Box3().setFromObject(model);
    expect(bounds.min.y).toBeGreaterThan(-.05);
    expect(bounds.max.y).toBeLessThan(IMPORTED_VEHICLES[kind].offset + IMPORTED_VEHICLES[kind].half[1] + .1);
    expect(bounds.max.x).toBeLessThan(IMPORTED_VEHICLES[kind].half[0] + .1);
    expect(bounds.min.x).toBeGreaterThan(-IMPORTED_VEHICLES[kind].half[0] - .1);
    expect(bounds.max.z).toBeLessThan(IMPORTED_VEHICLES[kind].half[2] + .1);
    expect(bounds.min.z).toBeGreaterThan(-IMPORTED_VEHICLES[kind].half[2] - .1);
  });

  it('requires its own real parts, preserves rejected repairs, and consumes each installed part', () => {
    const pack = createInventory(120), build = createRigBuild();
    addItem(pack, 'vehicle_battery', 1);
    expect(fitRigPart(build, 'vehicle_battery', pack, undefined, kind).ok).toBe(false);
    addItem(pack, 'wrench', 1);
    expect(fitRigPart(build, 'vehicle_battery', pack, undefined, kind).message).toContain('Fit these first');
    expect(countItem(pack, 'vehicle_battery')).toBe(1);
    for (const id of partsForRig(kind)) addItem(pack, id, rigRequirements(kind)[id]!);
    expect(fitRigPart(build, 'rig_engine', pack, undefined, kind).ok).toBe(false);
    for (let pass = 0; pass < 3; pass++) for (const id of partsForRig(kind)) {
      while (build[id] < rigRequirements(kind)[id]!) {
        const before = countItem(pack, id);
        const result = fitRigPart(build, id, pack, undefined, kind);
        if (!result.ok) break;
        expect(countItem(pack, id)).toBe(before - 1);
      }
    }
    expect(rigComplete(build, kind)).toBe(true);
    expect(rigComplete(createRigBuild(), kind)).toBe(false);
  });

  it('locks driving until restored, animates four suspension wheels, and provides independent storage', async () => {
    const gltf = await load(kind);
    const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    try {
      const vehicle = await createRigRuntime({ ground: () => 0 }, { x: 0, z: 0, yaw: 0, kind });
      expect(vehicle.storage?.slots).toHaveLength(IMPORTED_VEHICLES[kind].slots);
      expect(vehicle.model.getObjectByName('motor')!.visible).toBe(false);
      const start = vehicle.model.position.clone();
      vehicle.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
      expect(vehicle.model.position.equals(start)).toBe(true);
      vehicle.build.tire = 2; vehicle.sync();
      expect(vehicle.model.children.filter(child => child.name.startsWith('Rig tire ') && child.visible)).toHaveLength(2);
      Object.assign(vehicle.build, rigRequirements(kind)); vehicle.sync();
      expect(vehicle.complete()).toBe(true);
      for (let i = 0; i < 600; i++) vehicle.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: 0, brake: i > 120 ? 0 : 1 });
      expect(vehicle.physics.wheels()).toHaveLength(4);
      expect(vehicle.model.position.z).toBeGreaterThan(8);
      expect(vehicle.model.position.y).toBeGreaterThan(-.4);
      expect(vehicle.obb().hx).toBe(IMPORTED_VEHICLES[kind].half[0]);
      expect(vehicle.model.children.filter(child => child.name.startsWith('Rig tire ')).every(child =>
        child.position.toArray().every(Number.isFinite))).toBe(true);
      const speed = Math.abs(vehicle.physics.speed());
      for (let i = 0; i < 120; i++) vehicle.step(1 / 60, { throttle: -1, steer: 0, brake: 0 });
      expect(Math.abs(vehicle.physics.speed())).toBeLessThan(speed * .5);
      const heading = vehicle.obb().yaw;
      for (let i = 0; i < 120; i++) vehicle.step(1 / 60, { throttle: .5, steer: .5, brake: 0 });
      expect(Math.abs(vehicle.obb().yaw - heading), JSON.stringify(vehicle.pose())).toBeGreaterThan(.1);
      if (kind === 'step-van') {
        vehicle.setCargoOpen(true);
        expect(vehicle.model.getObjectByName('truck_box_door')!.children.every(door => door.rotation.y !== 0)).toBe(true);
        vehicle.setCargoOpen(false);
        expect(vehicle.model.getObjectByName('truck_box_door')!.children.every(door => door.rotation.y === 0)).toBe(true);
      }
    } finally { loader.mockRestore(); }
  });

});

it('keeps new vehicle repairs and stored items independent', async () => {
    const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(url =>
      load(url.includes('unfinished_pickup') ? 'salvage-pickup' : 'step-van'));
    try {
      const [pickup, van] = await Promise.all([
        createRigRuntime({ ground: () => 0 }, { x: 0, z: 0, yaw: 0, kind: 'salvage-pickup' }),
        createRigRuntime({ ground: () => 0 }, { x: 20, z: 0, yaw: 0, kind: 'step-van' }),
      ]);
      Object.assign(pickup.build, rigRequirements('salvage-pickup')); pickup.sync();
      addItem(pickup.storage!, 'wood', 3);
      expect(countItem(van.storage!, 'wood')).toBe(0);
      expect(van.complete()).toBe(false);
      expect(van.model.getObjectByName('motor')!.visible).toBe(false);
      expect(pickup.complete()).toBe(true);
    } finally { loader.mockRestore(); }
});
