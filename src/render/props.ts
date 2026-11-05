import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import type { Prop } from '../rules/scatter';

// Placeholder props: trees, crates, rocks, scrub and cacti as simple shapes. Each kind is one instanced mesh,
// so a thousand props cost only a handful of draw calls. groundHeight says how high the ground is at a spot.
export function createProps(props: Prop[], groundHeight: (x: number, z: number) => number): THREE.Object3D[] {
  const trunks = props.filter((p) => p.kind === 'tree' && !p.cut);
  const crates = props.filter((p) => p.kind === 'crate');
  const rocks = props.filter((p) => p.kind === 'rock');
  const shrubs = props.filter((p) => p.kind === 'shrub');
  const cacti = props.filter((p) => p.kind === 'cactus');

  const make = (
    geometry: THREE.BufferGeometry,
    color: number,
    list: Prop[],
    place: (p: Prop, groundY: number, m: THREE.Matrix4) => void,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, worldMaterial(color === 0x5a4330 ? 'bark' : color === 0x9a7b4f ? 'wood' : color === 0x8d7a66 ? 'rock' : 'grass', { color, roughness: 0.9 }), Math.max(1, list.length));
    mesh.count = list.length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    list.forEach((p, i) => {
      place(p, groundHeight(p.x, p.z), m);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // props are spread over a wide area, and one box round them all would be useless
    mesh.userData.props = list;
    return mesh;
  };

  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const yaw = (p: Prop) => q.setFromAxisAngle(up, p.yaw);
  // A part sitting beside the middle of a prop, turned with it.
  const beside = (p: Prop, y: number, dx: number, dy: number, dz: number, m: THREE.Matrix4, scale: THREE.Vector3) => {
    const o = new THREE.Vector3(dx, dy, dz).multiplyScalar(p.scale).applyQuaternion(yaw(p));
    m.compose(p3.set(p.x + o.x, y + o.y, p.z + o.z), q, scale);
  };

  return [
    make(new THREE.CylinderGeometry(0.25, 0.35, 4, 8), 0x5a4330, trunks, (p, y, m) => {
      m.compose(p3.set(p.x, y + 2 * p.scale, p.z), yaw(p), s.setScalar(p.scale));
    }),
    make(new THREE.ConeGeometry(1.7, 5, 8), 0x3f5a35, trunks, (p, y, m) => {
      m.compose(p3.set(p.x, y + 5.5 * p.scale, p.z), yaw(p), s.setScalar(p.scale));
    }),
    make(new THREE.BoxGeometry(1.2, 1.2, 1.2), 0x9a7b4f, crates, (p, y, m) => {
      m.compose(p3.set(p.x, y + 0.6 * p.scale, p.z), yaw(p), s.setScalar(p.scale));
    }),
    make(new THREE.DodecahedronGeometry(1, 0), 0x8d7a66, rocks, (p, y, m) => {
      m.compose(p3.set(p.x, y + 0.5 * p.scale, p.z), yaw(p), s.set(p.scale * 1.1, p.scale * 0.7, p.scale));
    }),
    // Dry scrub: a low, flattened clump.
    make(new THREE.IcosahedronGeometry(0.7, 0), 0x8b8a52, shrubs, (p, y, m) => {
      m.compose(p3.set(p.x, y + 0.25 * p.scale, p.z), yaw(p), s.set(p.scale * 1.2, p.scale * 0.6, p.scale * 1.1));
    }),
    // Cactus: a tall trunk with two arms.
    make(new THREE.CylinderGeometry(0.26, 0.3, 2.6, 8), 0x587a49, cacti, (p, y, m) => {
      m.compose(p3.set(p.x, y + 1.3 * p.scale, p.z), yaw(p), s.setScalar(p.scale));
    }),
    make(new THREE.CylinderGeometry(0.15, 0.15, 1, 6), 0x587a49, cacti, (p, y, m) => {
      beside(p, y, 0.5, 1.5, 0, m, s.setScalar(p.scale));
    }),
    make(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6), 0x587a49, cacti, (p, y, m) => {
      beside(p, y, -0.45, 1.1, 0.05, m, s.setScalar(p.scale));
    }),
  ];
}
