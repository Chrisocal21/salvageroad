import * as THREE from 'three';
import type { Prop } from '../rules/scatter';
import { terrainHeight } from '../rules/terrain';

// Placeholder props: trees, crates and rocks as simple shapes. Each kind is one instanced mesh,
// so a few hundred props cost only a handful of draw calls.
export function createProps(props: Prop[], seed: number): THREE.Object3D[] {
  const trunks = props.filter((p) => p.kind === 'tree');
  const crates = props.filter((p) => p.kind === 'crate');
  const rocks = props.filter((p) => p.kind === 'rock');

  const make = (
    geometry: THREE.BufferGeometry,
    color: number,
    list: Prop[],
    place: (p: Prop, groundY: number, m: THREE.Matrix4) => void,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), list.length);
    const m = new THREE.Matrix4();
    list.forEach((p, i) => {
      place(p, terrainHeight(seed, p.x, p.z), m);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };

  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const yaw = (p: Prop) => q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);

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
    make(new THREE.DodecahedronGeometry(1, 0), 0x77777a, rocks, (p, y, m) => {
      m.compose(p3.set(p.x, y + 0.5 * p.scale, p.z), yaw(p), s.set(p.scale * 1.1, p.scale * 0.7, p.scale));
    }),
  ];
}
