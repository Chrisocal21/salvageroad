// The ground you stand and drive on: the world's smooth height, plus fine bumps so it does not look sanded.
// Where a road runs, the ground is cut and filled to the road's own height, and the bumps are calmed so the
// road is not corrugated. Bridge decks are NOT ground: they are added only by surface(), which is what walking
// and driving physics use, so the drawn terrain stays natural under a bridge while you cross on the deck.
// Everything that needs the ground height (the drawn terrain tiles, walking, driving physics, props) asks one
// of these two functions, so they always agree. Plain numbers, no rendering.

import { ROAD_SPEC, type RoadNetwork } from './roads';
import { fbm } from './terrain';
import { groundHeight, type WorldMap } from './world';
import type { Place } from './places';
import { LOT, ROAD, settlementGrid } from './town';

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
export const ROAD_BLEND = 18;
/** Lookup bucket size in metres. Each segment is indexed across its full influence area. */
const CELL = 32;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface RoadSegment {
  road: number;
  ax: number;
  az: number;
  ay: number;
  dx: number;
  dz: number;
  dy: number;
  lengthSquared: number;
  /** Half the road's width: inside this the ground is fully the road's height. */
  half: number;
  bridge: boolean;
}

/** Exact segment projections keep sloping roads smooth instead of stepping between nearest samples. */
function project(s: RoadSegment, x: number, z: number) {
  const t = s.lengthSquared > 0 ? Math.min(1, Math.max(0, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.lengthSquared)) : 0;
  return { distance: Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t), y: s.ay + s.dy * t };
}

function indexRoads(network: RoadNetwork): Map<number, RoadSegment[]> {
  const buckets = new Map<number, RoadSegment[]>();
  for (const road of network.roads) {
    const half = ROAD_SPEC[road.class].width / 2;
    const pts = road.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segment: RoadSegment = { road: road.id, ax: a.x, az: a.z, ay: a.y, dx, dz, dy: b.y - a.y, lengthSquared: dx * dx + dz * dz, half, bridge: a.bridge && b.bridge };
      const reach = half + ROAD_BLEND;
      for (let ix = Math.floor((Math.min(a.x, b.x) - reach) / CELL); ix <= Math.floor((Math.max(a.x, b.x) + reach) / CELL); ix++) {
        for (let iz = Math.floor((Math.min(a.z, b.z) - reach) / CELL); iz <= Math.floor((Math.max(a.z, b.z) + reach) / CELL); iz++) {
          const key = (ix + 512) * 2048 + iz + 512;
          const bucket = buckets.get(key);
          if (bucket) bucket.push(segment);
          else buckets.set(key, [segment]);
        }
      }
    }
  }
  return buckets;
}

export function createGround(map: WorldMap, network?: RoadNetwork, settlements: Place[] = []): Ground {
  const pads = network?.neighborhoods?.map(({ town: t }) => ({ x: t.center.x, z: t.center.z, half: (t.roadsX.at(-1)! - t.roadsX[0]) / 2 + ROAD, y: t.groundY! })) ?? [];
  const padBuckets = new Map<number, typeof pads>();
  const padKey = (x: number, z: number) => (Math.floor(x / 64) + 512) * 2048 + Math.floor(z / 64) + 512;
  for (const p of pads) {
    const reach = p.half + 22;
    for (let x = Math.floor((p.x - reach) / 64); x <= Math.floor((p.x + reach) / 64); x++)
      for (let z = Math.floor((p.z - reach) / 64); z <= Math.floor((p.z + reach) / 64); z++) {
        const key = padKey(x * 64, z * 64), bucket = padBuckets.get(key) ?? [];
        bucket.push(p); padBuckets.set(key, bucket);
      }
  }
  const { town } = map.settlement;
  const seed = map.spec.seed;
  const calm = town.flatRadius + town.blendRadius * 0.5; // no bumps inside this, so the town stays level
  const full = town.flatRadius + town.blendRadius;
  const roads = network ? indexRoads(network) : null;
  function near(x: number, z: number): RoadSegment[] | null {
    if (!roads) return null;
    const ix = Math.floor(x / CELL) + 512;
    const iz = Math.floor(z / CELL) + 512;
    return roads.get(ix * 2048 + iz) ?? null;
  }
  function height(x: number, z: number): number {
    let natural = groundHeight(map, x, z);
    let settlementDetail = 1;
    const localPads = padBuckets.get(padKey(x, z)) ?? [];
    for (const p of localPads) {
      const edge = Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - p.half;
      if (edge >= 22) continue;
      const t = smoothstep(0, 22, edge);
      natural = p.y + (natural - p.y) * t;
      settlementDetail = Math.min(settlementDetail, t);
    }
    for (const p of settlements) {
      const edge = Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - (settlementGrid(p.kind, p.urban) * LOT / 2 + ROAD);
      if (edge >= 30) continue;
      const t = smoothstep(0, 30, edge);
      natural = p.height + (natural - p.height) * t;
      settlementDetail = Math.min(settlementDetail, t);
    }
    let base = natural;
    let roadT = 1; // 1 is fully natural ground, 0 is fully the road's own height
    const samples = near(x, z);
    if (samples) {
      let bestY: number | null = null;
      let bestPen = Infinity; // distance outside the road's edge; negative is inside the road
      const nearest = new Map<number, { distance: number; y: number }>();
      for (const s of samples) {
        if (s.bridge) continue; // the ground under a bridge stays natural
        const p = project(s, x, z);
        if (p.distance < (nearest.get(s.road)?.distance ?? Infinity)) nearest.set(s.road, p);
        const pen = p.distance - s.half;
        if (pen < ROAD_BLEND && pen < bestPen) {
          bestY = p.y;
          bestPen = pen;
        }
      }
      if (bestY !== null) {
        // Blend junction surfaces continuously instead of switching abruptly between two ribbons.
        // Use one projection per road, so point density cannot bias a junction's elevation.
        if (nearest.size > 1) {
          let sum = 0, weight = 0;
          for (const p of nearest.values()) {
            const w = Math.max(0, 1 - (p.distance / 12) ** 2) ** 3;
            sum += p.y * w;
            weight += w;
          }
          if (weight > 0) bestY = sum / weight;
        }
        roadT = smoothstep(0, ROAD_BLEND, bestPen);
        base = bestY + (natural - bestY) * roadT;
      }
      // Approach segments just outside a gate must not tilt shop floors or their colliders.
      for (const p of settlements) {
        const span = settlementGrid(p.kind, p.urban) * LOT / 2;
        const t = smoothstep(span - ROAD / 2, span, Math.max(Math.abs(x - p.x), Math.abs(z - p.z)));
        base = p.height + (base - p.height) * t;
      }
      for (const p of localPads) {
        const t = smoothstep(p.half - ROAD, p.half, Math.max(Math.abs(x - p.x), Math.abs(z - p.z)));
        base = p.y + (base - p.y) * t;
      }
    }
    const land = smoothstep(1.5, 6, natural); // no bumps in the sea or on the beach
    if (land === 0) return base;
    const away = smoothstep(calm, full, Math.hypot(x - town.x, z - town.z));
    if (away === 0) return base;
    const bumps = fbm(seed + 41, x / 24, z / 24) * 0.8 + fbm(seed + 43, x / 6, z / 6) * 0.25;
    return base + bumps * DETAIL_AMPLITUDE * land * away * roadT * settlementDetail;
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
        const p = project(s, x, z);
        if (p.distance <= s.half) deck = Math.max(deck, p.y);
      }
      return deck === -Infinity ? h : Math.max(h, deck);
    },
    roadDistance(x, z) {
      const samples = near(x, z);
      if (!samples) return Infinity;
      let d = Infinity;
      for (const s of samples) d = Math.min(d, project(s, x, z).distance);
      return d;
    },
  };
}
