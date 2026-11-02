import * as THREE from 'three';
import { CAR } from '../lab/types';

// Placeholder El Cajon: boxes only, no art. Coupe-utility shape: hood and cab at the front (+Z),
// open bed at the back (-Z). The group origin is the physics chassis centre.
export interface ElCajonModel {
  body: THREE.Group;
  wheels: THREE.Mesh[];
}

export function createElCajon(): ElCajonModel {
  const paint = new THREE.MeshStandardMaterial({ color: 0xb5532f, roughness: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.2 });

  const body = new THREE.Group();
  const add = (mat: THREE.Material, size: [number, number, number], pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    body.add(m);
    return m;
  };

  const w = CAR.halfExtents[0] * 2; // 1.9 wide
  const l = CAR.halfExtents[2] * 2; // 4.8 long

  add(paint, [w, 0.45, l], [0, -0.1, 0]); // lower body and bed floor
  add(paint, [w - 0.1, 0.25, 1.5], [0, 0.22, 1.6]); // hood
  add(paint, [w - 0.2, 0.65, 1.4], [0, 0.55, 0.15]); // cab
  add(glass, [w - 0.15, 0.4, 1.0], [0, 0.65, 0.2]); // windows
  add(trim, [w + 0.04, 0.2, 0.2], [0, -0.2, 2.45]); // front bumper
  add(trim, [w + 0.04, 0.2, 0.2], [0, -0.2, -2.45]); // rear bumper
  add(paint, [0.1, 0.4, 2.1], [-(w / 2 - 0.05), 0.3, -1.4]); // bed side, left
  add(paint, [0.1, 0.4, 2.1], [w / 2 - 0.05, 0.3, -1.4]); // bed side, right
  add(paint, [w - 0.2, 0.4, 0.1], [0, 0.3, -2.35]); // tailgate
  add(paint, [w - 0.2, 0.4, 0.1], [0, 0.3, -0.35]); // bed front wall behind the cab

  const wheelGeo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.3, 20);
  wheelGeo.rotateZ(Math.PI / 2); // axle along X
  const wheels = [0, 1, 2, 3].map(() => {
    const wheel = new THREE.Mesh(wheelGeo, trim);
    // A light bar across the tyre so you can see it spin.
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, CAR.wheelRadius * 1.6), glass);
    wheel.add(mark);
    return wheel;
  });

  return { body, wheels };
}
