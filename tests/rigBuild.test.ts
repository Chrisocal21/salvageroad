import { describe, expect, it } from 'vitest';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { createStorage, moveStack } from '../src/rules/vehicleStorage';
import { createRigBuild, distributeRigParts, fitRigPart, RIG_PARTS, rigComplete, rigParts, rigSpawns } from '../src/rules/rigBuild';
import { generateTown } from '../src/rules/town';
import { createRapierSim } from '../src/lab/rapierSim';
import { findTarget } from '../src/rules/interaction';
import { createRigRuntime } from '../src/render/rigRuntime';
import { createSalvageRig } from '../src/render/salvageRig';
import * as THREE from 'three';

describe('big rig restoration', () => {
  it('initializes concurrent vehicle worlds at independent spawn points', async () => {
    const vehicles = await Promise.all([0, 1000, 2000, 3000].map(x =>
      createRapierSim({ ground: () => 0, carSpawn: { x, z: 0, yaw: 0 } })));
    vehicles.forEach((vehicle, i) => {
      expect(vehicle.chassis().position[0]).toBeCloseTo(i * 1000);
      vehicle.step(1 / 60, { throttle: 0, steer: 0, brake: 1 });
      expect(vehicle.chassis().position[0]).toBeCloseTo(i * 1000);
    });
  });
  it('keeps the starter yard exclusive to the El Cajon', () => {
    const town = generateTown(1);
    expect(town.junkyard.wrecks.every(w => w.model !== 'big-rig')).toBe(true);
    expect(rigSpawns([town])).toEqual([]);
  });
  it('targets each remote rig by its own identity', () => {
    const rigs = [{ id: 0, x: 0, z: 0, hx: 1.55, hz: 4.35, yaw: 0 },
      { id: 1, x: 100, z: 0, hx: 1.55, hz: 4.35, yaw: Math.PI / 2 }];
    expect(findTarget({ x: 0, z: 5, yaw: Math.PI, pitch: 0 }, { containers: [], truck: null, rigs })).toEqual({ kind: 'rig', id: 0 });
    expect(findTarget({ x: 105, z: 0, yaw: -Math.PI / 2, pitch: 0 }, { containers: [], truck: null, rigs })).toEqual({ kind: 'rig', id: 1 });
  });
  it('requires a wrench and consumes real parts hauled in the El Cajon', () => {
    const pack = createInventory(), bed = createStorage(), build = createRigBuild();
    addItem(pack,'rig_engine',1);
    expect(moveStack(pack,0,bed).moved).toBe(1);
    expect(fitRigPart(build,'rig_engine',pack,bed).ok).toBe(false);
    expect(countItem(bed,'rig_engine')).toBe(1);
    addItem(pack,'wrench',1);
    expect(fitRigPart(build,'rig_engine',pack).ok).toBe(false);
    expect(fitRigPart(build,'rig_engine',pack,bed).ok).toBe(true);
    expect(countItem(bed,'rig_engine')).toBe(0);
    addItem(bed,'rig_engine',1);
    expect(fitRigPart(build,'rig_engine',pack,bed).ok).toBe(false);
    expect(countItem(bed,'rig_engine')).toBe(1);
    expect(rigComplete(build)).toBe(false);
  });
  it('requires all ten tires and all components before driving', () => {
    const pack = createInventory(), build = createRigBuild(); addItem(pack,'wrench',1);
    for (const id of rigParts) for (let i=0;i<RIG_PARTS[id];i++) {
      expect(rigComplete(build)).toBe(false);
      addItem(pack,id,1); expect(fitRigPart(build,id,pack).ok).toBe(true);
    }
    expect(rigComplete(build)).toBe(true);
  });
  it('guarantees every component across remote settlements without replacing fixed loot', () => {
    const towns = [generateTown(1), ...[2,3,4,5,6].map(i => generateTown(i,{x:i*1000,z:i%2*2000}))];
    const sources = distributeRigParts(towns);
    expect(sources).toHaveLength(15);
    expect(new Set(sources.map(s => Math.round(s.x/1000))).size).toBeGreaterThan(2);
    for (const id of rigParts) expect(sources.filter(s => s.item === id)).toHaveLength(RIG_PARTS[id]);
    expect(towns[0].containers.some(c => c.fixedLoot?.some(i=>i.id==='wrench'))).toBe(true);
  });
  it('fits the model inside the moving collision envelope', () => {
    const bounds = new THREE.Box3().setFromObject(createSalvageRig());
    expect(bounds.min.x).toBeGreaterThan(-1.56); expect(bounds.max.x).toBeLessThan(1.56);
    expect(bounds.min.z).toBeGreaterThan(-4.35); expect(bounds.max.z).toBeLessThan(4.35);
    expect(bounds.max.y).toBeLessThan(3.6);
  });
  it('stays stripped until built, then drives with six suspension wheels', async () => {
    const rig = await createRigRuntime({ground:()=>0},{x:0,z:0,yaw:0});
    const start = rig.model.position.clone();
    rig.step(1/60,{throttle:1,steer:0,brake:0});
    expect(rig.model.position.equals(start)).toBe(true);
    Object.assign(rig.build,RIG_PARTS);rig.sync();
    expect(rig.physics.wheels()).toHaveLength(6);
    for(let i=0;i<600;i++) rig.step(1/60,{throttle:i>120?1:0,steer:0,brake:i>120?0:1});
    expect(rig.model.position.z).toBeGreaterThan(8);
    expect(rig.physics.speed()).toBeGreaterThan(2);
    expect(rig.model.position.y).toBeGreaterThan(-.4);
  },20000);
  it('preserves a remote yard heading before and after restoration', async () => {
    const rig = await createRigRuntime({ ground: () => 0 }, { x: 10, z: 20, yaw: Math.PI / 2 });
    expect(rig.obb().yaw).toBeCloseTo(Math.PI / 2);
    Object.assign(rig.build, RIG_PARTS);
    rig.sync();
    for (let i = 0; i < 360; i++) rig.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: 0, brake: i > 120 ? 0 : 1 });
    expect(rig.model.position.x).toBeGreaterThan(18);
    expect(rig.model.position.z).toBeCloseTo(20, 0);
  });
});
