// Road-first co-design: the routing draft supplies valleys, the original relief supplies
// inter-road mountains. This module only consumes plans; it never invokes a generator.
import { DESERT, KIND, NO_WATER, type WorldMap } from './world';
import type { RoadNetwork } from './roads';
import type { Plan } from './places';
import { LOT, ROAD, settlementGrid } from './town';

export function restoreMountains(map: WorldMap, plan: Plan, network: RoadNetwork): void {
  const { n, spacing, half } = map;
  const distance = new Float32Array(n * n).fill(1e6);
  const reserve = (x: number, z: number, radius: number) => {
    const c0 = Math.max(0, Math.floor((x - radius + half) / spacing));
    const c1 = Math.min(n - 1, Math.ceil((x + radius + half) / spacing));
    const r0 = Math.max(0, Math.floor((z - radius + half) / spacing));
    const r1 = Math.min(n - 1, Math.ceil((z + radius + half) / spacing));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (Math.hypot(-half + c * spacing - x, -half + r * spacing - z) <= radius + spacing)
        distance[r * n + c] = 0;
    }
  };
  // More than the full formation/shoulder footprint, including interpolation support.
  for (const road of network.roads) for (const p of road.points) reserve(p.x, p.z, 80);
  for (const p of plan.places) reserve(p.x, p.z, Math.SQRT2 * (settlementGrid(p.kind, p.urban) * LOT / 2 + ROAD + 30));
  for (const { town: t } of network.neighborhoods ?? []) reserve(t.center.x, t.center.z, 100);
  const town = map.settlement.town;
  reserve(town.x, town.z, Math.max(650, town.flatRadius + town.blendRadius));

  const sweep = (field: Float32Array, slope: number) => {
    for (const direction of [1, -1]) {
      for (let r = direction > 0 ? 0 : n - 1; r >= 0 && r < n; r += direction)
        for (let c = direction > 0 ? 0 : n - 1; c >= 0 && c < n; c += direction) {
          const i = r * n + c;
          for (const [dr, dc] of [[0, -direction], [-direction, -1], [-direction, 0], [-direction, 1]]) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
            field[i] = Math.min(field[i], field[rr * n + cc] + spacing * slope * Math.hypot(dr, dc));
          }
        }
    }
  };
  sweep(distance, 1);
  const rise = new Float32Array(n * n);
  for (let i = 0; i < rise.length; i++) {
    if (map.kind[i] !== KIND.land || map.water[i] !== NO_WATER) continue;
    const t = Math.min(1, distance[i] / 450);
    rise[i] = Math.max(0, map.mountainRelief[i] - map.ground[i]) * t * t * (3 - 2 * t);
  }
  // Preserve the existing drainage tree, not just its wet cells: a raised downstream
  // saddle must never dam a reserved upstream corridor. Each bound only lowers relief.
  // Repeating the slope envelope prevents abrupt walls across catchment boundaries.
  for (let pass = 0; pass < 4; pass++) {
    sweep(rise, 0.55);
    for (const i of map.drainageOrder) {
      const p = map.flowTo[i];
      if (p >= 0) rise[p] = Math.min(rise[p], Math.max(0,
        map.drainageSurface[i] + rise[i] - map.drainageSurface[p]));
    }
  }
  let highest = -Infinity, desert = 0, land = 0;
  for (let i = 0; i < rise.length; i++) {
    const oldHeight = map.ground[i];
    map.ground[i] += rise[i];
    map.drainageSurface[i] += rise[i];
    map.aridity[i] = Math.max(0, map.aridity[i] -
      (Math.min(500, Math.max(0, map.ground[i])) - Math.min(500, Math.max(0, oldHeight))) * 0.45 / 500);
    highest = Math.max(highest, map.ground[i]);
    if (map.kind[i] !== KIND.ocean) {
      land++;
      if (map.aridity[i] > DESERT) desert++;
    }
  }
  map.stats.highest = highest;
  map.stats.desertFraction = desert / Math.max(1, land);
}
