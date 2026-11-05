import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOX_TRUCK, createRigBuild, distributeRigParts, fitRigPart, partsForRig, RIG_PARTS, rigComplete, rigRequirements, rigSpawns } from '../src/rules/rigBuild';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { BOX_TRUCK_SLOTS, createBoxStorage, createStorage, moveStack } from '../src/rules/vehicleStorage';
import { generateJunkyard, generateTown } from '../src/rules/town';
import { makeRandom } from '../src/rules/scatter';
import { createRigRuntime } from '../src/render/rigRuntime';

describe('box truck restoration and storage', () => {
  it('replaces only the second tractor spawn and guarantees enough real loot for both projects', () => {
    const starter = generateTown(1);
    const remotes = [2, 3].map(seed => {
      const town = generateTown(seed, { x: seed * 1000, z: 1000 });
      town.salvage = { yard: generateJunkyard(makeRandom(seed), 0, 0, [], false), yaw: Math.PI / 2 };
      return town;
    });
    const towns = [starter, ...remotes], spawns = rigSpawns(towns);
    expect(spawns.map(s => s.kind)).toEqual(['tractor', 'box-truck']);
    const sources = distributeRigParts(towns);
    for (const id of partsForRig('box-truck')) {
      const expected = (rigRequirements('box-truck')[id] ?? 0) + (rigRequirements('tractor')[id] ?? 0);
      expect(sources.filter(s => s.item === id)).toHaveLength(expected);
      expect(towns.flatMap(t => t.containers.flatMap(c => c.fixedLoot ?? [])).filter(s => s.id === id)
        .reduce((n, s) => n + s.count, 0)).toBe(expected);
    }
  });
  it('requires 37 installed pieces with six tires and four brakes on two axles', () => {
    const build = createRigBuild();
    Object.assign(build, RIG_PARTS);
    expect(rigComplete(build)).toBe(true);
    expect(rigComplete(build, 'box-truck')).toBe(false);
    expect(Object.values(rigRequirements('box-truck')).reduce((n, count) => n + count, 0)).toBe(37);
    expect(rigRequirements('box-truck').rig_tire).toBe(6);
    expect(rigRequirements('box-truck').truck_brakes).toBe(4);
  });
  it('requires the wrench, real parts and assembly order without consuming rejected parts', () => {
    const pack = createInventory(96), cargo = createBoxStorage(), build = createRigBuild();
    addItem(cargo, 'truck_driver_door', 1);
    expect(fitRigPart(build, 'truck_driver_door', pack, cargo, 'box-truck').ok).toBe(false);
    addItem(pack, 'wrench', 1);
    expect(fitRigPart(build, 'truck_driver_door', pack, cargo, 'box-truck').message).toContain('Fit these first');
    expect(countItem(cargo, 'truck_driver_door')).toBe(1);
    expect(fitRigPart(build, 'truck_driver_door', pack, cargo).ok).toBe(false);
    for (const id of partsForRig('box-truck')) addItem(cargo, id, rigRequirements('box-truck')[id]!);
    for (let pass = 0; pass < 5; pass++) {
      for (const id of partsForRig('box-truck')) {
        while (build[id] < rigRequirements('box-truck')[id]!) {
          if (!fitRigPart(build, id, pack, cargo, 'box-truck').ok) break;
        }
      }
    }
    expect(rigComplete(build, 'box-truck')).toBe(true);
    expect(fitRigPart(build, 'truck_driver_door', pack, cargo, 'box-truck').ok).toBe(false);
  });
  it('has a separate 96-slot cargo box, without inheriting the El Cajon tire rack limits', () => {
    const box = createBoxStorage(), bed = createStorage(), pack = createInventory();
    expect(box.slots).toHaveLength(BOX_TRUCK_SLOTS);
    expect(addItem(box, 'rig_tire', 10)).toBe(0);
    expect(addItem(bed, 'rig_tire', 10)).toBe(6);
    addItem(pack, 'canned_beans', 6);
    expect(moveStack(pack, 0, box).moved).toBe(6);
    expect(countItem(pack, 'canned_beans')).toBe(0);
    expect(countItem(box, 'canned_beans')).toBe(6);
    const full = createBoxStorage();
    expect(addItem(full, 'water_bottle', BOX_TRUCK_SLOTS * 4)).toBe(0);
    addItem(pack, 'water_bottle', 1);
    expect(moveStack(pack, 0, full).reason).toBe('full');
    expect(countItem(pack, 'water_bottle')).toBe(1);
  });
  it('visibly rebuilds its body, stays immobile until complete, then drives and opens rear doors', async () => {
    const truck = await createRigRuntime({ ground: () => 0 }, { x: 0, z: 0, yaw: 0, kind: 'box-truck' });
    expect(truck.storage?.slots).toHaveLength(96);
    expect(truck.model.getObjectByName('truck_hood')!.visible).toBe(false);
    expect(truck.model.getObjectByName('Damaged truck_box_panel')!.children.every(c => c.visible)).toBe(true);
    Object.assign(truck.build, RIG_PARTS);
    truck.sync();
    const start = truck.model.position.clone();
    truck.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    expect(truck.model.position.equals(start)).toBe(true);
    truck.build.truck_box_panel = 2;
    truck.sync();
    expect(truck.model.getObjectByName('truck_box_panel')!.children.filter(c => c.visible)).toHaveLength(2);
    expect(truck.model.getObjectByName('Damaged truck_box_panel')!.children.filter(c => c.visible)).toHaveLength(2);
    Object.assign(truck.build, rigRequirements('box-truck')); truck.sync();
    const bounds = new THREE.Box3().setFromObject(truck.model);
    const cargoBounds = new THREE.Box3().setFromObject(truck.model.getObjectByName('truck_box_panel')!);
    expect(cargoBounds.max.z - cargoBounds.min.z).toBeGreaterThan((bounds.max.z - bounds.min.z) * .6);
    expect(cargoBounds.max.y).toBeGreaterThan(3.8);
    expect(bounds.max.x).toBeLessThan(truck.half[0]);
    expect(bounds.min.x).toBeGreaterThan(-truck.half[0]);
    expect(bounds.max.y).toBeLessThan(truck.half[1] + BOX_TRUCK.offset);
    expect(bounds.min.z).toBeGreaterThan(-truck.half[2]);
    expect(bounds.max.z).toBeLessThan(truck.half[2]);
    expect(truck.complete()).toBe(true);
    truck.setCargoOpen(true);
    expect(truck.model.getObjectByName('truck_box_door')!.children[0].rotation.y).not.toBe(0);
    truck.setCargoOpen(false);
    expect(truck.model.getObjectByName('truck_box_door')!.children[0].rotation.y).toBe(0);
    for (let i = 0; i < 600; i++) truck.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: 0, brake: i > 120 ? 0 : 1 });
    expect(truck.model.position.z).toBeGreaterThan(8);
    expect(truck.model.position.y).toBeGreaterThan(-.4);
    expect(truck.physics.wheels()).toHaveLength(4);
    expect(truck.model.getObjectByName('Damaged truck_box_panel')!.children.every(c => !c.visible)).toBe(true);
    const tireMeshes: THREE.Object3D[] = [];
    truck.model.traverse(o => { if (o.name.startsWith('Rig tire ')) tireMeshes.push(o); });
    expect(tireMeshes).toHaveLength(6);
    const axlePositions = new Set(tireMeshes.map(tire => Math.round(tire.position.z * 100)));
    expect(axlePositions.size).toBe(2);
  });
});
