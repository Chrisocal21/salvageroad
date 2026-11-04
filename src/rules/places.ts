// Where the places are: the towns, the docks and the rest. Plain numbers, no rendering: the same seed always gives the same
// plan, and everything that needs it (terrain levelling, drawn towns, the map) reads it from here.
//
// Order of work:
//  1. Settlements: the starting town is given by the world. A city, more towns, villages, an industrial yard, outposts
//     and trail lookouts are picked from flat dry ground, spread apart from each other.
//  2. Docks: two coastal spots with deep water off the quay, flat dry land behind it, far from each other.
// Roads, highways, dirt roads, trails and bridges are planned from this plan in roads.ts.

import { groundHeight, KIND, kindAt, waterLevel, type WorldMap } from './world';
import { makeRandom } from './scatter';

export type PlaceKind = 'city' | 'town' | 'village' | 'industrial' | 'outpost' | 'dock' | 'lookout';

export interface Place {
  id: number;
  kind: PlaceKind;
  name: string;
  x: number;
  z: number;
  /** Ground height at the centre. */
  height: number;
  /** About how far the built-up area reaches, in metres. */
  radius: number;
}

export interface Dock extends Place {
  kind: 'dock';
  /** Where the land meets the sea at the quay, and the direction out to open water (unit vector). */
  shore: { x: number; z: number };
  seaward: { x: number; z: number };
}

export interface Plan {
  places: Place[];
  docks: Dock[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Probing the land

function dryAt(map: WorldMap, x: number, z: number, minHeight = 2): boolean {
  return groundHeight(map, x, z) >= minHeight && waterLevel(map, x, z) === null;
}

/** The largest distance (up to max) within which the land all round is dry and above minHeight. */
function dryRadius(map: WorldMap, x: number, z: number, max: number, minHeight = 3): number {
  for (let r = 60; r <= max; r += 40) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      if (!dryAt(map, x + Math.cos(a) * r, z + Math.sin(a) * r, minHeight)) return r - 40;
    }
  }
  return max;
}

/** The biggest height difference between the centre and the ground round it. */
function roughness(map: WorldMap, x: number, z: number, radii: number[]): number {
  const h = groundHeight(map, x, z);
  let rough = 0;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (const r of radii) rough = Math.max(rough, Math.abs(groundHeight(map, x + Math.cos(a) * r, z + Math.sin(a) * r) - h));
  }
  return rough;
}

interface Candidate {
  x: number;
  z: number;
  height: number;
  dry: number;
  rough: number;
}

const NAMES = {
  city: ['Port Alder', 'Redhaven', 'Karst City', 'Marlow'],
  town: ['Dustwater', 'Fenwick', 'Oro Verde', 'Halcyon', 'Pinecrest', 'Saltflat', 'Cobbler'],
  village: ['Little Ash', 'Wren', 'Quarry End', 'Brindle', 'Cold Spring', 'Hob', 'Thistle', 'Mudgee'],
  industrial: ['Ironworks', 'The Foundry', 'Cement Row'],
  outpost: ['Hermit Farm', 'Old Mill', 'Ranger Hut', 'Salt Shed', 'Orchard Barn', 'Windpump', 'Line Camp'],
  dock: ['North Quay', 'South Quay', 'Harbour Two'],
  lookout: ['Eagle Rock', 'The Spur', 'High Cairn', 'Watch Hill', 'Crow Point', 'Long Ridge', 'Bald Top'],
};

// ---------------------------------------------------------------------------------------------------------------------
// Picking places

/** A scan of the whole island for flat dry places, once, so every kind of place can choose from it. */
function scanSites(map: WorldMap, step: number): Candidate[] {
  const found: Candidate[] = [];
  for (let z = -map.half + step; z < map.half - step; z += step) {
    for (let x = -map.half + step; x < map.half - step; x += step) {
      const h = groundHeight(map, x, z);
      if (h < 6 || h > 320 || !dryAt(map, x, z, 3)) continue;
      const dry = dryRadius(map, x, z, 420);
      if (dry < 80) continue;
      found.push({ x, z, height: h, dry, rough: roughness(map, x, z, [50, 110, 190]) });
    }
  }
  return found;
}

interface PickRule {
  count: number;
  /** Must be at least this far from every place already chosen. */
  apart: number;
  minDry: number;
  maxRough: number;
  /** Lower is better. */
  score: (c: Candidate, nearest: number) => number;
}

function pick(candidates: Candidate[], chosen: { x: number; z: number }[], rule: PickRule): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < rule.count; i++) {
    let best: Candidate | null = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      if (c.dry < rule.minDry || c.rough > rule.maxRough) continue;
      let nearest = Infinity;
      for (const o of chosen) nearest = Math.min(nearest, Math.hypot(o.x - c.x, o.z - c.z));
      if (nearest < rule.apart) continue;
      const s = rule.score(c, nearest);
      if (s < bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (!best) break;
    out.push(best);
    chosen.push(best);
  }
  return out;
}

/** The coast: land that meets the sea, with deep water off it and flat dry ground behind it. */
function findDockSites(map: WorldMap): (Candidate & { shore: { x: number; z: number }; seaward: { x: number; z: number } })[] {
  const found: (Candidate & { shore: { x: number; z: number }; seaward: { x: number; z: number } })[] = [];
  const step = 3; // vertices
  for (let row = step; row < map.n - step; row += step) {
    for (let col = step; col < map.n - step; col += step) {
      const i = row * map.n + col;
      if (map.kind[i] !== KIND.land) continue;
      const x = -map.half + col * map.spacing;
      const z = -map.half + row * map.spacing;
      // Which way is the sea? Average the direction of ocean vertices within a few cells.
      let sx = 0;
      let sz = 0;
      let oceans = 0;
      for (let dr = -4; dr <= 4; dr++) {
        for (let dc = -4; dc <= 4; dc++) {
          const r = Math.min(map.n - 1, Math.max(0, row + dr));
          const c = Math.min(map.n - 1, Math.max(0, col + dc));
          if (map.kind[r * map.n + c] === KIND.ocean) {
            sx += dc;
            sz += dr;
            oceans++;
          }
        }
      }
      if (oceans < 8 || oceans > 50) continue; // not a coast, or a narrow neck of land
      const len = Math.hypot(sx, sz);
      if (len < 1e-6) continue;
      const nx = sx / len;
      const nz = sz / len;
      const h = groundHeight(map, x, z);
      if (h < 0.3 || h > 6) continue;
      // Deep water off the quay, none of it river or lake; dry flat land behind it.
      let ok = true;
      for (const d of [60, 140, 240]) {
        const px = x + nx * d;
        const pz = z + nz * d;
        const depth = groundHeight(map, px, pz);
        if (kindAt(map, px, pz) !== KIND.ocean || depth > -(2 + d * 0.035)) ok = false;
      }
      for (const d of [40, 100, 170]) {
        const px = x - nx * d;
        const pz = z - nz * d;
        if (!dryAt(map, px, pz, 1) || groundHeight(map, px, pz) > 40) ok = false;
      }
      if (!ok) continue;
      // The shore beside the quay must be land too, so the quay has a stretch of coast, not a point.
      for (const s of [-1, 1]) {
        const px = x + -nz * s * 70;
        const pz = z + nx * s * 70;
        if (kindAt(map, px, pz) === KIND.river || kindAt(map, px, pz) === KIND.lake) ok = false;
      }
      if (!ok) continue;
      const yardX = x - nx * 110;
      const yardZ = z - nz * 110;
      found.push({
        x: yardX,
        z: yardZ,
        height: groundHeight(map, yardX, yardZ),
        dry: 150,
        rough: roughness(map, yardX, yardZ, [40, 90]) + Math.abs(h - 2) * 0.5,
        shore: { x, z },
        seaward: { x: nx, z: nz },
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------
// The plan

export interface PlanOptions {
  cities: number;
  towns: number;
  villages: number;
  industrial: number;
  outposts: number;
  lookouts: number;
}

export const DEFAULT_PLAN: PlanOptions = { cities: 1, towns: 3, villages: 4, industrial: 1, outposts: 6, lookouts: 5 };

const RADIUS: Record<PlaceKind, number> = { city: 330, town: 190, village: 110, industrial: 160, outpost: 40, dock: 150, lookout: 20 };

export function planPlaces(map: WorldMap, options: PlanOptions = DEFAULT_PLAN): Plan {
  const rand = makeRandom(Math.imul(map.spec.seed, 40503) ^ 0x9e3779b1);
  const places: Place[] = [];
  const docks: Dock[] = [];
  const nameUse = new Map<PlaceKind, number>();
  const add = (kind: PlaceKind, x: number, z: number, height: number, name?: string): Place => {
    const used = nameUse.get(kind) ?? 0;
    nameUse.set(kind, used + 1);
    const list = NAMES[kind];
    const place: Place = { id: places.length, kind, name: name ?? list[used % list.length], x, z, height, radius: RADIUS[kind] };
    places.push(place);
    return place;
  };

  // The starting town is where the world put it.
  const start = map.settlement.town;
  const startPlace = add('town', start.x, start.z, start.height, 'Sunrise');
  const taken: { x: number; z: number }[] = [{ x: start.x, z: start.z }];

  const sites = scanSites(map, 96);
  const dist = (c: { x: number; z: number }, o: { x: number; z: number }) => Math.hypot(c.x - o.x, c.z - o.z);

  // Docks first: they are the rarest ground. One a few km from the start, the other well away from both.
  const coast = findDockSites(map);
  const dockOf = (c: (typeof coast)[number], name: string) => {
    const place = add('dock', c.x, c.z, c.height, name) as Dock;
    place.shore = c.shore;
    place.seaward = c.seaward;
    docks.push(place);
    taken.push({ x: c.x, z: c.z });
  };
  const nearDock = coast.filter((c) => dist(c, startPlace) > 2500 && dist(c, startPlace) < 6500);
  const dockA = pickBest(nearDock.length > 0 ? nearDock : coast, (c) => c.rough + Math.abs(dist(c, startPlace) - 4000) / 120);
  if (dockA) dockOf(dockA, NAMES.dock[0]);
  const farDock = coast.filter((c) => dockA && dist(c, dockA) > 6500 && dist(c, startPlace) > 3000);
  const dockB = pickBest(farDock.length > 0 ? farDock : coast.filter((c) => dockA && dist(c, dockA) > 3500), (c) => c.rough - Math.min(dist(c, dockA ?? startPlace), 9000) / 150);
  if (dockB) dockOf(dockB, NAMES.dock[1]);

  const spread = (c: Candidate, near: number) => c.rough * 0.8 - Math.min(near, 3600) / 90 + rand() * 4;

  for (const c of pick(sites, taken, {
    count: options.cities,
    apart: 2600,
    minDry: 300,
    maxRough: 22,
    score: (c) => c.rough * 2 + Math.abs(dist(c, startPlace) - 4300) / 100 + rand() * 6,
  })) add('city', c.x, c.z, c.height);
  for (const c of pick(sites, taken, { count: options.towns, apart: 2000, minDry: 200, maxRough: 30, score: spread })) add('town', c.x, c.z, c.height);
  for (const c of pick(sites, taken, { count: options.villages, apart: 1300, minDry: 120, maxRough: 40, score: spread })) add('village', c.x, c.z, c.height);
  const city = places.find((p) => p.kind === 'city') ?? startPlace;
  for (const c of pick(sites, taken, {
    count: options.industrial,
    apart: 1000,
    minDry: 220,
    maxRough: 24,
    score: (c) => c.rough + Math.abs(dist(c, city) - 1600) / 60 + rand() * 3,
  })) add('industrial', c.x, c.z, c.height);
  for (const c of pick(sites, taken, {
    count: options.outposts,
    apart: 1100,
    minDry: 70,
    maxRough: 45,
    score: (c, near) => -Math.min(near, 3200) / 60 + c.rough * 0.3 + rand() * 6,
  })) add('outpost', c.x, c.z, c.height);

  // Lookouts: high dry ground, for trails to climb to.
  const high: Candidate[] = [];
  for (let z = -map.half + 200; z < map.half - 200; z += 120) {
    for (let x = -map.half + 200; x < map.half - 200; x += 120) {
      const h = groundHeight(map, x, z);
      if (h > 140 && dryAt(map, x, z, 100)) high.push({ x, z, height: h, dry: 0, rough: 0 });
    }
  }
  for (const c of pick(high, taken, { count: options.lookouts, apart: 1500, minDry: 0, maxRough: 1e9, score: (c) => -c.height + rand() * 60 })) {
    add('lookout', c.x, c.z, c.height);
  }

  return { places, docks };
}

function pickBest<T>(items: T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    const s = score(item);
    if (s < bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return best;
}
