import * as THREE from 'three';
import { CONTAINERS } from '../data/containers';
import { ROAD, type Town } from '../rules/town';

// Placeholder town: boxes only. Roads are flat dark strips, buildings are boxes with a darker roof,
// containers are small coloured boxes that darken once they have been looted.
export interface TownView {
  group: THREE.Group;
  /** Call when a container has been opened, so it looks used. */
  markOpened(id: number): void;
}

export function createTownView(town: Town): TownView {
  const group = new THREE.Group();

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 1 });
  const length = town.roadsX[town.roadsX.length - 1] - town.roadsX[0] + ROAD;
  const addRoad = (x: number, z: number, w: number, d: number) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.06, z); // just above the start-area grid lines
    group.add(road);
  };
  const midX = (town.roadsX[0] + town.roadsX[town.roadsX.length - 1]) / 2;
  const midZ = (town.roadsZ[0] + town.roadsZ[town.roadsZ.length - 1]) / 2;
  for (const rx of town.roadsX) addRoad(rx, midZ, ROAD, length);
  for (const rz of town.roadsZ) addRoad(midX, rz, length, ROAD);

  for (const b of town.buildings) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(b.hx * 2, b.height, b.hz * 2),
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.9 }),
    );
    wall.position.set(b.x, b.height / 2, b.z);
    group.add(wall);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.hx * 2 + 0.4, 0.3, b.hz * 2 + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 }),
    );
    roof.position.set(b.x, b.height + 0.15, b.z);
    group.add(roof);
  }

  const containerMeshes = new Map<number, THREE.Mesh>();
  for (const c of town.containers) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(c.hx * 2, c.height, c.hz * 2),
      new THREE.MeshStandardMaterial({ color: CONTAINERS[c.kind].color, roughness: 0.8 }),
    );
    mesh.position.set(c.x, c.height / 2, c.z);
    group.add(mesh);
    containerMeshes.set(c.id, mesh);
  }

  return {
    group,
    markOpened(id) {
      const mesh = containerMeshes.get(id);
      if (mesh) (mesh.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.45);
    },
  };
}
