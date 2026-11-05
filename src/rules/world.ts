// The shape of the world: where the land is, where the ocean is, and where the rivers and lakes run.
// Plain numbers, no rendering and no physics. The same seed always gives the same world.
//
// How it is made, in order:
//  1. A land shape (one big landmass with bays, capes and a few offshore islands) and a height for
//     every point: shelving seabed, a beach, plains, hills, and mountains inland.
//  2. Water flows downhill. Every land cell is traced down to the sea, and hollows that would trap
//     water are filled (priority flood), so each one becomes a lake that spills over its lowest edge.
//  3. The cells that carry the most water become rivers, carved into the ground wider and deeper
//     the more water they carry. A river's surface only ever goes down on its way to the sea.
//
//  4. A town site is chosen: flat, dry, inland, a good way from the water. The ground there is levelled, the
//     country around it is made desert, and a starting point is found out in the desert a walk away, from
//     where the town is the way ahead.
//
// generateWorld returns the hydrological routing draft with its original mountain relief retained.
// After planPlaces and planRoads, call restoreMountains once, BEFORE creating ground/render/physics:
// it restores inter-road relief while reserving road corridors, drainage and settlement pads.
//
// The world is a square grid of heights. Anything that needs the ground (the drawn terrain, walking,
// driving, the map) asks this one place, so they always agree.

import { fbm, noise } from './terrain';
import type { Box2 } from './geometry';

export interface WorldSpec {
  seed: number;
  /** Metres along each side, centred on the origin. */
  size: number;
  /** Grid cells along each side (vertices = cells + 1). */
  cells: number;
}

export const WORLD: WorldSpec = { seed: 1, size: 12000, cells: 640 };
export const SEA_LEVEL = 0;
/** Stored in the water grid where there is no water. */
export const NO_WATER = -1e9;

export const KIND = { land: 0, ocean: 1, river: 2, lake: 3 } as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

export interface WorldStats {
  landFraction: number;
  oceanFraction: number;
  /** Cells that are river, and how many rivers reach the sea. */
  riverCells: number;
  riverMouths: number;
  lakes: number;
  lakeCells: number;
  highest: number;
  deepest: number;
  /** Share of the land that is desert (aridity above DESERT). */
  desertFraction: number;
}

export interface Settlement {
  /** The town: its centre, the height of the level ground under it, and the radii of perfectly flat and of blending ground. */
  town: { x: number; z: number; height: number; flatRadius: number; blendRadius: number };
  /** Where the player starts: out in the desert, a walk from the town, facing it. yaw 0 faces +Z and positive turns toward +X. */
  spawn: { x: number; z: number; yaw: number };
}

export interface WorldMap {
  spec: WorldSpec;
  /** Vertices along each side. */
  n: number;
  /** Metres between vertices. */
  spacing: number;
  half: number;
  /** Ground height at each vertex: the bed under any water. Index = row * n + col; row is Z, col is X. */
  ground: Float32Array;
  /** Unmodified blurred mountain relief, retained for road-first terrain co-design. */
  mountainRelief: Float32Array;
  /** Flood surface and upstream-first order of the draft drainage tree. */
  drainageSurface: Float32Array;
  drainageOrder: Int32Array;
  /** Water surface height at each vertex, or NO_WATER. The ocean is at SEA_LEVEL. */
  water: Float32Array;
  kind: Uint8Array;
  /** Where water goes next from each vertex (an index), or -1 where it reaches the sea or the edge. */
  flowTo: Int32Array;
  /** How many vertices drain through each vertex, itself included. */
  accumulation: Float32Array;
  /** How dry the country is at each vertex, 0 (lush) to 1 (desert). */
  aridity: Float32Array;
  settlement: Settlement;
  stats: WorldStats;
}

function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Positive on land, negative at sea, zero on the coast. */
function landShape(seed: number, x: number, z: number, half: number): number {
  const r = Math.hypot(x / half, z / half);
  // Warp the position so the coast is ragged instead of a smooth blob.
  const wx = x + 0.06 * half * noise(seed + 11, x / (0.27 * half), z / (0.27 * half));
  const wz = z + 0.06 * half * noise(seed + 12, x / (0.27 * half) + 17, z / (0.27 * half) + 9);
  const big = fbm(seed + 1, wx / (0.23 * half), wz / (0.23 * half));
  const small = fbm(seed + 2, wx / (0.055 * half), wz / (0.055 * half));
  // Bumps that rise out of the sea away from the main land: islands.
  const isles = Math.max(0, noise(seed + 21, x / (0.08 * half) + 3, z / (0.08 * half) + 5) - 0.45) * 1.4;
  let c = 0.9 - Math.pow(r, 1.5) + 0.8 * big + 0.14 * small + isles * smoothstep(0.35, 0.7, r);
  c -= 1.4 * smoothstep(0.8, 0.95, r); // the edge of the map is always open ocean
  return c;
}

/** Ground height before any rivers are carved. Negative is under the sea. */
export function baseHeight(seed: number, x: number, z: number, half: number): number {
  const c = landShape(seed, x, z, half);
  if (c <= 0) {
    // The seabed shelves away gently from the coast and levels off in the deep.
    const d = Math.pow(-c, 1.1) * 400;
    return -300 * Math.tanh(d / 300);
  }
  const plains = c * 150;
  const hills = fbm(seed + 3, x / (0.075 * half), z / (0.075 * half)) * 70 * smoothstep(0, 0.3, c);
  // Ridged noise: sharp crest lines at three sizes, so mountains form ranges with spurs rather than cones.
  const ridge = Math.pow(1 - Math.abs(noise(seed + 9, x / (0.2 * half), z / (0.2 * half))), 1.8);
  const ridge2 = Math.pow(1 - Math.abs(noise(seed + 10, x / (0.1 * half) + 7, z / (0.1 * half) + 3)), 1.8);
  const ridge3 = Math.pow(1 - Math.abs(noise(seed + 13, x / (0.05 * half) + 2, z / (0.05 * half) + 8)), 1.8);
  const highland = smoothstep(0.5, 1.05, c + 0.4 * fbm(seed + 4, x / (0.25 * half), z / (0.25 * half)));
  const mountains = (ridge * 0.6 + ridge2 * 0.3 + ridge3 * 0.1) * 480 * highland;
  return Math.max(c * 40, plains + hills + mountains); // land never dips below the sea
}

/** Smooths a grid by averaging each point with its neighbours, a few times over. */
function blur(grid: Float32Array, n: number, passes: number) {
  const tmp = new Float32Array(grid.length);
  for (let p = 0; p < passes; p++) {
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const i = row * n + col;
        tmp[i] = (grid[row * n + Math.max(0, col - 1)] + 2 * grid[i] + grid[row * n + Math.min(n - 1, col + 1)]) / 4;
      }
    }
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        grid[row * n + col] = (tmp[Math.max(0, row - 1) * n + col] + 2 * tmp[row * n + col] + tmp[Math.min(n - 1, row + 1) * n + col]) / 4;
      }
    }
  }
}

/** A binary min-heap of (height, cell) pairs. */
class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
  }
  push(key: number, val: number) {
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.vals[i] = this.vals[p];
      i = p;
    }
    this.keys[i] = key;
    this.vals[i] = val;
  }
  /** Removes the lowest entry and returns its cell. */
  pop(): number {
    const top = this.vals[0];
    const key = this.keys[--this.size];
    const val = this.vals[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++;
      if (this.keys[c] >= key) break;
      this.keys[i] = this.keys[c];
      this.vals[i] = this.vals[c];
      i = c;
    }
    this.keys[i] = key;
    this.vals[i] = val;
    return top;
  }
}

const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DZ = [-1, -1, -1, 0, 0, 1, 1, 1];
const EPSILON = 0.002; // metres: gives flat water a tiny slope so it always drains somewhere
/** Aridity above this is desert. */
export const DESERT = 0.62;
const TOWN_FLAT = 170; // metres of perfectly level ground around the town centre
const TOWN_BLEND = 160; // metres beyond that over which the land eases back to its natural height
const SPAWN_DISTANCE = 450; // metres from the town centre to where the player starts
/** About this share of the land is river. */
const RIVER_SHARE = 0.012;
const MIN_RIVER_CATCHMENT = 40; // cells that must drain through a point before it can be a river
const MIN_LAKE_DEPTH = 3; // metres of filling before a hollow counts as a lake
const MIN_LAKE_CELLS = 60; // smaller ponds are left dry

export function generateWorld(spec: WorldSpec = WORLD): WorldMap {
  const n = spec.cells + 1;
  const count = n * n;
  const half = spec.size / 2;
  const spacing = spec.size / spec.cells;

  // 1. Heights.
  const base = new Float32Array(count);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      base[row * n + col] = baseHeight(spec.seed, -half + col * spacing, -half + row * spacing, half);
    }
  }

  // Soften the heights a little: no needle peaks, and slopes gentle enough that rivers and roads can follow them.
  blur(base, n, 2);
  const mountainRelief = base.slice();
  // A low-gradient routing draft, NOT the finished island. Once the network is fixed,
  // restore mountain relief between its reserved corridors (see restoreMountains).
  const rise = spacing * 0.06;
  for (const direction of [1, -1]) {
    for (let r = direction > 0 ? 0 : n - 1; r >= 0 && r < n; r += direction) {
      for (let c = direction > 0 ? 0 : n - 1; c >= 0 && c < n; c += direction) {
        const i = r * n + c;
        if (base[i] <= 0) continue;
        for (const [dr, dc] of [[0, -direction], [-direction, -1], [-direction, 0], [-direction, 1]]) {
          const row = r + dr, col = c + dc;
          if (row < 0 || col < 0 || row >= n || col >= n) continue;
          base[i] = Math.min(base[i], Math.max(0, base[row * n + col]) + rise * (dr && dc ? Math.SQRT2 : 1));
        }
      }
    }
  }

  // 2. Water flows downhill. Priority flood from the sea and the map edge inwards: each cell is
  // reached from its lowest way out, which becomes its flow direction, and any hollow is raised to
  // the level of its spill point.
  const filled = new Float32Array(count);
  const flowTo = new Int32Array(count).fill(-1);
  const visited = new Uint8Array(count);
  const order = new Int32Array(count);
  const heap = new MinHeap(count);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      if (base[i] <= SEA_LEVEL || row === 0 || col === 0 || row === n - 1 || col === n - 1) {
        visited[i] = 1;
        filled[i] = base[i];
        heap.push(filled[i], i);
      }
    }
  }
  let popped = 0;
  while (heap.size > 0) {
    const i = heap.pop();
    order[popped++] = i;
    const row = (i / n) | 0;
    const col = i - row * n;
    for (let d = 0; d < 8; d++) {
      const r = row + DZ[d];
      const c = col + DX[d];
      if (r < 0 || c < 0 || r >= n || c >= n) continue;
      const j = r * n + c;
      if (visited[j]) continue;
      visited[j] = 1;
      filled[j] = Math.max(base[j], filled[i] + EPSILON);
      flowTo[j] = i;
      heap.push(filled[j], j);
    }
  }

  // How much drains through each cell: add every cell to the one it flows into, uphill first.
  const accumulation = new Float32Array(count).fill(1);
  for (let k = popped - 1; k >= 0; k--) {
    const i = order[k];
    const p = flowTo[i];
    if (p >= 0) accumulation[p] += accumulation[i];
  }

  const ground = Float32Array.from(base);
  const water = new Float32Array(count).fill(NO_WATER);
  const kind = new Uint8Array(count);
  let ocean = 0;
  for (let i = 0; i < count; i++) {
    if (base[i] <= SEA_LEVEL) {
      kind[i] = KIND.ocean;
      water[i] = SEA_LEVEL;
      ocean++;
    }
  }

  // Lakes: land hollows that had to be filled. Small ponds are ignored.
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);
  const isHollow = (i: number) => kind[i] !== KIND.ocean && filled[i] - base[i] > MIN_LAKE_DEPTH;
  let lakes = 0;
  let lakeCells = 0;
  for (let start = 0; start < count; start++) {
    if (seen[start] || !isHollow(start)) continue;
    let top = 0;
    const members: number[] = [];
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const i = stack[--top];
      members.push(i);
      const row = (i / n) | 0;
      const col = i - row * n;
      for (let d = 0; d < 8; d++) {
        const r = row + DZ[d];
        const c = col + DX[d];
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const j = r * n + c;
        if (seen[j] || !isHollow(j)) continue;
        seen[j] = 1;
        stack[top++] = j;
      }
    }
    if (members.length < MIN_LAKE_CELLS) continue;
    lakes++;
    lakeCells += members.length;
    for (const i of members) {
      kind[i] = KIND.lake;
      water[i] = filled[i];
    }
  }

  // 3. Rivers: the cells that carry the most water, on land. Rivers only ever flow into the sea or a
  // lake, never uphill, because the flow comes from the filled surface.
  const landAcc: number[] = [];
  for (let i = 0; i < count; i++) if (kind[i] !== KIND.ocean) landAcc.push(accumulation[i]);
  landAcc.sort((a, b) => a - b);
  const cutoff = landAcc.length > 0 ? landAcc[Math.floor(landAcc.length * (1 - RIVER_SHARE))] : Infinity;
  const threshold = Math.max(MIN_RIVER_CATCHMENT, cutoff);
  const riverCells: number[] = [];
  for (let i = 0; i < count; i++) if (kind[i] !== KIND.ocean && accumulation[i] >= threshold) riverCells.push(i);
  riverCells.sort((a, b) => accumulation[a] - accumulation[b]); // small rivers first, so big ones carve last
  let riverMouths = 0;
  for (const i of riverCells) {
    const p = flowTo[i];
    if (p >= 0 && kind[p] === KIND.ocean) riverMouths++;
    const size = Math.log2(1 + accumulation[i] / threshold);
    const channel = 0.7 + 0.55 * size; // half width of the water, in cells
    const depth = Math.min(3, 1 + 0.9 * size); // bounded channel depth in this small island
    const surface = filled[i];
    const reach = Math.ceil(channel * 1.8);
    const row = (i / n) | 0;
    const col = i - row * n;
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const j = r * n + c;
        if (kind[j] === KIND.ocean) continue;
        const t = Math.hypot(dr, dc) / channel; // 0 at the middle, 1 at the water's edge
        if (t > 1.8) continue;
        if (t <= 0.9) {
          ground[j] = Math.min(ground[j], filled[j] - depth * (1 - t * t));
          if (kind[j] !== KIND.lake) kind[j] = KIND.river;
          // Use the drainage surface at this cell, not a neighbouring stamp's elevation.
          // Taking the lowest overlapping stamp can put an upstream cell below its outlet.
          water[j] = filled[j];
        } else {
          // The banks climb away from the water, so the valley has sides rather than a wall.
          ground[j] = Math.min(ground[j], surface + (t - 0.9) * channel * spacing * 0.6);
        }
      }
    }
  }

  // 4. The town site, then the desert around it, then the player's starting point.
  const draft = { spec, n, spacing, half, ground, water, kind, mountainRelief,
    drainageSurface: filled, drainageOrder: Int32Array.from(order).reverse() } as unknown as WorldMap;
  const site = findTownSite(draft);
  flattenDisc(ground, water, kind, n, half, spacing, site.x, site.z, site.height, TOWN_FLAT, TOWN_BLEND);
  const aridity = new Float32Array(count);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const x = -half + col * spacing;
      const z = -half + row * spacing;
      const d2 = (x - site.x) * (x - site.x) + (z - site.z) * (z - site.z);
      const dry =
        0.5 +
        0.8 * fbm(spec.seed + 31, x / (0.45 * half), z / (0.45 * half)) -
        (clamp(ground[i], 0, 500) / 500) * 0.45 + // the high country is wetter
        0.65 * Math.exp(-d2 / (2 * 1500 * 1500)); // the town sits in the middle of a desert
      aridity[i] = clamp(dry, 0, 1);
    }
  }
  draft.ground = ground;
  const town = { x: site.x, z: site.z, height: site.height, flatRadius: TOWN_FLAT, blendRadius: TOWN_BLEND };
  const spawn = findSpawn(draft, town);
  raiseDune(ground, kind, n, half, spacing, spawn, town);

  // Anything carved to or below the water it holds is wet; anything left above it is dry again.
  let riverCount = 0;
  let highest = -Infinity;
  let deepest = Infinity;
  for (let i = 0; i < count; i++) {
    if (water[i] !== NO_WATER && water[i] <= ground[i] + 0.02 && kind[i] === KIND.river) {
      water[i] = NO_WATER;
      kind[i] = KIND.land;
    }
    if (kind[i] === KIND.river) riverCount++;
    if (ground[i] > highest) highest = ground[i];
    if (ground[i] < deepest) deepest = ground[i];
  }
  let desertCells = 0;
  for (let i = 0; i < count; i++) if (kind[i] !== KIND.ocean && aridity[i] > DESERT) desertCells++;

  return {
    spec,
    n,
    spacing,
    half,
    ground,
    mountainRelief,
    drainageSurface: filled,
    drainageOrder: draft.drainageOrder,
    water,
    kind,
    flowTo,
    accumulation,
    aridity,
    settlement: { town, spawn },
    stats: {
      landFraction: 1 - ocean / count,
      oceanFraction: ocean / count,
      riverCells: riverCount,
      riverMouths,
      lakes,
      lakeCells,
      highest,
      deepest,
      desertFraction: desertCells / Math.max(1, count - ocean),
    },
  };
}

function dryLandAt(map: WorldMap, x: number, z: number, minHeight: number): boolean {
  return groundHeight(map, x, z) >= minHeight && waterLevel(map, x, z) === null;
}

/**
 * Finds the best place for the town: level ground, dry, inland and well away from any water. Scores every
 * candidate by how flat the ground is around it, and prefers the middle distance between coast and mountains.
 */
function findTownSite(map: WorldMap): { x: number; z: number; height: number } {
  let best = { x: 0, z: 0, height: 0, score: Infinity };
  const step = 4;
  for (let row = step; row < map.n - step; row += step) {
    for (let col = step; col < map.n - step; col += step) {
      const x = -map.half + col * map.spacing;
      const z = -map.half + row * map.spacing;
      const h = map.ground[row * map.n + col];
      if (h < 12 || h > 110) continue;
      const radial = Math.hypot(x, z) / map.half;
      if (radial < 0.1 || radial > 0.7) continue;
      // Dry land all round, out to 450 m: sample many directions at several distances so a river cannot slip between.
      let ok = true;
      for (let k = 0; k < 32 && ok; k++) {
        const a = (k / 32) * Math.PI * 2;
        for (const r of [100, 180, 260, 340, 450]) {
          if (!dryLandAt(map, x + Math.cos(a) * r, z + Math.sin(a) * r, 3)) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;
      let rough = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (const r of [90, 170, 260]) {
          rough = Math.max(rough, Math.abs(groundHeight(map, x + Math.cos(a) * r, z + Math.sin(a) * r) - h));
        }
      }
      const score = rough + Math.abs(radial - 0.38) * 8;
      if (score < best.score) best = { x, z, height: h, score };
    }
  }
  if (!Number.isFinite(best.score)) {
    // No ideal place on this map: take the flattest land that is not under water.
    for (let row = step; row < map.n - step; row += step) {
      for (let col = step; col < map.n - step; col += step) {
        const x = -map.half + col * map.spacing;
        const z = -map.half + row * map.spacing;
        const h = map.ground[row * map.n + col];
        if (h < 6 || map.water[row * map.n + col] !== NO_WATER) continue;
        let rough = 0;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          rough = Math.max(rough, Math.abs(groundHeight(map, x + Math.cos(a) * 200, z + Math.sin(a) * 200) - h));
        }
        if (rough < best.score) best = { x, z, height: h, score: rough };
      }
    }
  }
  return { x: best.x, z: best.z, height: best.height };
}

/** Levels the ground in a disc to one height, easing back to the natural ground over the blend distance. */
function flattenDisc(
  ground: Float32Array,
  water: Float32Array,
  kind: Uint8Array,
  n: number,
  half: number,
  spacing: number,
  cx: number,
  cz: number,
  height: number,
  flat: number,
  blend: number,
) {
  const reach = Math.ceil((flat + blend) / spacing) + 1;
  const c0 = Math.round((cx + half) / spacing);
  const r0 = Math.round((cz + half) / spacing);
  for (let row = Math.max(0, r0 - reach); row <= Math.min(n - 1, r0 + reach); row++) {
    for (let col = Math.max(0, c0 - reach); col <= Math.min(n - 1, c0 + reach); col++) {
      const d = Math.hypot(-half + col * spacing - cx, -half + row * spacing - cz);
      if (d > flat + blend) continue;
      const w = d <= flat ? 1 : 1 - smoothstep(flat, flat + blend, d);
      const i = row * n + col;
      ground[i] = ground[i] * (1 - w) + height * w;
      if (w > 0.5 && kind[i] !== KIND.land && kind[i] !== KIND.ocean) {
        water[i] = NO_WATER;
        kind[i] = KIND.land;
      }
    }
  }
}

/**
 * Finds where the player starts: out in the desert, SPAWN_DISTANCE from the town, along the driest, gentlest walk
 * towards it. Faces the town, which a dune just ahead hides (see raiseDune).
 */
function findSpawn(map: WorldMap, town: { x: number; z: number; height: number }): { x: number; z: number; yaw: number } {
  let best = { angle: 0, score: Infinity };
  for (let k = 0; k < 48; k++) {
    const angle = (k / 48) * Math.PI * 2;
    const at = (d: number) => [town.x + Math.cos(angle) * d, town.z + Math.sin(angle) * d] as const;
    let worst = 0;
    let ok = true;
    let prev = groundHeight(map, ...at(60));
    for (let d = 80; d <= SPAWN_DISTANCE + 60 && ok; d += 20) {
      const [x, z] = at(d);
      if (!dryLandAt(map, x, z, 2)) ok = false;
      const h = groundHeight(map, x, z);
      worst = Math.max(worst, Math.abs(h - prev) / 20);
      prev = h;
    }
    if (ok && worst < best.score) best = { angle, score: worst };
  }
  const x = town.x + Math.cos(best.angle) * SPAWN_DISTANCE;
  const z = town.z + Math.sin(best.angle) * SPAWN_DISTANCE;
  return { x, z, yaw: Math.atan2(town.x - x, town.z - z) };
}

/** Eye height above the ground, and how high the town's tallest roofs reach above its level ground. For sight lines. */
export const SIGHT = { eye: 1.7, townTop: 8 };

/**
 * Raises a low dune a short walk in front of the start, across the way to the town, so the town cannot be seen from
 * where the player wakes up. Walk round it or over it and the town comes into view. Only dry land is raised. The dune
 * is just tall enough to hide the roofs, with a little to spare, and never steep.
 */
function raiseDune(
  ground: Float32Array,
  kind: Uint8Array,
  n: number,
  half: number,
  spacing: number,
  spawn: { x: number; z: number },
  town: { x: number; z: number; height: number },
) {
  const map = { n, half, spacing, ground } as WorldMap;
  const dist = Math.hypot(town.x - spawn.x, town.z - spawn.z);
  const fx = (town.x - spawn.x) / dist;
  const fz = (town.z - spawn.z) / dist;
  const halfDepth = Math.max(50, 2.5 * spacing); // along the way to the town
  const halfWidth = Math.max(140, 6 * spacing); // across it
  const centre = halfDepth + 20; // the foot of the dune is about 20 m from the start
  const cx = spawn.x + fx * centre;
  const cz = spawn.z + fz * centre;
  // How high the sight line from the player's eyes to the roofs is above the ground at the dune's crest.
  const eye = groundHeight(map, spawn.x, spawn.z) + SIGHT.eye;
  const top = town.height + SIGHT.townTop;
  const line = eye + ((top - eye) * centre) / dist;
  const height = clamp(line - groundHeight(map, cx, cz) + 3, 5, 16);
  const reach = Math.ceil(Math.max(halfDepth, halfWidth) / spacing) + 1;
  const c0 = Math.round((cx + half) / spacing);
  const r0 = Math.round((cz + half) / spacing);
  for (let row = Math.max(0, r0 - reach); row <= Math.min(n - 1, r0 + reach); row++) {
    for (let col = Math.max(0, c0 - reach); col <= Math.min(n - 1, c0 + reach); col++) {
      const i = row * n + col;
      if (kind[i] !== KIND.land) continue;
      const dx = -half + col * spacing - cx;
      const dz = -half + row * spacing - cz;
      const along = (dx * fx + dz * fz) / halfDepth;
      const across = (-dx * fz + dz * fx) / halfWidth;
      const r = Math.hypot(along, across);
      if (r >= 1) continue;
      ground[i] += height * 0.5 * (1 + Math.cos(Math.PI * r)); // smooth all the way to its foot
    }
  }
}

/** How dry the country is at a world position, 0 (lush) to 1 (desert). */
export function aridityAt(map: WorldMap, x: number, z: number): number {
  const fx = clamp((x + map.half) / map.spacing, 0, map.n - 1.001);
  const fz = clamp((z + map.half) / map.spacing, 0, map.n - 1.001);
  const c = Math.floor(fx);
  const r = Math.floor(fz);
  const tx = fx - c;
  const tz = fz - r;
  const i = r * map.n + c;
  const a = map.aridity;
  const top = a[i] + (a[i + 1] - a[i]) * tx;
  const bottom = a[i + map.n] + (a[i + map.n + 1] - a[i + map.n]) * tx;
  return top + (bottom - top) * tz;
}

/** Ground height in metres at a world position, smoothly between grid points. */
export function groundHeight(map: WorldMap, x: number, z: number): number {
  const fx = clamp((x + map.half) / map.spacing, 0, map.n - 1.001);
  const fz = clamp((z + map.half) / map.spacing, 0, map.n - 1.001);
  const c = Math.floor(fx);
  const r = Math.floor(fz);
  const tx = fx - c;
  const tz = fz - r;
  const i = r * map.n + c;
  const g = map.ground;
  const top = g[i] + (g[i + 1] - g[i]) * tx;
  const bottom = g[i + map.n] + (g[i + map.n + 1] - g[i + map.n]) * tx;
  return top + (bottom - top) * tz;
}

/** Water surface height at a world position, or null if the ground there is dry. */
export function waterLevel(map: WorldMap, x: number, z: number): number | null {
  const fx = clamp((x + map.half) / map.spacing, 0, map.n - 1.001);
  const fz = clamp((z + map.half) / map.spacing, 0, map.n - 1.001);
  const i = Math.floor(fz) * map.n + Math.floor(fx);
  let level = NO_WATER;
  for (const j of [i, i + 1, i + map.n, i + map.n + 1]) level = Math.max(level, map.water[j]);
  if (level === NO_WATER) return null;
  return level > groundHeight(map, x, z) ? level : null;
}

/** Reject wet grid cells anywhere under a footprint, including cells intersecting its edges. */
export function isDryFootprint(map: WorldMap, box: Box2, setback = 0): boolean {
  const x0 = box.x - box.hx - setback, x1 = box.x + box.hx + setback;
  const z0 = box.z - box.hz - setback, z1 = box.z + box.hz + setback;
  if (x0 < -map.half || x1 > map.half || z0 < -map.half || z1 > map.half) return false;
  const c0 = Math.floor((x0 + map.half) / map.spacing), c1 = Math.ceil((x1 + map.half) / map.spacing);
  const r0 = Math.floor((z0 + map.half) / map.spacing), r1 = Math.ceil((z1 + map.half) / map.spacing);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * map.n + c;
    if (map.kind[i] !== KIND.land || map.water[i] !== NO_WATER || map.ground[i] <= SEA_LEVEL) return false;
  }
  return true;
}

/** What is at a world position: land, ocean, river or lake (the nearest grid point decides). */
export function kindAt(map: WorldMap, x: number, z: number): Kind {
  const col = clamp(Math.round((x + map.half) / map.spacing), 0, map.n - 1);
  const row = clamp(Math.round((z + map.half) / map.spacing), 0, map.n - 1);
  return map.kind[row * map.n + col] as Kind;
}
