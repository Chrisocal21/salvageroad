import { expect, it } from 'vitest';
import * as THREE from 'three';
import { batchTownScenery } from '../src/render/town';

it('batches static geometry in world space without consuming openable loot', () => {
  const group = new THREE.Group();
  group.position.y = 40;
  const material = new THREE.MeshStandardMaterial({ color: 0xabcdef });
  for (const x of [10, 20]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), material);
    mesh.position.set(x, 2, 10);
    group.add(mesh);
  }
  const stock = new THREE.Mesh(new THREE.BoxGeometry(), material);
  stock.userData.lootDynamic = true;
  group.add(stock);
  const view = { group, markOpened: () => { stock.visible = false; }, removeTree: () => {} };
  const batched = batchTownScenery([view]);
  expect(batched.children).toHaveLength(1);
  expect(group.children).toEqual([stock]);
  const mesh = batched.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  expect(mesh.geometry.boundingBox!.min.toArray()).toEqual([9, 40, 9]);
  expect(mesh.geometry.boundingBox!.max.toArray()).toEqual([21, 44, 11]);
  view.markOpened();
  expect(stock.visible).toBe(false);
  expect(mesh.visible).toBe(true);
});
