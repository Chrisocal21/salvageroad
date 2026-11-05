import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadTrailerContainer, TRAILER, trailerRoom, trailerSpawn } from '../src/rules/trailer';
import { createRigRuntime } from '../src/render/rigRuntime';
import { RIG_PARTS } from '../src/rules/rigBuild';
import { createFlatbed } from '../src/render/flatbed';
import { addPiece, cellKey, createLayout, footprint, planPlace } from '../src/rules/baseBuild';
import { loadLayout, serializeLayout } from '../src/rules/baseSave';
import { SHIPPING } from '../src/data/shippingContainers';
import type { ShippingKind } from '../src/data/shippingContainers';

describe('container flatbed', () => {
  it('carries one 20 ft or two 10 ft containers, never a 40 ft or an overload', () => {
    expect(trailerRoom([], 'ft20')).toBeNull();
    expect(trailerRoom([], 'ft10')).toBeNull();
    expect(trailerRoom(['ft10'], 'ft10')).toBeNull();
    expect(trailerRoom(['ft10'], 'ft20')).toContain('full');
    expect(trailerRoom(['ft20'], 'ft10')).toContain('full');
    expect(trailerRoom(['ft10', 'ft10'], 'ft10')).toContain('full');
    expect(trailerRoom([], 'ft40')).toContain('only');
  });
  it('keeps 10 ft containers buildable, stackable and saveable on the existing grid', () => {
    expect(SHIPPING.kinds.ft10.length).toBe(3.048);
    expect(footprint('ft10', 0)).toEqual({ w: 3, d: 2 });
    const layout = createLayout();
    const spec = { kind: 'ft10' as const, gx: 4000, gz: -4000, rot: 0 as const, level: 0, color: 2 };
    expect(addPiece(layout, spec)).not.toBeNull();
    expect(planPlace(layout, { ...spec, level: 1 }).ok).toBe(true);
    const restored = createLayout();
    expect(loadLayout(restored, serializeLayout(layout))).toBe(1);
    expect([...restored.pieces.values()][0].kind).toBe('ft10');
    expect(cellKey(0, 4000, -4000)).not.toBe(cellKey(0, 4001, -8096));
  });
  it('fails explicitly without a salvage yard', () => {
    expect(() => trailerSpawn([])).toThrow('No remote salvage yard');
  });
  it('moves real containers exactly once, preserving color and rejecting overload atomically', () => {
    const layout = createLayout(), cargo: ShippingKind[] = [], colors: number[] = [];
    const first = addPiece(layout, { kind: 'ft10', gx: 0, gz: 0, level: 0, rot: 0, color: 3 })!;
    const second = addPiece(layout, { ...first, gx: 10, color: 2 })!;
    const third = addPiece(layout, { ...first, gx: 20 })!;
    expect(loadTrailerContainer(layout, first.id, cargo, colors).ok).toBe(true);
    expect(loadTrailerContainer(layout, first.id, cargo, colors).ok).toBe(false);
    expect(loadTrailerContainer(layout, second.id, cargo, colors).ok).toBe(true);
    expect(cargo).toEqual(['ft10', 'ft10']);
    expect(colors).toEqual([3, 2]);
    expect(loadTrailerContainer(layout, third.id, cargo, colors).ok).toBe(false);
    expect(layout.pieces.has(third.id)).toBe(true);
    expect(cargo).toHaveLength(2);
  });
  it('does not pull a supporting container out from under a compound', () => {
    const layout = createLayout(), cargo: ShippingKind[] = [], colors: number[] = [];
    const bottom = addPiece(layout, { kind: 'ft20', gx: 0, gz: 0, level: 0, rot: 0, color: 0 })!;
    addPiece(layout, { ...bottom, level: 1 });
    expect(loadTrailerContainer(layout, bottom.id, cargo, colors).ok).toBe(false);
    expect(layout.pieces.has(bottom.id)).toBe(true);
    expect(cargo).toEqual([]);
  });
  it('renders the correct deck, hitch and physical cargo dimensions', () => {
    const trailer = createFlatbed({ x: 10, z: 20, yaw: Math.PI / 2 }, 0);
    expect(trailer.hitch().x).toBeCloseTo(13);
    trailer.syncCargo(['ft10', 'ft10'], [0, 1]);
    const bounds = new THREE.Box3().setFromObject(trailer.model);
    expect(bounds.max.y).toBeGreaterThan(3.9);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(3);
    trailer.syncCargo([], []);
  });
  it('physically tows a loaded articulated trailer and releases it on detachment', async () => {
    const rig = await createRigRuntime({ ground: () => 0 }, { x: 0, z: 0, yaw: 0 });
    Object.assign(rig.build, RIG_PARTS); rig.sync();
    for (let i = 0; i < 180; i++) rig.step(1 / 60, { throttle: 0, steer: 0, brake: 1 });
    const parked = createFlatbed({ x: 0, z: TRAILER.rigHitchZ - TRAILER.hitchZ, yaw: 0 }, 0);
    const obstacle = parked.obstacle(false);
    rig.physics.setVehicleObstacle!(obstacle.pose, obstacle.half, 100);
    for (let i = 0; i < 120; i++) rig.step(1 / 60, { throttle: 0, steer: 0, brake: 1 });
    expect(Math.abs(rig.model.position.z)).toBeLessThan(.5);
    expect(rig.model.position.y).toBeLessThan(.4);
    rig.physics.removeVehicleObstacle!(100);
    const chassis = rig.physics.chassis();
    rig.physics.attachTrailer!({
      position: [0, chassis.position[1] + TRAILER.rigHitchY, TRAILER.rigHitchZ - TRAILER.hitchZ],
      quaternion: [0, 0, 0, 1],
    });
    rig.physics.setTrailerCargo!([6.096]);
    const start = rig.physics.trailerPose!()!;
    for (let i = 0; i < 600; i++) rig.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: i > 360 ? .15 : 0, brake: i > 120 ? 0 : 1 });
    const end = rig.physics.trailerPose!()!;
    expect(end.position[2] - start.position[2]).toBeGreaterThan(8);
    expect(end.position[1]).toBeGreaterThan(.5);
    const rigPose = rig.physics.chassis();
    const rigHitch = new THREE.Vector3(0, TRAILER.rigHitchY, TRAILER.rigHitchZ)
      .applyQuaternion(new THREE.Quaternion(...rigPose.quaternion)).add(new THREE.Vector3(...rigPose.position));
    const pin = new THREE.Vector3(0, 0, TRAILER.hitchZ)
      .applyQuaternion(new THREE.Quaternion(...end.quaternion)).add(new THREE.Vector3(...end.position));
    expect(rigHitch.distanceTo(pin)).toBeLessThan(.25);
    rig.physics.detachTrailer!();
    expect(rig.physics.trailerPose!()).toBeNull();
  }, 20000);
});
