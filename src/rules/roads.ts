// The roads between the places: highways, paved roads, dirt roads, trails, and the bridges they cross water on.
// Plain numbers, no rendering: the same seed always gives the same network, and everything that needs it
// (the drawn roads, the map, driving) reads it from here.
//
// How it is made, in order:
//  1. One continuous main road visits the city, towns, villages, industrial yard and docks, without extra
//     highway loops. Outposts and lookouts have access roads that stop at their first junction.
//  2. The route of each link: A* over the world's height grid. Climbing costs, steep ground costs much more,
//     and crossing water costs a lot, so a road detours round a river until the detour is longer than a
//     bridge. The sea is impassable, and land next to it is discouraged so the smoothed line cannot clip a
//     coast. Each class has its own appetite for slope and for bridges.
//  3. The route is smoothed (corner cutting), given a height profile that follows the land within limited
//     earthworks and a limited grade, and the wet spans become bridges: grade-limited decks above the water,
//     the road ramping to them within the grade limit. Infeasible formations are rejected.

import { KIND, NO_WATER, groundHeight, kindAt, waterLevel, type WorldMap } from './world';
import type { Dock, Place, PlaceKind, Plan } from './places';
import { LOT, YARD, settlementGrid } from './town';
import { createGround } from './ground';
import { expandNeighborhoods, type Neighborhood } from './neighborhoods';

export type RoadClass = 'highway' | 'road' | 'dirt' | 'trail';

export interface ClassSpec {
  /** Metres of drivable surface. */
  width: number;
  /** Steepest rise over run the finished road is allowed. */
  maxGrade: number;
  /** How hard the router avoids steep ground: at maxGrade the road costs (1 + slopeWeight) times its length. */
  slopeWeight: number;
  /** Extra cost per metre of water crossed. Roughly how many metres of detour beat one metre of bridge. */
  waterPerMetre: number;
}

// One road look for everything: the same width, so roads meet in ordinary intersections. The grade limits and
// routing costs still differ by class, because a lookout trail has to climb where a highway never would.
const WIDTH = 10;
export const ROAD_SPEC: Record<RoadClass, ClassSpec> = {
  highway: { width: WIDTH, maxGrade: 0.06, slopeWeight: 9, waterPerMetre: 70 },
  road: { width: WIDTH, maxGrade: 0.08, slopeWeight: 6, waterPerMetre: 45 },
  dirt: { width: WIDTH, maxGrade: 0.12, slopeWeight: 3.5, waterPerMetre: 25 },
  trail: { width: WIDTH, maxGrade: 0.22, slopeWeight: 1.5, waterPerMetre: 12 },
};

export interface RoadPoint {
  x: number;
  z: number;
  /** Road surface height: the land cut and filled within the grade limit, or the deck height on a bridge. */
  y: number;
  /** True on a bridge deck. */
  bridge: boolean;
}

export interface Road {
  /** Local district streets belong to one place, not to the inter-place loop/access graph. */
  local?: boolean;
  id: number;
  class: RoadClass;
  /** Ids of the places this road joins (indexes into plan.places). */
  from: number;
  to: number;
  /** Places visited in order by the continuous main road, including its ends. */
  via?: number[];
  points: RoadPoint[];
  /** Metres along the road. */
  length: number;
  /** Metres of bridge deck. */
  bridgeLength: number;
}

export interface RoadNetwork {
  neighborhoods?: Neighborhood[];
  roads: Road[];
  /** Ids of the places that ended up connected to the starting town. */
  connected: number[];
}

/** Metres between finished road points. */
const STEP = 9;
/** Bridge decks stand this far above the water. */
const CLEARANCE = 2;
/** Hard cut/fill limit over the entire ten-metre formation, including approaches and joins. */
export const MAX_ROAD_EARTHWORK = 6;
const EARTHWORK = MAX_ROAD_EARTHWORK;
/** A* gives up after this many cell expansions, so a hopeless link fails fast instead of slowly. */
const MAX_EXPANSIONS = 500000;
/** The heuristic is stretched by this much: a little greedier than perfect, much faster, still near shortest. */
const HEURISTIC_WEIGHT = 1.25;

const SQRT2 = Math.SQRT2;
const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DZ = [-1, -1, -1, 0, 0, 1, 1, 1];

interface Pt {
  x: number;
  z: number;
}

function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

// ---------------------------------------------------------------------------------------------------------------------
// Routing one link

/**
 * Routes roads over the world grid. The scratch arrays are made once and reused across every route of a plan;
 * stamp/run marks which cells the current run has touched, so nothing needs re-zeroing.
 */
function createRouter(map: WorldMap) {
  const n = map.n;
  const count = n * n;
  const g = new Float64Array(count);
  const from = new Int32Array(count);
  const stamp = new Int32Array(count);
  let run = 0;

  // Land within a couple of cells of water (the sea, a lake, a river): allowed, but costs extra, so the road keeps
  // a little way off the bank and its bends round a bay or a river's end stay wide, and a smoothed curve cannot
  // clip the beach.
  const isWet = (i: number) => map.kind[i] === KIND.ocean || (map.water[i] !== NO_WATER && map.water[i] > map.ground[i]);
  const coast = new Uint8Array(count);
  for (let row = 1; row < n - 1; row++) {
    for (let col = 1; col < n - 1; col++) {
      const i = row * n + col;
      if (isWet(i)) continue;
      for (let d = 0; d < 8; d++) {
        if (isWet((row + DZ[d]) * n + col + DX[d])) {
          coast[i] = 1;
          break;
        }
      }
    }
  }
  // Widen the band by one more cell.
  const wide = Uint8Array.from(coast);
  for (let row = 1; row < n - 1; row++) {
    for (let col = 1; col < n - 1; col++) {
      const i = row * n + col;
      if (coast[i] || isWet(i)) continue;
      for (let d = 0; d < 8; d++) {
        if (coast[(row + DZ[d]) * n + col + DX[d]]) {
          wide[i] = 1;
          break;
        }
      }
    }
  }
  coast.set(wide);

  const occupied = new Uint8Array(count);
  let avoidOccupied = false;
  const cellOf = (x: number, z: number): number => {
    const col = clamp(Math.round((x + map.half) / map.spacing), 0, n - 1);
    const row = clamp(Math.round((z + map.half) / map.spacing), 0, n - 1);
    return row * n + col;
  };

  // The heap holds (priority, cell) encoded as one integer-safe number: priority quantised to 1/1024.
  const heap: number[] = [];
  const push = (key: number) => {
    let i = heap.length;
    heap.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p] <= key) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = key;
  };
  const pop = (): number => {
    const top = heap[0];
    const key = heap.pop()!;
    if (heap.length > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && heap[c + 1] < heap[c]) c++;
        if (heap[c] >= key) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = key;
    }
    return top;
  };

  /** What a straight run from a to b would cost under the router's own rules, or Infinity across the sea. */
  const runCost = (spec: ClassSpec, a: Pt, b: Pt): number => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) return 0;
    const k = Math.max(1, Math.ceil(len / (map.spacing * 0.5)));
    const d = len / k;
    let cost = 0;
    let prev = groundHeight(map, a.x, a.z);
    for (let s = 1; s <= k; s++) {
      const x = a.x + ((b.x - a.x) * s) / k;
      const z = a.z + ((b.z - a.z) * s) / k;
      if (avoidOccupied && occupied[cellOf(x, z)]) return Infinity;
      if (kindAt(map, x, z) === KIND.ocean) return Infinity;
      const h = groundHeight(map, x, z);
      const grade = Math.abs(h - prev) / d;
      if (waterLevel(map, x, z) === null && grade > spec.maxGrade * 0.9) return Infinity;
      cost += d * (1 + spec.slopeWeight * (grade / spec.maxGrade) ** 2);
      if (waterLevel(map, x, z) !== null) cost += spec.waterPerMetre * d;
      if (coast[cellOf(x, z)]) cost += d * 0.6;
      prev = h;
    }
    return cost;
  };

  /**
   * Straightens a grid path: from each waypoint, jumps to the furthest later waypoint that a straight run reaches
   * for no more than the grid path's own cost. Open country becomes long straight runs at any angle instead of
   * grid steps; round a river, a ridge or a bay the waypoints stay, because the straight run would cost more.
   */
  const simplify = (spec: ClassSpec, path: Pt[]): Pt[] => {
    if (path.length < 3) return path;
    const prefix = [0];
    for (let i = 1; i < path.length; i++) prefix.push(prefix[i - 1] + runCost(spec, path[i - 1], path[i]));
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let best = i + 1;
      let fails = 0;
      for (let j = i + 2; j < path.length && j <= i + 80; j++) {
        const cost = runCost(spec, path[i], path[j]);
        if (Number.isFinite(cost) && cost <= (prefix[j] - prefix[i]) * 1.15 + 2 * map.spacing) {
          best = j;
          fails = 0;
        } else if (++fails > 8) break;
      }
      out.push(path[best]);
      i = best;
    }
    return out;
  };

  /** The grid path from a to b as world positions, or null when no dry route exists. */
  function route(spec: ClassSpec, a: Pt, b: Pt, avoid = false, exclusions: { x: number; z: number; radius: number }[] = []): Pt[] | null {
    avoidOccupied = avoid;
    const start = cellOf(a.x, a.z);
    const goal = cellOf(b.x, b.z);
    if (start === goal) return [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
    run++;
    heap.length = 0;
    const goalRow = (goal / n) | 0;
    const goalCol = goal - goalRow * n;
    // Octile distance: the cheapest a route can ever cost is its length, so this never overestimates by much.
    const heuristic = (i: number): number => {
      const row = (i / n) | 0;
      const col = i - row * n;
      const dr = Math.abs(row - goalRow);
      const dc = Math.abs(col - goalCol);
      return map.spacing * (Math.max(dr, dc) + (SQRT2 - 1) * Math.min(dr, dc)) * HEURISTIC_WEIGHT;
    };
    const encode = (f: number, i: number) => Math.round(f * 1024) * count + i;
    g[start] = 0;
    stamp[start] = run;
    from[start] = -1;
    push(encode(heuristic(start), start));
    let expansions = 0;
    while (heap.length > 0) {
      const i = pop() % count;
      if (i === goal) break;
      if (++expansions > MAX_EXPANSIONS) return null;
      const row = (i / n) | 0;
      const col = i - row * n;
      const gi = g[i];
      const hi = map.ground[i];
      for (let d = 0; d < 8; d++) {
        const r = row + DZ[d];
        const c = col + DX[d];
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const j = r * n + c;
        if (map.kind[j] === KIND.ocean) continue;
        if (avoidOccupied && occupied[j]) continue;
        const x = -map.half + c * map.spacing;
        const z = -map.half + r * map.spacing;
        if (exclusions.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius)) continue;
        const dist = map.spacing * (DX[d] !== 0 && DZ[d] !== 0 ? SQRT2 : 1);
        const grade = Math.abs(map.ground[j] - hi) / dist;
        if (!isWet(i) && !isWet(j) && grade > spec.maxGrade * 0.9) continue;
        let cost = dist * (1 + spec.slopeWeight * (grade / spec.maxGrade) ** 2);
        if (map.water[j] !== NO_WATER && map.water[j] > map.ground[j]) cost += spec.waterPerMetre * dist;
        if (coast[j]) cost += dist * 0.6;
        const gj = gi + cost;
        if (stamp[j] === run && g[j] <= gj) continue;
        stamp[j] = run;
        g[j] = gj;
        from[j] = i;
        push(encode(gj + heuristic(j), j));
      }
    }
    if (stamp[goal] !== run) return null;
    const path: { x: number; z: number }[] = [];
    for (let i = goal; i >= 0; i = from[i]) {
      const row = (i / n) | 0;
      const col = i - row * n;
      path.push({ x: -map.half + col * map.spacing, z: -map.half + row * map.spacing });
    }
    path.reverse();
    path[0] = { x: a.x, z: a.z };
    path[path.length - 1] = { x: b.x, z: b.z };
    return path;
  }
  const reserve = (line: Pt[]) => {
    for (const p of resample(line, STEP)) {
      const col = Math.round((p.x + map.half) / map.spacing);
      const row = Math.round((p.z + map.half) / map.spacing);
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const r = row + dz;
          const c = col + dx;
          if (r >= 0 && c >= 0 && r < n && c < n) occupied[r * n + c] = 1;
        }
      }
    }
  };
  return { route, simplify, reserve };
}

// ---------------------------------------------------------------------------------------------------------------------
// From grid path to finished road

/** Emits points every step metres along the path, keeping the exact ends. */
function resample(pts: { x: number; z: number }[], step: number): { x: number; z: number }[] {
  const out = [pts[0]];
  let next = step;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    while (next <= seg) {
      const t = next / seg;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      next += step;
    }
    next -= seg;
  }
  const end = pts[pts.length - 1];
  const last = out[out.length - 1];
  if (Math.hypot(last.x - end.x, last.z - end.z) > 1e-6) out.push({ x: end.x, z: end.z });
  return out;
}

/** Shortest run between two waypoints worth keeping; a shorter one is a grid wiggle, not a turn. */
const MIN_RUN = 55;

/**
 * Drops waypoints that sit closer than MIN_RUN to a neighbour, as long as the straight run that replaces them
 * stays out of the sea and crosses no more water than the two runs it replaces. A bank-side zigzag of grid
 * steps becomes one clean run, so the bends that remain are real turns far enough apart to be rounded wide.
 * The first and last waypoints always stay.
 */
function declutter(map: WorldMap, pts: Pt[]): Pt[] {
  const out = pts.slice();
  const terrainCost = (a: Pt, b: Pt): number => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(length / 5));
    const run = length / steps;
    if (run < 1e-6) return 0;
    let previous = groundHeight(map, a.x, a.z);
    let cost = length;
    for (let i = 1; i <= steps; i++) {
      const height = groundHeight(map, a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps);
      cost += (height - previous) ** 2 / run;
      previous = height;
    }
    return cost;
  };
  /** Samples along a run: how many are wet, or -1 when any is in the sea. */
  const wetOn = (a: Pt, b: Pt): number => {
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 5));
    let wet = 0;
    for (let s = 0; s <= k; s++) {
      const x = a.x + ((b.x - a.x) * s) / k;
      const z = a.z + ((b.z - a.z) * s) / k;
      if (kindAt(map, x, z) === KIND.ocean) return -1;
      if (waterLevel(map, x, z) !== null) wet++;
    }
    return wet;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1];
      const b = out[i];
      const c = out[i + 1];
      if (Math.hypot(b.x - a.x, b.z - a.z) >= MIN_RUN && Math.hypot(c.x - b.x, c.z - b.z) >= MIN_RUN) continue;
      const direct = wetOn(a, c);
      if (direct < 0 || direct > wetOn(a, b) + wetOn(b, c) + 3) continue;
      // Removing grid wiggles must not also remove the switchbacks that made a climb feasible.
      if (terrainCost(a, c) > terrainCost(a, b) + terrainCost(b, c) + 0.01) continue;
      out.splice(i, 1);
      changed = true;
      i--;
    }
  }
  return out;
}

/** Smallest bend radius in metres the rounding aims for, per class. A bend gets less where the land or a short run forbids. */
const BEND_RADIUS: Record<RoadClass, number> = { highway: 70, road: 70, dirt: 70, trail: 70 };
/** Points of a rounded corner are this far apart, metres. */
const ARC_STEP = 3;

/**
 * Rounds each corner of a polyline with a curve that is tangent to both runs (a quadratic Bezier whose control
 * point is the corner), so the road is long straight runs at any angle joined by smooth bends. The bend takes
 * as much of the corner as the radius asks for, never more than half of either run, and shrinks if the curve
 * would enter the sea or touch water the straight corner does not. The ends and the leads stay straight.
 */
function fillet(map: WorldMap, line: Pt[], radius: number, keepTownStreets = false, settlements: Place[] = []): Pt[] {
  if (line.length < 3) return line;
  const wetAt = (p: Pt) => waterLevel(map, p.x, p.z) !== null;
  const out: Pt[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1];
    const b = line[i];
    const c = line[i + 1];
    const town = map.settlement.town;
    if (keepTownStreets && ([{ ...town, kind: 'town', urban: false }, ...settlements]).some(p => Math.abs(b.x - p.x) <= settlementGrid(p.kind, p.urban) * LOT / 2 + radius && Math.abs(b.z - p.z) <= settlementGrid(p.kind, p.urban) * LOT / 2 + radius)) {
      out.push(b);
      continue;
    }
    const lenIn = Math.hypot(b.x - a.x, b.z - a.z);
    const lenOut = Math.hypot(c.x - b.x, c.z - b.z);
    if (lenIn < 1e-6 || lenOut < 1e-6) continue;
    const ux = (b.x - a.x) / lenIn;
    const uz = (b.z - a.z) / lenIn;
    const vx = (c.x - b.x) / lenOut;
    const vz = (c.z - b.z) / lenOut;
    const turn = Math.acos(clamp(ux * vx + uz * vz, -1, 1));
    if (turn < 0.03) {
      out.push(b);
      continue;
    }
    let t = Math.min(radius * Math.tan(Math.min(turn, 3) / 2), 0.5 * Math.min(lenIn, lenOut));
    let done = false;
    for (let tries = 0; tries < 5 && !done; tries++, t /= 2) {
      if (t < 2) break;
      const p0 = { x: b.x - ux * t, z: b.z - uz * t };
      const p2 = { x: b.x + vx * t, z: b.z + vz * t };
      const n = Math.max(2, Math.ceil((2 * t) / ARC_STEP));
      const arc: Pt[] = [];
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        const w0 = (1 - s) * (1 - s);
        const w1 = 2 * s * (1 - s);
        const w2 = s * s;
        arc.push({ x: w0 * p0.x + w1 * b.x + w2 * p2.x, z: w0 * p0.z + w1 * b.z + w2 * p2.z });
      }
      if (arc.some((q) => kindAt(map, q.x, q.z) === KIND.ocean)) continue;
      // A wide bend can cut deep into a hillside even when both original runs follow its contour.
      if (arc.some((q, k) => {
        const s = k / n;
        const straight = s < 0.5
          ? { x: p0.x + (b.x - p0.x) * s * 2, z: p0.z + (b.z - p0.z) * s * 2 }
          : { x: b.x + (p2.x - b.x) * (s - 0.5) * 2, z: b.z + (p2.z - b.z) * (s - 0.5) * 2 };
        return Math.abs(groundHeight(map, q.x, q.z) - groundHeight(map, straight.x, straight.z)) > 2;
      })) continue;
      let straightWet = 0;
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        const q = s < 0.5 ? { x: p0.x + (b.x - p0.x) * s * 2, z: p0.z + (b.z - p0.z) * s * 2 } : { x: b.x + (p2.x - b.x) * (s - 0.5) * 2, z: b.z + (p2.z - b.z) * (s - 0.5) * 2 };
        if (wetAt(q)) straightWet++;
      }
      if (arc.filter(wetAt).length > straightWet) continue;
      out.push(...arc);
      done = true;
    }
    if (!done) out.push(b);
  }
  out.push(line[line.length - 1]);
  return out;
}

/**
 * Turns a raw grid path into the finished road: a smoothed line of evenly spaced points, each with the road's
 * surface height. Wet spans become bridge decks; everywhere else the surface follows the land, kept within
 * a hard EARTHWORK formation bound and within the class's grade limit. Empty feasible height intervals
 * reject the alignment rather than letting an averaged profile slice through a mountain.
 *
 * The grade limit comes from a Lipschitz envelope: U is the highest grade-limited profile at or under the
 * target heights, L the lowest at or over them, and their average is grade-limited too. The decks are pinned
 * as anchors in the envelopes, so the road ramps to them within the limit; the decks themselves are first made
 * mutually feasible (one deck never asks another to be reached too steeply) by raising the lower of any pair
 * that is too close in height for the distance between them.
 */
function finishRoad(map: WorldMap, spec: ClassSpec, cls: RoadClass, line: Pt[], rounded = false, endHeight?: number, settlements: Place[] = [], startHeight?: number): RoadPoint[] | null {
  // `line` is gate, stub, a straightened route, stub, gate: long straight runs. Each corner is rounded into a
  // bend (see fillet), then the road is cut into evenly spaced points. The straight leads at the ends keep the
  // road square to the street it meets.
  const pts = resample(rounded ? line : fillet(map, line, BEND_RADIUS[cls]), STEP);
  // Rounding can still clip a headland between two samples: move any such point to the nearest dry ground.
  for (const p of pts) {
    if (kindAt(map, p.x, p.z) !== KIND.ocean) continue;
    search: for (let r = 4; r <= 48; r += 4) {
      for (let k = 0; k < 12; k++) {
        const x = p.x + Math.cos((k / 12) * Math.PI * 2) * r;
        const z = p.z + Math.sin((k / 12) * Math.PI * 2) * r;
        if (kindAt(map, x, z) !== KIND.ocean) {
          p.x = x;
          p.z = z;
          break search;
        }
      }
    }
  }
  const m = pts.length;
  const ground = new Float64Array(m);
  const wet: (number | null)[] = new Array(m);
  for (let i = 0; i < m; i++) {
    ground[i] = groundHeight(map, pts[i].x, pts[i].z);
    wet[i] = waterLevel(map, pts[i].x, pts[i].z);
  }
  const step = new Float64Array(m);
  for (let k = 1; k < m; k++) step[k] = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
  const along = new Float64Array(m);
  for (let k = 1; k < m; k++) along[k] = along[k - 1] + step[k];

  // Wet spans, merging ones separated by a point or two (an islet in the river is still one bridge). Every
  // point of a span rides at deck height; the deck flag marks the span, bridge (exported) the wet points.
  const deck = new Array<boolean>(m).fill(false);
  const bridgeDeck = new Array<boolean>(m).fill(false);
  const y = new Float64Array(m);
  const spans: [number, number][] = [];
  let i = 0;
  while (i < m) {
    if (wet[i] === null) {
      i++;
      continue;
    }
    let end = i;
    for (;;) {
      let look = end + 1;
      while (look < m && look <= end + 2 && wet[look] === null) look++;
      if (look < m && wet[look] !== null && look - end <= 3) {
        end = look;
      } else break;
    }
    // Abutments land beyond the wet centreline: the full formation must clear the bank too.
    i = Math.max(0, i - 2);
    end = Math.min(m - 1, end + 2);
    for (let k = i; k <= end; k++) {
      deck[k] = true;
      bridgeDeck[k] = true;
      y[k] = wet[k] === null ? ground[k] : wet[k]! + CLEARANCE;
      // Real bridges may climb: a long crossing need not stand above the highest bank everywhere.
      spans.push([k, k]);
    }
    i = end + 1;
  }
  // Existing streets cannot be excavated by the road profile: buildings and the junkyard use town.height.
  const town = map.settlement.town;
  const anchors: { first: number; last: number; height: number }[] = [];
  for (const site of [town, ...settlements]) {
    const span = settlementGrid('kind' in site ? site.kind as string : 'town', 'urban' in site && site.urban === true) * LOT;
    for (let k = 0; k < m; k++) {
      const inside = (j: number) => Math.abs(pts[j].x - site.x) <= span / 2 + 0.01 && Math.abs(pts[j].z - site.z) <= span / 2 + 0.01;
      if (!inside(k)) continue;
      const first = k;
      while (k + 1 < m && inside(k + 1)) k++;
      anchors.push({ first, last: k, height: site.height });
      for (let j = first; j <= k; j++) { deck[j] = true; y[j] = site.height; }
    }
  }
  if (endHeight !== undefined) anchors.push({ first: m - 1, last: m - 1, height: endHeight });
  if (startHeight !== undefined) anchors.push({ first: 0, last: 0, height: startHeight });
  for (const [first, last] of spans) {
    let cap = Infinity;
    for (const anchor of anchors) {
      const distance = Math.max(0, along[anchor.first] - along[last], along[first] - along[anchor.last]);
      cap = Math.min(cap, anchor.height + spec.maxGrade * distance);
    }
    if (y[first] <= cap) continue;
    for (let k = first; k <= last; k++) {
      if (wet[k] !== null && wet[k]! + CLEARANCE > cap + 1e-6) return null;
      y[k] = cap;
    }
  }
  for (const anchor of anchors) {
    spans.push([anchor.first, anchor.last]);
    for (let k = anchor.first; k <= anchor.last; k++) { deck[k] = true; y[k] = anchor.height; }
  }
  spans.sort((a, b) => a[0] - b[0]);
  // Make the decks mutually feasible within the grade: never mind the approaches yet, two decks too different
  // in height for the distance between them can never be joined. Raising the lower one (a viaduct) fixes it.
  for (let s = 1; s < spans.length; s++) {
    let d = 0;
    for (let k = spans[s - 1][1]; k < spans[s][0]; k++) d += step[k + 1];
    const need = y[spans[s - 1][0]] - spec.maxGrade * d;
    if (y[spans[s][0]] < need) for (let k = spans[s][0]; k <= spans[s][1]; k++) y[k] = need;
  }
  for (let s = spans.length - 2; s >= 0; s--) {
    let d = 0;
    for (let k = spans[s][1]; k < spans[s + 1][0]; k++) d += step[k + 1];
    const need = y[spans[s + 1][0]] - spec.maxGrade * d;
    if (y[spans[s][0]] < need) for (let k = spans[s][0]; k <= spans[s][1]; k++) y[k] = need;
  }
  for (const anchor of anchors) {
    for (let k = anchor.first; k <= anchor.last; k++) if (Math.abs(y[k] - anchor.height) > 1e-6) return null;
  }

  // Dry points: the land, smoothed over a few neighbours (dry ones only, so a riverbed does not drag an
  // approach down), then kept within EARTHWORK of the natural ground.
  for (let k = 0; k < m; k++) {
    if (deck[k]) continue;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, k - 2); j <= Math.min(m - 1, k + 2); j++) {
      if (deck[j]) continue;
      sum += ground[j];
      count++;
    }
    y[k] = clamp(count > 0 ? sum / count : ground[k], ground[k] - EARTHWORK, ground[k] + EARTHWORK);
  }

  // The envelopes, with the decks pinned: they are sources of the cones but never moved by them.
  const upper = Float64Array.from(y);
  const lower = Float64Array.from(y);
  for (let k = 1; k < m; k++) if (!deck[k]) upper[k] = Math.min(upper[k], upper[k - 1] + spec.maxGrade * step[k]);
  for (let k = m - 2; k >= 0; k--) if (!deck[k]) upper[k] = Math.min(upper[k], upper[k + 1] + spec.maxGrade * step[k + 1]);
  for (let k = 1; k < m; k++) if (!deck[k]) lower[k] = Math.max(lower[k], lower[k - 1] - spec.maxGrade * step[k]);
  for (let k = m - 2; k >= 0; k--) if (!deck[k]) lower[k] = Math.max(lower[k], lower[k + 1] - spec.maxGrade * step[k + 1]);

  // Intersect formation cut/fill intervals with deck/street anchors, then propagate the grade cones.
  // These are hard constraints, not smoothing preferences.
  const lo = new Float64Array(m);
  const hi = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    lo[k] = -Infinity;
    hi[k] = Infinity;
    if (!bridgeDeck[k]) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(m - 1, k + 1)];
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      for (const offset of [-spec.width / 2, 0, spec.width / 2]) {
        const h = groundHeight(map, pts[k].x - (b.z - a.z) / length * offset, pts[k].z + (b.x - a.x) / length * offset);
        lo[k] = Math.max(lo[k], h - EARTHWORK);
        hi[k] = Math.min(hi[k], h + EARTHWORK);
      }
    }
    if (deck[k]) {
      lo[k] = Math.max(lo[k], y[k]);
      hi[k] = Math.min(hi[k], y[k]);
    }
  }
  for (let k = 1; k < m; k++) {
    lo[k] = Math.max(lo[k], lo[k - 1] - spec.maxGrade * step[k]);
    hi[k] = Math.min(hi[k], hi[k - 1] + spec.maxGrade * step[k]);
  }
  for (let k = m - 2; k >= 0; k--) {
    lo[k] = Math.max(lo[k], lo[k + 1] - spec.maxGrade * step[k + 1]);
    hi[k] = Math.min(hi[k], hi[k + 1] + spec.maxGrade * step[k + 1]);
  }
  if (lo.some((value, k) => value > hi[k] + 1e-6)) return null;

  const points: RoadPoint[] = new Array(m);
  for (let k = 0; k < m; k++) {
    const averaged = (upper[k] + lower[k]) / 2;
    points[k] = {
      x: pts[k].x,
      z: pts[k].z,
      y: deck[k] ? y[k] : clamp(averaged, lo[k], hi[k]),
      bridge: bridgeDeck[k],
    };
  }
  // Validate the built formation, not only the centreline targets used by the optimiser.
  // A candidate with an infeasible bank, rounded corner or join is rejected, never silently excavated.
  for (let k = 1; k < m; k++) {
    const a = points[k - 1], b = points[k];
    if (a.bridge && b.bridge) continue;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const samples = Math.max(1, Math.ceil(length));
    for (let j = 0; j <= samples; j++) {
      const t = j / samples;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const y = a.y + (b.y - a.y) * t;
      for (const offset of [-spec.width / 2, 0, spec.width / 2]) {
        const natural = groundHeight(map, x - (b.z - a.z) / length * offset, z + (b.x - a.x) / length * offset);
        if (Math.abs(natural - y) > EARTHWORK + 1e-6) return null;
      }
    }
  }
  return points;
}

// ---------------------------------------------------------------------------------------------------------------------
// Gates: where a road meets a place

/** A way into a place: the point on its edge, and the unit direction pointing out of the place. */
export interface Gate {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

/** How far out from a gate the road runs dead straight, so it arrives square on instead of at a slant. */
const LEAD = 70;

/**
 * The gates of a place. The starting town's are the ends of its real streets (a road comes in along a street
 * and meets the boundary street in a T), leaving out the north side where the junkyard stands. Any other place
 * uses the same lot grid at its own scale, without the junkyard exclusion. Non-residential places get eight
 * gates on a ring inside their edge (docks only on the land side).
 */
export function gatesOf(map: WorldMap, place: Place): Gate[] {
  const town = map.settlement.town;
  if (['city', 'town', 'village'].includes(place.kind)) {
    const start = Math.hypot(place.x - town.x, place.z - town.z) < 1;
    const grid = settlementGrid(place.kind, place.urban);
    const span = grid * LOT;
    const x0 = place.x - span / 2;
    const z0 = place.z - span / 2;
    const gates: Gate[] = [];
    for (let i = 0; i <= grid; i++) {
      const x = x0 + i * LOT;
      const z = z0 + i * LOT;
      gates.push({ x, z: z0 + span, dx: 0, dz: 1 });
      if (!start || Math.abs(x - town.x) > YARD.hx + 4) gates.push({ x, z: z0, dx: 0, dz: -1 });
      gates.push({ x: x0 + span, z, dx: 1, dz: 0 });
      gates.push({ x: x0, z, dx: -1, dz: 0 });
    }
    return gates;
  }
  const gates: Gate[] = [];
  const dock = place.kind === 'dock' ? (place as Dock) : null;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    if (dock && dx * dock.seaward.x + dz * dock.seaward.z > 0.2) continue;
    const r = place.radius * 0.6;
    gates.push({ x: place.x + dx * r, z: place.z + dz * r, dx, dz });
  }
  return gates;
}

/** The point this far along a path from its start (the end, if the path is shorter). */
function pointAlong(path: Pt[], d: number): Pt {
  let left = d;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    if (left <= seg) {
      const t = seg > 0 ? left / seg : 0;
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, z: path[i - 1].z + (path[i].z - path[i - 1].z) * t };
    }
    left -= seg;
  }
  return path[path.length - 1];
}

/**
 * The gate of a place a road should use, given a rough route that leaves the place's centre: the gate whose
 * stub is nearest to where that route is a little way out, so the road does not leave one side and double back.
 */
function pickGate(map: WorldMap, place: Place, rough: Pt[]): Gate {
  const want = pointAlong(rough, place.radius * 0.6 + LEAD + 120);
  let best: Gate | null = null;
  let bestD = Infinity;
  for (const g of gatesOf(map, place)) {
    const d = Math.hypot(want.x - (g.x + g.dx * LEAD), want.z - (g.z + g.dz * LEAD));
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best!;
}

// ---------------------------------------------------------------------------------------------------------------------
// The network

const MAIN_PLACES: PlaceKind[] = ['city', 'town', 'village', 'industrial', 'dock'];

/** How close to an existing road a new one must come to count as joining it, metres. */
const JOIN = 16;

/**
 * An access road stops at its first meeting with the network. Never retain a second tail or let it follow,
 * leave and rejoin the main road: that was drawing the braided parallel roads.
 */
function trimToNetwork(points: RoadPoint[], roads: Road[]): RoadPoint[] {
  const hash = new Map<number, RoadPoint[]>();
  const key = (x: number, z: number) => Math.floor(x / 40) * 100003 + Math.floor(z / 40);
  for (const r of roads) for (const p of r.points) {
    const k = key(p.x, p.z);
    (hash.get(k) ?? hash.set(k, []).get(k)!).push(p);
  }
  const nearest = (p: Pt): RoadPoint | null => {
    let best: RoadPoint | null = null;
    let bestD = JOIN;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const q of hash.get(key(p.x + dx * 40, p.z + dz * 40)) ?? []) {
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < bestD) { bestD = d; best = q; }
      }
    }
    return best;
  };
  const near = (p: Pt) => nearest(p) !== null;
  /** Ends the piece squarely on the other road: drops the last couple of points and lands on its centreline. */
  const landEnd = (piece: RoadPoint[]): RoadPoint[] => {
    const t = nearest(piece[piece.length - 1]);
    if (!t) return piece;
    const out = piece.slice(0, Math.max(1, piece.length - 3)).map((q) => ({ ...q }));
    out.push({ ...t });
    return out;
  };
  const n = points.length;
  for (let i = 1; i < n; i++) {
    if (near(points[i])) return landEnd(points.slice(0, i + 1));
  }
  return points;
}

export function planRoads(map: WorldMap, plan: Plan): RoadNetwork {
  const { route, simplify, reserve } = createRouter(map);
  const roads: Road[] = [];
  const byId = plan.places;
  const dist = (a: Place, b: Place) => Math.hypot(a.x - b.x, a.z - b.z);
  const start = byId[0];
  if (!start) return { roads, connected: [] };
  const connected = new Set<number>();
  const store = (cls: RoadClass, a: Place, b: Place, points: RoadPoint[], via?: number[]) => {
    let length = 0;
    let bridgeLength = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      length += d;
      if (points[i].bridge || points[i - 1].bridge) bridgeLength += d;
    }
    roads.push({ id: roads.length, class: cls, from: a.id, to: b.id, via, points, length, bridgeLength });
  };

  // An open itinerary, not a branching tree or loop. Section reversals remove crossed links and detours.
  const order = [start];
  const remaining = byId.filter((p) => p.id !== start.id && MAIN_PLACES.includes(p.kind));
  while (remaining.length > 0) {
    let best = Infinity;
    let place = 0;
    let at = 0;
    for (let p = 0; p < remaining.length; p++) {
      for (let i = 0; i <= order.length; i++) {
        const before = order[i - 1];
        const after = order[i];
        const cost = (before ? dist(before, remaining[p]) : 0) + (after ? dist(remaining[p], after) : 0) - (before && after ? dist(before, after) : 0);
        if (cost < best) { best = cost; place = p; at = i; }
      }
    }
    order.splice(at, 0, remaining.splice(place, 1)[0]);
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const before = order[i - 1];
        const after = order[j + 1];
        const old = (before ? dist(before, order[i]) : 0) + (after ? dist(order[j], after) : 0);
        const next = (before ? dist(before, order[j]) : 0) + (after ? dist(order[i], after) : 0);
        if (next >= old - 0.01) continue;
        order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
        improved = true;
      }
    }
  }

  const line: Pt[] = [];
  let entry: Gate | null = null;
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1];
    const b = order[i];
    const spec = ROAD_SPEC.road;
    const rough = route(spec, a, b);
    if (!rough) throw new Error(`Cannot route the main road between ${a.name} and ${b.name}`);
    // Leave through the opposite side to the arrival, rather than doubling back out the same gate.
    const previousEntry: Gate | null = entry;
    let ga: Gate = previousEntry
      ? gatesOf(map, a).reduce((best, g) => {
        const score = (q: Gate) => q.dx * previousEntry.dx + q.dz * previousEntry.dz + Math.hypot(q.x - previousEntry.x, q.z - previousEntry.z) * 0.0001;
        return score(g) < score(best) ? g : best;
      })
      : pickGate(map, a, rough);
    let gb = pickGate(map, b, rough.slice().reverse());
    const approach = (g: Gate, h: Gate) => route(spec,
      { x: g.x + g.dx * LEAD, z: g.z + g.dz * LEAD },
      { x: h.x + h.dx * LEAD, z: h.z + h.dz * LEAD }, true, [
        { x: a.x, z: a.z, radius: Math.hypot(g.x - a.x, g.z - a.z) + 10 },
        { x: b.x, z: b.z, radius: Math.hypot(h.x - b.x, h.z - b.z) + 10 },
      ]);
    let raw = approach(ga, gb);
    if (!raw) {
      // The geometrically nearest gate may face a riverbank or a reserved approach.
      // Try real alternative entrances; never relax the grade or overlap constraints.
      const gatesA = gatesOf(map, a).filter(g => !previousEntry || g.dx * previousEntry.dx + g.dz * previousEntry.dz < 0.1);
      alternatives: for (const g of [ga, ...gatesA]) for (const h of [gb, ...gatesOf(map, b)]) {
        raw = approach(g, h);
        if (raw) { ga = g; gb = h; break alternatives; }
      }
    }
    if (!raw) throw new Error(`Cannot route the main road approaches between ${a.name} and ${b.name}`);
    const section = [
      { x: ga.x, z: ga.z },
      ...declutter(map, simplify(spec, raw)),
      { x: gb.x, z: gb.z },
    ];
    if (line.length > 0 && ['city', 'town', 'village'].includes(a.kind)) {
      const last = line[line.length - 1];
      // These coordinates are street centrelines, so the right-angle link stays out of occupied lots.
      line.push({ x: last.x, z: ga.z });
    }
    line.push(...section);
    reserve(fillet(map, section, BEND_RADIUS.road));
    entry = gb;
  }
  if (line.length > 1) {
    const settlements = plan.places.filter(p => ['city', 'town', 'village'].includes(p.kind) && p.id !== start.id);
    const rounded = fillet(map, line, BEND_RADIUS.road, true, settlements);
    // Fit new settlement pads to the feasible road elevation, not the untouched terrain below a viaduct/ramp.
    // Sunrise retains its original fixed elevation and junkyard entrance.
    const profile = finishRoad(map, ROAD_SPEC.road, 'road', rounded, true);
    if (profile) for (const site of settlements) {
      const nearest = profile.reduce((a, b) => Math.hypot(a.x - site.x, a.z - site.z) < Math.hypot(b.x - site.x, b.z - site.z) ? a : b);
      site.height = nearest.y;
    }
    const points = finishRoad(map, ROAD_SPEC.road, 'road', rounded, true, undefined, settlements);
    if (!points) throw new Error(`The main road cannot meet the existing town streets within its grade limit (seed ${map.spec.seed})`);
    store('road', order[0], order[order.length - 1], points, order.map((p) => p.id));
  }
  for (const p of order) connected.add(p.id);

  const addAccess = (cls: RoadClass, a: Place) => {
    const bridgePoints = roads.flatMap(r => r.points.filter(p => p.bridge));
    const clearOfBridges = (p: Pt) => !bridgePoints.some(q => Math.hypot(p.x - q.x, p.z - q.z) < 30);
    const pads = byId.filter(p => ['city', 'town', 'village'].includes(p.kind)).map(p => ({
      x: p.x, z: p.z, radius: settlementGrid(p.kind, p.urban) * LOT / Math.SQRT2 + 40,
    }));
    const clearOfPads = (p: Pt) => pads.every(q => Math.hypot(p.x - q.x, p.z - q.z) > q.radius);
    const candidates = roads.flatMap((road) => {
      const landings = road.points.filter(p => clearOfBridges(p) && clearOfPads(p));
      if (!landings.length) return [];
      const closest = landings.reduce((best, p) => Math.hypot(p.x - a.x, p.z - a.z) < Math.hypot(best.x - a.x, best.z - a.z) ? p : best);
      return [closest, ...landings.filter((_, i) => i % 12 === 0)].map((point) => ({ road, point, distance: Math.hypot(point.x - a.x, point.z - a.z) }));
    }).sort((p, q) => p.distance - q.distance).slice(0, 64);
    let best: { points: RoadPoint[]; road: Road; earthwork: number; score: number } | null = null;
    let fittedCount = 0;
    for (const { road, point } of candidates) {
      const rough = route(ROAD_SPEC[cls], a, point);
      if (!rough) continue;
      const ga = pickGate(map, a, rough);
      const stub = { x: ga.x + ga.dx * LEAD, z: ga.z + ga.dz * LEAD };
      const raw = route(ROAD_SPEC[cls], stub, point, false, pads);
      if (!raw) continue;
      const points = finishRoad(map, ROAD_SPEC[cls], cls, [{ x: ga.x, z: ga.z }, ...declutter(map, simplify(ROAD_SPEC[cls], raw))]);
      if (!points) continue;
      const branch = trimToNetwork(points, roads);
      // An at-grade junction cannot be laid into the side of a bridge deck.
      if (branch.some(p => !clearOfBridges(p))) continue;
      const end = branch[branch.length - 1];
      const fitted = finishRoad(map, ROAD_SPEC[cls], cls, branch, true, end.y);
      if (!fitted) continue;
      const earthwork = fitted.reduce((max, p) => p.bridge ? max : Math.max(max, Math.abs(p.y - groundHeight(map, p.x, p.z))), 0);
      let overlap = 0;
      for (const p of fitted.slice(-12)) for (const existing of roads) {
        for (let i = 1; i < existing.points.length; i++) {
          const a = existing.points[i - 1], b = existing.points[i];
          const dx = b.x - a.x, dz = b.z - a.z;
          const lengthSquared = dx * dx + dz * dz;
          if (lengthSquared < 1e-6) continue;
          const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSquared, 0, 1);
          const distance = Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
          if (distance < WIDTH) overlap = Math.max(overlap, Math.abs(p.y - a.y - t * (b.y - a.y)) * (1 - distance / WIDTH));
        }
      }
      // Avoid trading a shallower cutting for a steep crossfall where the two road ribbons overlap.
      const score = earthwork + overlap * 30;
      if (!best || score < best.score) best = { points: fitted, road, earthwork, score };
      // Nearest in plan view is often an impossible short descent from a lookout.
      // Compare a bounded number of actual fitted approaches, not only horizontal distances.
      if (++fittedCount >= 8 || best.earthwork <= EARTHWORK) break;
    }
    if (best) {
      store(cls, a, byId[best.road.from], best.points);
      connected.add(a.id);
      return;
    }
    throw new Error(`Cannot connect the access road for ${a.name}`);
  };

  // Access roads join only places already connected to the main road.
  const join = (kind: PlaceKind, cls: RoadClass) => {
    for (const p of byId.filter((q) => q.kind === kind)) {
      addAccess(cls, p);
    }
  };
  join('outpost', 'dirt');
  join('lookout', 'trail');

  // Junction-to-junction chords, including dry shore promenades. Each new ribbon must
  // occupy new ground rather than run alongside an existing road.
  const pads = byId.filter(p => ['city', 'town', 'village'].includes(p.kind)).map(p => ({
    x: p.x, z: p.z, radius: settlementGrid(p.kind, p.urban) * LOT / Math.SQRT2 + 40,
  }));
  const distanceToRoad = (p: Pt) => {
    let nearest = Infinity;
    for (const road of roads) for (let i = 0; i < road.points.length; i += 4) {
      const q = road.points[i];
      nearest = Math.min(nearest, Math.hypot(p.x - q.x, p.z - q.z));
    }
    return nearest;
  };
  const anchors: { point: Pt; shore: boolean }[] = [];
  for (let row = 8; row < map.n - 8; row += 8) for (let col = 8; col < map.n - 8; col += 8) {
    const x = -map.half + col * map.spacing, z = -map.half + row * map.spacing;
    if (waterLevel(map, x, z) !== null || groundHeight(map, x, z) < 3) continue;
    if (pads.some(p => Math.hypot(x - p.x, z - p.z) < p.radius + 100)) continue;
    let shore = false;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      if (waterLevel(map, x + Math.cos(a) * 130, z + Math.sin(a) * 130) !== null) shore = true;
    }
    anchors.push({ point: { x, z }, shore });
  }
  anchors.sort((a, b) => Number(b.shore) - Number(a.shore));
  const used: Pt[] = [];
  let routingAttempts = 0;
  for (const { point: middle, shore } of anchors) {
    if (routingAttempts >= 120) break;
    if (roads.length >= 30) break;
    if (used.some(p => Math.hypot(p.x - middle.x, p.z - middle.z) < 650)) continue;
    const clearance = distanceToRoad(middle);
    if (clearance < 180 || clearance > (shore ? 1700 : 850)) continue;
    const junctions = roads.flatMap(r => r.points.filter((p, i) => i % 30 === 0 && !p.bridge &&
      pads.every(q => Math.hypot(p.x - q.x, p.z - q.z) > q.radius))
      .map(p => ({ p, r, d: Math.hypot(p.x - middle.x, p.z - middle.z) })))
      .sort((a, b) => a.d - b.d).slice(0, 20);
    let added = false;
    let localAttempts = 0;
    for (const a of junctions.slice(0, 4)) {
      for (const b of junctions) {
        if (routingAttempts >= 120 || localAttempts >= 2) break;
        if (Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z) < 700) continue;
        const ax = a.p.x - middle.x, az = a.p.z - middle.z;
        const bx = b.p.x - middle.x, bz = b.p.z - middle.z;
        if ((ax * bx + az * bz) / (a.d * b.d) > 0.3) continue;
        routingAttempts++;
        localAttempts++;
        const first = route(ROAD_SPEC.road, a.p, middle, false, pads);
        const second = route(ROAD_SPEC.road, middle, b.p, false, pads);
        if (!first || !second) continue;
        const points = finishRoad(map, ROAD_SPEC.road, 'road',
          [...simplify(ROAD_SPEC.road, first), ...simplify(ROAD_SPEC.road, second).slice(1)],
          false, b.p.y, [], a.p.y);
        if (!points || points.some(p => p.bridge)) continue;
        const safeShoulders = points.every((b, i) => {
          if (!i) return true;
          const a = points[i - 1];
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          if (!length) return true;
          const samples = Math.ceil(length);
          for (let j = 0; j <= samples; j++) {
            const t = j / samples;
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const y = a.y + (b.y - a.y) * t;
            for (const offset of [-23, -14, 14, 23]) {
              if (Math.abs(groundHeight(map, x - (b.z - a.z) / length * offset,
                z + (b.x - a.x) / length * offset) - y) > EARTHWORK) return false;
            }
          }
          return true;
        });
        if (!safeShoulders) continue;
        const selfCells = new Map<string, number[]>();
        const selfClear = points.every((p, i) => {
          const cx = Math.floor(p.x / 50), cz = Math.floor(p.z / 50);
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            for (const j of selfCells.get(`${cx + dx}:${cz + dz}`) ?? []) {
              if (i - j > 20 && Math.hypot(p.x - points[j].x, p.z - points[j].z) < 50) return false;
            }
          }
          const key = `${cx}:${cz}`, bucket = selfCells.get(key);
          if (bucket) bucket.push(i);
          else selfCells.set(key, [i]);
          return true;
        });
        if (!selfClear) continue;
        const junctionCells = new Map<string, RoadPoint[]>();
        for (const r of roads) for (let i = 0; i < r.points.length; i += 2) {
          const q = r.points[i], key = `${Math.floor(q.x / 35)}:${Math.floor(q.z / 35)}`;
          const bucket = junctionCells.get(key);
          if (bucket) bucket.push(q);
          else junctionCells.set(key, [q]);
        }
        const compatible = points.every(p => {
          const cx = Math.floor(p.x / 35), cz = Math.floor(p.z / 35);
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            for (const q of junctionCells.get(`${cx + dx}:${cz + dz}`) ?? []) {
              if (Math.hypot(p.x - q.x, p.z - q.z) < 35 && Math.abs(p.y - q.y) > 4) return false;
            }
          }
          return true;
        });
        if (!compatible) continue;
        // A junction is permitted at the ends, never a long parallel braid or an
        // unprofiled crossing in the middle.
        const interior = points.filter((_, i) => i % 5 === 0).filter(p =>
          Math.hypot(p.x - a.p.x, p.z - a.p.z) > 100 && Math.hypot(p.x - b.p.x, p.z - b.p.z) > 100);
        if (interior.some(p => distanceToRoad(p) < 35)) continue;
        const trial: Road = {
          id: roads.length, class: 'road', from: a.r.from, to: b.r.from,
          points, length: 0, bridgeLength: 0,
        };
        const ground = createGround(map, { roads: [...roads, trial], connected: [] },
          byId.filter(p => p.id !== 0 && ['city', 'town', 'village'].includes(p.kind)));
        const validSurface = [...roads, trial].every(r => r.points.every((b, i) => {
          if (!i) return true;
          const a = r.points[i - 1];
          if (a.bridge && b.bridge) return true;
          if (r !== trial) {
            const cx = Math.floor(b.x / 50), cz = Math.floor(b.z / 50);
            let near = false;
            for (let dx = -2; dx <= 2 && !near; dx++) for (let dz = -2; dz <= 2 && !near; dz++) {
              near = (selfCells.get(`${cx + dx}:${cz + dz}`) ?? []).some(j =>
                Math.hypot(points[j].x - b.x, points[j].z - b.z) < 70);
            }
            if (!near) return true;
          }
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          if (!length) return true;
          const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
          const samples = Math.ceil(length);
          for (let j = 0; j <= samples; j++) {
            const t = j / samples, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            for (const offset of [-23, -14, -5, -2.5, 0, 2.5, 5, 14, 23]) {
              const px = x + nx * offset, pz = z + nz * offset;
              if (Math.abs(ground.height(px, pz) - groundHeight(map, px, pz)) > EARTHWORK) return false;
            }
            for (const half of [2, 5]) {
              if (Math.abs(ground.surface(x + nx * half, z + nz * half) -
                ground.surface(x - nx * half, z - nz * half)) / (2 * half) > 0.079) return false;
            }
          }
          return true;
        }));
        if (!validSurface) continue;
        store('road', byId[a.r.from], byId[b.r.from], points);
        used.push(middle);
        added = true;
        break;
      }
      if (added) break;
    }
  }

  const network: RoadNetwork = { roads, connected: byId.filter((p) => connected.has(p.id)).map((p) => p.id) };
  network.neighborhoods = expandNeighborhoods(map, plan, network);
  return network;
}
