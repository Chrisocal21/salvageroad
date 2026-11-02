import { describe, expect, it } from 'vitest';
import { buildTerrainGrid, columnMajor, terrainHeight } from '../src/rules/terrain';
import { PROP_COLLIDER, scatterProps } from '../src/rules/scatter';
import { summarizeFrames } from '../src/rules/perfStats';

describe('terrain', () => {
  it('is the same for the same seed and different for another seed', () => {
    expect(terrainHeight(1, 130, -90)).toBe(terrainHeight(1, 130, -90));
    expect(terrainHeight(1, 130, -90)).not.toBe(terrainHeight(2, 130, -90));
  });

  it('is flat around the origin so the spawn and ramp stay level', () => {
    for (const [x, z] of [[0, 0], [20, -20], [-40, 30], [0, -55]]) {
      expect(terrainHeight(1, x, z)).toBeCloseTo(0, 6);
    }
  });

  it('has hills further out, within a sane height range', () => {
    let min = 0;
    let max = 0;
    for (let x = -190; x <= 190; x += 10) {
      for (let z = -190; z <= 190; z += 10) {
        const h = terrainHeight(1, x, z);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    expect(max - min).toBeGreaterThan(3);
    expect(Math.max(Math.abs(min), Math.abs(max))).toBeLessThan(8);
  });

  it('builds a grid whose heights match the height function', () => {
    const grid = buildTerrainGrid({ seed: 1, size: 400, cells: 200 });
    expect(grid.nrows).toBe(201);
    expect(grid.heights.length).toBe(201 * 201);
    const row = 150;
    const col = 40;
    const x = -200 + col * grid.spacing;
    const z = -200 + row * grid.spacing;
    expect(grid.heights[row * grid.ncols + col]).toBeCloseTo(terrainHeight(1, x, z), 4);
  });

  it('converts to column-major without losing anything', () => {
    const grid = buildTerrainGrid({ seed: 3, size: 100, cells: 10 });
    const cm = columnMajor(grid);
    expect(cm[4 * grid.nrows + 7]).toBe(grid.heights[7 * grid.ncols + 4]);
  });
});

describe('scatter', () => {
  it('is reproducible and keeps the start area clear', () => {
    const a = scatterProps(5, 300, 400, 45);
    const b = scatterProps(5, 300, 400, 45);
    expect(a).toEqual(b);
    expect(a).toHaveLength(300);
    for (const p of a) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(45);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(188);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(188);
      expect(PROP_COLLIDER[p.kind]).toBeDefined();
    }
  });

  it('makes a mix of kinds', () => {
    const kinds = new Set(scatterProps(5, 300, 400, 45).map((p) => p.kind));
    expect(kinds).toEqual(new Set(['tree', 'crate', 'rock']));
  });
});

describe('frame summary', () => {
  it('reports average, percentile and hitches', () => {
    const frames = Array(98).fill(10).concat([50, 100]);
    const s = summarizeFrames(frames);
    expect(s.frames).toBe(100);
    expect(s.avgMs).toBeCloseTo(11.3, 1);
    expect(s.medianMs).toBe(10);
    expect(s.worstMs).toBe(100);
    expect(s.hitches).toBe(2);
    expect(s.onePercentLowFps).toBeCloseTo(10, 0);
  });

  it('handles no frames', () => {
    expect(summarizeFrames([]).frames).toBe(0);
  });
});
