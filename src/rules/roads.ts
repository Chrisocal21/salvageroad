// The roads between the places: highways, paved roads, dirt roads, trails, and the bridges they cross water on.
// Plain numbers, no rendering: the same seed always gives the same network, and everything that needs it
// (the drawn roads, the map, driving) reads it from here.
//
// How it is made, in order:
//  1. The network: which place joins to which. Highways join the city, the towns, the industrial yard and the
//     docks into one spine: a cheapest spanning tree, plus a couple of extra links where the tree would send
//     you the long way round, so the map has loops. Each village then joins its nearest place with a paved
//     road, each outpost with a dirt road, and each lookout with a trail that is allowed to climb.
//  2. The route of each link: A* over the world's height grid. Climbing costs, steep ground costs much more,
//     and crossing water costs a lot, so a road detours round a river until the detour is longer than a
//     bridge. The sea is impassable, and land next to it is discouraged so the smoothed line cannot clip a
//     coast. Each class has its own appetite for slope and for bridges.
//  3. The route is smoothed (corner cutting), given a height profile that follows the land within limited
//     earthworks and a limited grade, and the wet spans become bridges: flat decks a little above the water,
//     the road ramping to them within the grade limit.

import { KIND, NO_WATER, groundHeight, kindAt, waterLevel, type WorldMap } from './world';
import type { Dock, Place, PlaceKind, Plan } from './places';
import { GRID, LOT, YARD } from './town';

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
  id: number;
  class: RoadClass;
  /** Ids of the places this road joins (indexes into plan.places). */
  from: number;
  to: number;
  points: RoadPoint[];
  /** Metres along the road. */
  length: number;
  /** Metres of bridge deck. */
  bridgeLength: number;
}

export interface RoadNetwork {
  roads: Road[];
  /** Ids of the places that ended up connected to the starting town. */
  connected: number[];
}

export interface RoadOptions {
  /** Extra highway links beyond the spanning tree, where the tree route is a long detour. */
  loops: number;
}

export const DEFAULT_ROADS: RoadOptions = { loops: 2 };

/** Metres between finished road points. */
const STEP = 9;
/** Bridge decks stand this far above the water. */
const CLEARANCE = 2;
/** How far the road surface may sit from the natural ground, either way. */
const EARTHWORK = 12;
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

  const existing = new Uint8Array(count);
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
      if (kindAt(map, x, z) === KIND.ocean) return Infinity;
      const h = groundHeight(map, x, z);
      const grade = Math.abs(h - prev) / d;
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
        if (runCost(spec, path[i], path[j]) <= (prefix[j] - prefix[i]) * 1.15 + 2 * map.spacing) {
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
  function route(spec: ClassSpec, a: { x: number; z: number }, b: { x: number; z: number }): { x: number; z: number }[] | null {
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
        const dist = map.spacing * (DX[d] !== 0 && DZ[d] !== 0 ? SQRT2 : 1);
        const grade = Math.abs(map.ground[j] - hi) / dist;
        let cost = dist * (1 + spec.slopeWeight * (grade / spec.maxGrade) ** 2);
        if (map.water[j] !== NO_WATER && map.water[j] > map.ground[j]) cost += spec.waterPerMetre * dist;
        if (coast[j]) cost += dist * 0.6;
        if (existing[j]) cost *= 0.3; // follow a road already built, so roads share a corridor and then join
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
  /** Marks the cells near a finished road, so later roads run along it. */
  const mark = (pts: Pt[]) => {
    for (const p of pts) {
      const c = cellOf(p.x, p.z);
      for (const d of [0, 1, -1, n, -n]) if (c + d >= 0 && c + d < count) existing[c + d] = 1;
    }
  };
  return { route, simplify, mark };
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
function fillet(map: WorldMap, line: Pt[], radius: number): Pt[] {
  if (line.length < 3) return line;
  const wetAt = (p: Pt) => waterLevel(map, p.x, p.z) !== null;
  const out: Pt[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1];
    const b = line[i];
    const c = line[i + 1];
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
 * EARTHWORK of it and within the class's grade limit.
 *
 * The grade limit comes from a Lipschitz envelope: U is the highest grade-limited profile at or under the
 * target heights, L the lowest at or over them, and their average is grade-limited too. The decks are pinned
 * as anchors in the envelopes, so the road ramps to them within the limit; the decks themselves are first made
 * mutually feasible (one deck never asks another to be reached too steeply) by raising the lower of any pair
 * that is too close in height for the distance between them.
 */
function finishRoad(map: WorldMap, spec: ClassSpec, cls: RoadClass, line: Pt[]): RoadPoint[] {
  // `line` is gate, stub, a straightened route, stub, gate: long straight runs. Each corner is rounded into a
  // bend (see fillet), then the road is cut into evenly spaced points. The straight leads at the ends keep the
  // road square to the street it meets.
  const pts = resample(fillet(map, line, BEND_RADIUS[cls]), STEP);
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

  // Wet spans, merging ones separated by a point or two (an islet in the river is still one bridge). Every
  // point of a span rides at deck height; the deck flag marks the span, bridge (exported) the wet points.
  const deck = new Array<boolean>(m).fill(false);
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
    let height = -Infinity;
    for (let k = i; k <= end; k++) height = Math.max(height, wet[k]! + CLEARANCE);
    if (i > 0) height = Math.max(height, ground[i - 1]);
    if (end < m - 1) height = Math.max(height, ground[end + 1]);
    for (let k = i; k <= end; k++) {
      deck[k] = true;
      y[k] = height;
    }
    spans.push([i, end]);
    i = end + 1;
  }
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

  // The band the decks alone allow: within maxGrade of some deck. Where the averaged profile leaves the band
  // (a deck standing above low ground), clamping pulls the road onto a ramp that reaches the deck exactly at
  // the grade limit, so the join is never a bump.
  const lo = new Float64Array(m).fill(-Infinity);
  const hi = new Float64Array(m).fill(Infinity);
  for (let k = 0; k < m; k++) {
    if (deck[k]) {
      lo[k] = y[k];
      hi[k] = y[k];
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

  const points: RoadPoint[] = new Array(m);
  for (let k = 0; k < m; k++) {
    const averaged = (upper[k] + lower[k]) / 2;
    points[k] = {
      x: pts[k].x,
      z: pts[k].z,
      y: deck[k] ? y[k] : clamp(averaged, lo[k], hi[k]),
      bridge: deck[k] && wet[k] !== null,
    };
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
 * gets eight gates on a ring inside its edge (docks only on the land side); when those places are drawn, their
 * streets should open onto these gates.
 */
export function gatesOf(map: WorldMap, place: Place): Gate[] {
  const town = map.settlement.town;
  if (place.kind === 'town' && Math.hypot(place.x - town.x, place.z - town.z) < 1) {
    const span = GRID * LOT;
    const x0 = town.x - span / 2;
    const z0 = town.z - span / 2;
    const gates: Gate[] = [];
    for (let i = 0; i <= GRID; i++) {
      const x = x0 + i * LOT;
      const z = z0 + i * LOT;
      gates.push({ x, z: z0 + span, dx: 0, dz: 1 });
      if (Math.abs(x - town.x) > YARD.hx + 4) gates.push({ x, z: z0, dx: 0, dz: -1 });
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

const MAJORS: PlaceKind[] = ['city', 'town', 'industrial', 'dock'];

/** How close to an existing road a new one must come to count as joining it, metres. */
const JOIN = 16;

/**
 * A road that runs along one already built would draw on top of it. Keep only the part of the new road that is
 * its own: from each end to the point where it first meets an existing road (a junction), and drop the stretch
 * between that runs alongside. A road that only crosses another, or never meets one, is kept whole.
 */
function trimToNetwork(points: RoadPoint[], roads: Road[]): RoadPoint[][] {
  const hash = new Map<number, Pt[]>();
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
        // At a different height it is an overpass, not a junction.
        if (Math.abs((q as RoadPoint).y - (p as RoadPoint).y) > 4) continue;
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < bestD) { bestD = d; best = q as RoadPoint; }
      }
    }
    return best;
  };
  const near = (p: Pt) => nearest(p) !== null;
  /** Ends the piece squarely on the other road: drops the last couple of points and lands on its centreline. */
  const landEnd = (piece: RoadPoint[]): RoadPoint[] => {
    const t = nearest(piece[piece.length - 1]);
    if (!t || piece.length < 5) return piece;
    const out = piece.slice(0, -1).map((q) => ({ ...q }));
    const last = { x: t.x, z: t.z, y: t.y, bridge: false };
    // Ease the height over the last 30 points so the road meets the other one level, within its grade.
    const k = Math.min(30, out.length);
    const dy = t.y - piece[piece.length - 1].y;
    for (let m = 1; m <= k; m++) {
      const q = out[out.length - 1 - (m - 1)];
      if (!q.bridge) q.y += dy * (1 - (m - 1) / k);
    }
    return [...out, last];
  };
  const n = points.length;
  const skip = Math.ceil((LEAD + 30) / STEP);
  const onNet = points.map((p) => near(p));
  let i = -1;
  for (let k = skip; k < n; k++) if (onNet[k]) { i = k; break; }
  let j = -1;
  for (let k = n - 1 - skip; k >= 0; k--) if (onNet[k]) { j = k; break; }
  if (i < 0 || j < 0) return [points];
  if (i >= j) return [points];
  const middle = onNet.slice(i, j + 1).filter(Boolean).length / (j - i + 1);
  if (middle < 0.6) return [points];
  const tail = landEnd(points.slice(j).reverse()).reverse();
  return [landEnd(points.slice(0, i + 1)), tail].filter((x) => x.length > 2);
}

export function planRoads(map: WorldMap, plan: Plan, options: RoadOptions = DEFAULT_ROADS): RoadNetwork {
  const { route, simplify, mark } = createRouter(map);
  const roads: Road[] = [];
  const byId = plan.places;
  const dist = (a: Place, b: Place) => Math.hypot(a.x - b.x, a.z - b.z);

  // Union-find over the places, so we can say who ended up joined to the starting town.
  const parent = byId.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const start = byId[0];
  const joinedToStart = (p: Place) => find(p.id) === find(start.id);

  const addRoad = (cls: RoadClass, a: Place, b: Place): boolean => {
    // A rough route centre to centre says which way the road really wants to leave each place.
    const rough = route(ROAD_SPEC[cls], a, b);
    if (!rough) return false;
    const ga = pickGate(map, a, rough);
    const gb = pickGate(map, b, rough.slice().reverse());
    const stubA = { x: ga.x + ga.dx * LEAD, z: ga.z + ga.dz * LEAD };
    const stubB = { x: gb.x + gb.dx * LEAD, z: gb.z + gb.dz * LEAD };
    const raw = route(ROAD_SPEC[cls], stubA, stubB);
    if (!raw) return false;
    const points = finishRoad(map, ROAD_SPEC[cls], cls, [{ x: ga.x, z: ga.z }, ...declutter(map, simplify(ROAD_SPEC[cls], raw)), { x: gb.x, z: gb.z }]);
    const pieces = trimToNetwork(points, roads);
    for (const piece of pieces) {
      let length = 0;
      let bridgeLength = 0;
      for (let i = 1; i < piece.length; i++) {
        const d = Math.hypot(piece[i].x - piece[i - 1].x, piece[i].z - piece[i - 1].z);
        length += d;
        if (piece[i].bridge || piece[i - 1].bridge) bridgeLength += d;
      }
      roads.push({ id: roads.length, class: cls, from: a.id, to: b.id, points: piece, length, bridgeLength });
    }
    mark(points);
    parent[find(a.id)] = find(b.id);
    return true;
  };

  // The highway spine: Prim's tree from the starting town, cheapest straight-line link first. A link that
  // cannot be routed (across open sea) is skipped for the next cheapest.
  const majors = byId.filter((p) => MAJORS.includes(p.kind));
  const inTree = new Set<number>([start.id]);
  const treeLinks = new Set<string>();
  const linkKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  while (inTree.size < majors.length) {
    const candidates: { a: Place; b: Place; d: number }[] = [];
    for (const id of inTree) {
      for (const m of majors) {
        if (!inTree.has(m.id)) candidates.push({ a: byId[id], b: m, d: dist(byId[id], m) });
      }
    }
    candidates.sort((p, q) => p.d - q.d);
    let linked = false;
    for (const c of candidates) {
      if (addRoad('highway', c.a, c.b)) {
        treeLinks.add(linkKey(c.a.id, c.b.id));
        inTree.add(c.b.id);
        linked = true;
        break;
      }
    }
    if (!linked) break;
  }

  // Extra highway links where the tree is a long way round: how far the tree takes you versus the crow flies.
  if (options.loops > 0 && treeLinks.size > 0) {
    const tree = byId.map(() => [] as { to: number; d: number }[]);
    for (const key of treeLinks) {
      const [a, b] = key.split('-').map(Number);
      const d = dist(byId[a], byId[b]);
      tree[a].push({ to: b, d });
      tree[b].push({ to: a, d });
    }
    const treeDist = (fromId: number, toId: number): number => {
      const seen = new Set<number>([fromId]);
      const stack = [{ at: fromId, d: 0 }];
      while (stack.length > 0) {
        const { at, d } = stack.pop()!;
        if (at === toId) return d;
        for (const e of tree[at]) {
          if (!seen.has(e.to)) {
            seen.add(e.to);
            stack.push({ at: e.to, d: d + e.d });
          }
        }
      }
      return Infinity;
    };
    const detours: { a: Place; b: Place; d: number }[] = [];
    for (let i = 0; i < majors.length; i++) {
      for (let j = i + 1; j < majors.length; j++) {
        const a = majors[i];
        const b = majors[j];
        if (treeLinks.has(linkKey(a.id, b.id))) continue;
        const direct = dist(a, b);
        if (treeDist(a.id, b.id) > direct * 1.9) detours.push({ a, b, d: direct });
      }
    }
    detours.sort((p, q) => p.d - q.d);
    let added = 0;
    for (const c of detours) {
      if (added >= options.loops) break;
      if (addRoad('highway', c.a, c.b)) added++;
    }
  }

  // Villages, outposts and lookouts each join their nearest place that a route can reach, preferring places
  // already on the network.
  const join = (kind: PlaceKind, cls: RoadClass) => {
    for (const p of byId.filter((q) => q.kind === kind)) {
      const others = byId.filter((q) => q.id !== p.id).sort((a, b) => dist(p, a) - dist(p, b));
      const ordered = [...others.filter(joinedToStart), ...others.filter((q) => !joinedToStart(q))];
      for (const o of ordered) {
        if (addRoad(cls, p, o)) break;
      }
    }
  };
  join('village', 'road');
  join('outpost', 'dirt');
  join('lookout', 'trail');

  const connected = byId.filter(joinedToStart).map((p) => p.id);
  return { roads, connected };
}
