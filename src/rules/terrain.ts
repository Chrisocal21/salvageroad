// Seeded terrain. Plain numbers, no rendering and no physics, so it is testable and reproducible:
// the same seed always gives the same ground, for debugging and later for friends in co-op.

export interface TerrainSpec {
  seed: number;
  size: number; // metres along each side, centred on the origin
  cells: number; // grid cells along each side (vertices = cells + 1)
}

export const TERRAIN: TerrainSpec = { seed: 1, size: 400, cells: 200 };

const FLAT_RADIUS = 60; // m around the origin that stay perfectly flat (spawn and test ramp)
const FLAT_BLEND = 50; // m over which the hills fade in
const AMPLITUDE = 7; // m, roughly the tallest hill
const WAVELENGTH = 70; // m of the largest hills

function hash(seed: number, ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // 0 to 1
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in the range -1 to 1. */
function noise(seed: number, x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(seed, ix, iz);
  const b = hash(seed, ix + 1, iz);
  const c = hash(seed, ix, iz + 1);
  const d = hash(seed, ix + 1, iz + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fz) * 2 - 1;
}

/** Four layers of noise: big hills with smaller bumps on top. Range about -1 to 1. */
function fbm(seed: number, x: number, z: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let total = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * noise(seed + o * 101, x * freq, z * freq);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/** Ground height in metres at a world position. */
export function terrainHeight(seed: number, x: number, z: number): number {
  const d = Math.hypot(x, z);
  const t = Math.min(1, Math.max(0, (d - FLAT_RADIUS) / FLAT_BLEND));
  return fbm(seed, x / WAVELENGTH, z / WAVELENGTH) * AMPLITUDE * smooth(t);
}

export interface TerrainGrid {
  spec: TerrainSpec;
  nrows: number; // vertices along Z
  ncols: number; // vertices along X
  spacing: number; // metres between vertices
  /** Row-major heights: index = row * ncols + col. Row is Z, column is X, both increasing. */
  heights: Float32Array;
}

export function buildTerrainGrid(spec: TerrainSpec = TERRAIN): TerrainGrid {
  const n = spec.cells + 1;
  const spacing = spec.size / spec.cells;
  const heights = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = -spec.size / 2 + col * spacing;
      const z = -spec.size / 2 + row * spacing;
      heights[row * n + col] = terrainHeight(spec.seed, x, z);
    }
  }
  return { spec, nrows: n, ncols: n, spacing, heights };
}

/** The same heights in column-major order, which is what Rapier's heightfield wants. */
export function columnMajor(grid: TerrainGrid): Float32Array {
  const out = new Float32Array(grid.heights.length);
  for (let row = 0; row < grid.nrows; row++) {
    for (let col = 0; col < grid.ncols; col++) {
      out[col * grid.nrows + row] = grid.heights[row * grid.ncols + col];
    }
  }
  return out;
}
