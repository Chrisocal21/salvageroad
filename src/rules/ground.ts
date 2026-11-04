// The ground you stand and drive on: the world's smooth height, plus fine bumps so it does not look sanded.
// Where a road runs, the ground is cut and filled to the road's own height, and the bumps are calmed so the
// road is not corrugated. Bridge decks are NOT ground: they are added only by surface(), which is what walking
// and driving physics use, so the drawn terrain stays natural under a bridge while you cross on the deck.
// Everything that needs the ground height (the drawn terrain tiles, walking, driving physics, props) asks one
// of these two functions, so they always agree. Plain numbers, no rendering.

import { ROAD_SPEC, type RoadNetwork } from './roads';
import { fbm } from './terrain';
import { groundHeight, type WorldMap } from './world';

export interface Ground {
  /** Ground height in metres at a world position, with road cuts and fills but no bridge decks. */
  height(x: number, z: number): number;
  /** What you stand and drive on: height(), plus bridge decks where a road crosses water or a gorge. */
  surface(x: number, z: number): number;
  /** Distance to the nearest road centreline, or Infinity far from any road. Props use it to keep off roads. */
  roadDistance(x: number, z: number): number;
  /** The level of the town's flat ground. */
  townHeight: number;
}

/** Metres of fine bumpiness, either way. */
export const DETAIL_AMPLITUDE = 0.55;

/** How far beyond the road's edge the ground blends back to natural, in metres. */
const ROAD_BLEND = 9;
/** Road points are sampled this far apart for the lookup, so the nearest sample is never far. */
const SAMPLE = 4.5;
/** Lookup bucket size in metres. Must exceed the furthest influence of a point (widest road + ROAD_BLEND). */
const CELL = 32;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface RoadSample {
  x: number;
  z: number;
  y: number;
  /** Half the road's width: inside this the ground is fully the road's height. */
  half: number;
  bridge: boolean;
}

/** Buckets of road samples, so height() only looks at the few samples near the query. */
function indexRoads(network: RoadNetwork): Map<number, RoadSample[]> {
  const buckets = new Map<number, RoadSample[]>();
  const put = (s: RoadSample) => {
    const key = (Math.floor(s.x / CELL) + 512) * 2048 + (Math.floor(s.z / CELL) + 512);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(s);
    else buckets.set(key, [s]);
  };
  for (const road of network.roads) {
    const half = ROAD_SPEC[road.class].width / 2;
    const pts = road.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / SAMPLE));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        // A sample counts as deck only when the whole segment around it is deck, so the approach ramp
        // is still levelled as ground and meets the deck exactly where the planner put the join.
        const bridge = a.bridge && (i === pts.length - 1 || b.bridge);
        put({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, half, bridge });
      }
    }
  }
  return buckets;
}

export function createGround(map: WorldMap, network?: RoadNetwork): Ground {
  const { town } = map.settlement;
  const seed = map.spec.seed;
  const calm = town.flatRadius + town.blendRadius * 0.5; // no bumps inside this, so the town stays level
  const full = town.flatRadius + town.blendRadius;
  const roads = network ? indexRoads(network) : null;
  /** The road samples that can matter at (x, z): the 3 x 3 buckets around it cover every influence radius. */
  function near(x: number, z: number): RoadSample[] | null {
    if (!roads) return null;
    const ix = Math.floor(x / CELL) + 512;
    const iz = Math.floor(z / CELL) + 512;
    let found: RoadSample[] | null = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = roads.get((ix + dx) * 2048 + (iz + dz));
        if (bucket) found = found ? found.concat(bucket) : bucket.slice();
      }
    }
    return found;
  }
  function height(x: number, z: number): number {
    const natural = groundHeight(map, x, z);
    let base = natural;
    let roadT = 1; // 1 is fully natural ground, 0 is fully the road's own height
    const samples = near(x, z);
    if (samples) {
      let best: RoadSample | null = null;
      let bestPen = Infinity; // distance outside the road's edge; negative is inside the road
      for (const s of samples) {
        if (s.bridge) continue; // the ground under a bridge stays natural
        const pen = Math.hypot(x - s.x, z - s.z) - s.half;
        if (pen < ROAD_BLEND && pen < bestPen) {
          best = s;
          bestPen = pen;
        }
      }
      if (best) {
        roadT = smoothstep(0, ROAD_BLEND, bestPen);
        base = best.y + (natural - best.y) * roadT;
      }
    }
    const land = smoothstep(1.5, 6, natural); // no bumps in the sea or on the beach
    if (land === 0) return base;
    const away = smoothstep(calm, full, Math.hypot(x - town.x, z - town.z));
    if (away === 0) return base;
    const bumps = fbm(seed + 41, x / 24, z / 24) * 0.8 + fbm(seed + 43, x / 6, z / 6) * 0.25;
    return base + bumps * DETAIL_AMPLITUDE * land * away * roadT;
  }
  return {
    townHeight: town.height,
    height,
    surface(x, z) {
      const h = height(x, z);
      const samples = near(x, z);
      if (!samples) return h;
      let deck = -Infinity;
      for (const s of samples) {
        if (!s.bridge) continue;
        if (Math.hypot(x - s.x, z - s.z) <= s.half) deck = Math.max(deck, s.y);
      }
      return deck === -Infinity ? h : Math.max(h, deck);
    },
    roadDistance(x, z) {
      const samples = near(x, z);
      if (!samples) return Infinity;
      let d = Infinity;
      for (const s of samples) d = Math.min(d, Math.hypot(x - s.x, z - s.z));
      return d;
    },
  };
}
