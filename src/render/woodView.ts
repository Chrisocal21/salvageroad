import * as THREE from 'three';
import type { Layout } from '../rules/baseBuild';
import { containerShells, woodBoxes, type WoodBox, type WoodLayout, type WoodSpec } from '../rules/woodBuild';
import { worldMaterial } from './worldMaterials';

export function createWoodView() {
  const group = new THREE.Group();
  const built = new THREE.Group();
  const ghost = new THREE.Group();
  group.add(built, ghost);
  const wood = worldMaterial('wood', { color: 0x987046, roughness: .95 });
  const metal = worldMaterial('metal', { color: 0x63756a, roughness: .85, metalness: .2 });
  const preview = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: .5, depthWrite: false });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  function draw(target: THREE.Group, boxes: WoodBox[], ghosted = false) {
    target.clear();
    for (const b of boxes) {
      const mesh = new THREE.Mesh(geometry, ghosted ? preview : b.material === 'metal' ? metal : wood);
      mesh.position.set(b.x, b.y0 + b.height / 2, b.z);
      mesh.scale.set(b.hx * 2, b.height, b.hz * 2);
      mesh.castShadow = mesh.receiveShadow = !ghosted;
      mesh.userData.woodId = b.pieceId;
      target.add(mesh);
    }
  }
  return {
    group,
    sync(layout: WoodLayout, containers: Layout) {
      const modified = new Set(layout.pieces.map(p => p.containerId).filter(id => id !== undefined));
      const shells = containerShells({ ...containers, pieces: new Map([...containers.pieces].filter(([id]) => modified.has(id))) }, layout);
      draw(built, [...woodBoxes(layout), ...shells]);
    },
    setGhost(spec: WoodSpec | null, valid: boolean) {
      preview.color.setHex(valid ? 0x55ff77 : 0xff5544);
      draw(ghost, spec ? woodBoxes({ pieces: [{ ...spec, id: -1 }], nextId: 0 }) : [], true);
    },
    pick(ray: THREE.Raycaster): { id: number; point: THREE.Vector3 } | null {
      for (const hit of ray.intersectObjects(built.children, false)) {
        const id: unknown = hit.object.userData.woodId;
        if (typeof id === 'number') return { id, point: hit.point };
        return null;
      }
      return null;
    },
  };
}
