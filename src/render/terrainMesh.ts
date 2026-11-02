import * as THREE from 'three';
import type { TerrainGrid } from '../rules/terrain';

// Visible ground built from the same grid the physics heightfield uses, so what you see is what you drive on.
export function createTerrainMesh(grid: TerrainGrid): THREE.Mesh {
  const { size, cells } = grid.spec;
  const geometry = new THREE.PlaneGeometry(size, size, cells, cells);
  geometry.rotateX(-Math.PI / 2); // lies flat, rows run along +Z and columns along +X

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x6b7a5a);
  const dirt = new THREE.Color(0x8a7d62);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = grid.heights[i];
    pos.setY(i, h);
    // Higher ground is a bit more dry and brown. Placeholder colouring only.
    tmp.copy(grass).lerp(dirt, Math.min(1, Math.max(0, (h + 2) / 8)));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
}
