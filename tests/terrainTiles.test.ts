import { expect, it } from 'vitest';
import * as THREE from 'three';
import { TerrainTiles } from '../src/render/terrainTiles';
import { generateWorld } from '../src/rules/world';
import type { Ground } from '../src/rules/ground';

it('shares exact two-metre positions, colours and normals across near/far LOD boundaries, with no skirts', () => {
  const map = generateWorld({ seed: 1, size: 12000, cells: 64 });
  const height = (x: number, z: number) => 20 + Math.sin(x / 17) * 5 + Math.cos(z / 13) * 3;
  const ground: Ground = { height, surface: height, roadDistance: () => Infinity, townHeight: 0 };
  const tiles = new TerrainTiles(map, ground);
  const build = (tiles as unknown as { build(n: { size: number; ix: number; iz: number }): { mesh: THREE.Mesh } }).build.bind(tiles);
  const coarse = build({ size: 1024, ix: 0, iz: 0 }).mesh.geometry;
  for (const size of [128, 256, 512]) {
    const fine = build({ size, ix: 1024 / size, iz: 0 }).mesh.geometry;
    const edge = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
      const out = new Map<number, number[]>();
      for (let i = 0; i < p.count; i++) if (p.getX(i) === 1024 && p.getZ(i) <= size) {
        expect(p.getY(i)).toBeCloseTo(height(p.getX(i), p.getZ(i)), 4);
        out.set(p.getZ(i), [p.getY(i), n.getX(i), n.getY(i), n.getZ(i), c.getX(i), c.getY(i), c.getZ(i)]);
      }
      return out;
    };
    const a = edge(coarse), b = edge(fine);
    expect(b.size).toBe(size / 2 + 1);
    expect(a).toEqual(b);
    fine.dispose();
  }
  coarse.dispose();
});
