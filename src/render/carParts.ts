import * as THREE from 'three';
import type { PartKind } from '../rules/carParts';
import type { ElCajonModel } from './elCajon';

// The El Cajon's loose parts: copies of the truck's own part meshes (shared geometry, so cheap), laid down on the
// ground in the junkyard, or held in front of the player. And the blocks the truck sits on where a wheel is missing.

/** How each part lies on the ground: tipped over (radians about X, then Z) so it rests the way it would be left. */
const LIE: Record<PartKind, [number, number]> = {
  engine: [0, 0],
  battery: [0, 0],
  hood: [0, 0],
  tailgate: [-Math.PI / 2, 0], // flat on its back
  front_bumper: [0, 0],
  rear_bumper: [0, 0],
  seat: [0, 0],
  wheel: [0, Math.PI / 2], // flat, like a tyre on the ground
  dash: [0, 0],
  steering_wheel: [-Math.PI / 2, 0], // flat, like a wheel laid on a bench
  windshield: [-Math.PI / 2, 0], // flat on its back
  driver_door: [0, Math.PI / 2], // flat, outside up
  passenger_door: [0, -Math.PI / 2],
  grille: [-Math.PI / 2, 0],
  headlights: [0, 0],
};

/** A copy of a part, centred over its own footprint with its lowest point at y = 0, lying as it would on the ground. */
export function createPartModel(car: ElCajonModel, kind: PartKind): THREE.Group {
  const source = kind === 'wheel' ? car.wheels[0] : car.parts[kind];
  const copy = source.clone();
  copy.position.set(0, 0, 0);
  copy.quaternion.identity();
  copy.visible = true;
  const tilt = new THREE.Group();
  tilt.rotation.set(LIE[kind][0], 0, LIE[kind][1]);
  tilt.add(copy);
  tilt.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tilt);
  const centre = box.getCenter(new THREE.Vector3());
  tilt.position.set(-centre.x, -box.min.y, -centre.z);
  const holder = new THREE.Group();
  holder.name = `loose ${kind}`;
  holder.add(tilt);
  holder.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return holder;
}

/** The size of a part model: its widest extent, in metres. */
export function partSize(model: THREE.Object3D): number {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}

/** A big rig tyre lying flat on the ground, about a metre across. Stands from y = 0. */
export function createRigTire(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'big rig tire';
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.6 });
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.16, 14, 32).rotateX(Math.PI / 2), rubber);
  tyre.position.y = 0.16;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), steel);
  hub.position.y = 0.2;
  g.add(tyre, hub);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Two cinder blocks stacked crosswise, as a truck is left on when its wheel is taken. Stands from y = 0. */
export function createBlocks(): THREE.Group {
  const blocks = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 1 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), concrete);
  lower.position.y = 0.1;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.4), concrete);
  upper.position.y = 0.3;
  blocks.add(lower, upper);
  blocks.traverse((o) => (o.castShadow = true));
  return blocks;
}
