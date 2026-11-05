import type { Plan } from './places';
import type { WorldMap } from './world';
import { generateTown, settlementGrid } from './town';
import type { RoadNetwork } from './roads';

export function settlementPlaces(map: WorldMap, plan: Plan) {
  const start = map.settlement.town;
  return plan.places.filter(p => ['city', 'town', 'village'].includes(p.kind) && Math.hypot(p.x - start.x, p.z - start.z) > 1);
}

/** Container IDs are global; building IDs remain local to each settlement's store lookup. */
export function generateSettlements(seed: number, map: WorldMap, plan: Plan, network?: RoadNetwork) {
  const towns = [generateTown(seed, map.settlement.town)];
  let nextId = towns[0].containers.length;
  for (const p of settlementPlaces(map, plan)) {
    const town = generateTown(seed + p.id * 7919, p, {
      grid: settlementGrid(p.kind, p.urban), junkyard: false, containerOffset: nextId, urban: p.kind === 'city' || p.urban,
    });
    nextId += town.containers.length;
    towns.push(town);
  }
  for (const { town } of network?.neighborhoods ?? []) {
    // Clone: the road plan's geometry must be reusable, including across loot-state rebuilds.
    const district = { ...town, containers: town.containers.map(c => ({ ...c, id: c.id + nextId })) };
    nextId += district.containers.length;
    towns.push(district);
  }
  return towns;
}
