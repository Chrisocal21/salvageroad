import { groundHeight, isDryFootprint, type WorldMap } from './world';
import type { Plan } from './places';
import type { Road, RoadNetwork, RoadPoint } from './roads';
import { generateTown, LOT, ROAD, settlementGrid, type Town } from './town';
import { makeRandom } from './scatter';
import { createGround } from './ground';

export interface Neighborhood {
  parent: number;
  town: Town;
}

/** Small local foundations alongside existing approaches, never one giant city-height mesa. */
export function expandNeighborhoods(map: WorldMap, plan: Plan, network: RoadNetwork): Neighborhood[] {
  const result: Neighborhood[] = [];
  const original = network.roads.slice();
  const residential = plan.places.filter(p => p.id !== 0 && ['city', 'town', 'village'].includes(p.kind));
  for (const place of residential.sort((a, b) => Number(!!b.urban || b.kind === 'city') - Number(!!a.urban || a.kind === 'city'))) {
    const rand = makeRandom(map.spec.seed * 197 + place.id * 7919);
    const city = place.urban || place.kind === 'city';
    const target = city ? 78 + Math.floor(rand() * 24) : place.kind === 'town' ? 24 + Math.floor(rand() * 10) : 10 + Math.floor(rand() * 6);
    const reach = city ? 1100 : place.kind === 'town' ? 650 : 380;
    const candidates = original.flatMap(r => r.points.filter((p, i) => i % 2 === 0 && !p.bridge &&
      Math.hypot(p.x - place.x, p.z - place.z) < reach &&
      Math.hypot(p.x - place.x, p.z - place.z) > (city ? 70 : 42)).map(p => ({ p, r })));
    // Alternate the two sides of the approaches; seeded order varies district extent and population.
    const ranked = candidates.map(c => ({ ...c, rank: Math.hypot(c.p.x - place.x, c.p.z - place.z) + rand() * 40 }))
      .sort((a, b) => a.rank - b.rank);
    let count = 0;
    let entrances = 0;
    for (let candidateIndex = 0; candidateIndex < ranked.length; candidateIndex++) {
      const { p, r } = ranked[candidateIndex];
      if (count >= target) break;
      if (!r.local && entrances >= (city ? 4 : place.kind === 'town' ? 3 : 2)) continue;
      const index = r.points.indexOf(p);
      const next = r.points[index + 1] ?? r.points[index - 1];
      const horizontal = Math.abs(next.x - p.x) > Math.abs(next.z - p.z);
      for (const side of rand() < 0.5 ? [-1, 1] : [1, -1]) {
        const grid = 2;
        const half = grid * LOT / 2;
        const accessLength = 40;
        const center = { x: p.x + (horizontal ? 0 : side * (half + accessLength)), z: p.z + (horizontal ? side * (half + accessLength) : 0) };
        // Water is independent of bed elevation; high river/lake beds can pass height-only tests.
        // Reserve the rendered water mesh's three-cell shoreline apron as well.
        if (!isDryFootprint(map, { ...center, hx: half + ROAD / 2, hz: half + ROAD / 2 }, map.spacing * 3)) continue;
        const end = { x: horizontal ? center.x : center.x - side * half, z: horizontal ? center.z - side * half : center.z };
        if (!isDryFootprint(map, { x: (p.x + end.x) / 2, z: (p.z + end.z) / 2,
          hx: Math.abs(p.x - end.x) / 2 + ROAD / 2, hz: Math.abs(p.z - end.z) / 2 + ROAD / 2 }, map.spacing * 3)) continue;
        const naturalY = groundHeight(map, center.x, center.z);
        const level = Math.max(p.y - accessLength * 0.078, Math.min(p.y + accessLength * 0.078, naturalY));
        if (residential.some(q => Math.max(Math.abs(center.x - q.x), Math.abs(center.z - q.z)) <
          settlementGrid(q.kind, q.urban) * LOT / 2 + half + ROAD + 22)) continue;
        if (result.some(q => Math.max(Math.abs(center.x - q.town.center.x), Math.abs(center.z - q.town.center.z)) <
          half + (q.town.roadsX.at(-1)! - q.town.roadsX[0]) / 2 + 17.9)) continue;
        let safe = true;
        for (let x = -half - 22; x <= half + 22; x += 6) for (let z = -half - 22; z <= half + 22; z += 6) {
          if (level < 3 || Math.abs(groundHeight(map, center.x + x, center.z + z) - level) > 4.8) safe = false;
        }
        if (!safe) continue;
        // A pad may not bury another road or build over the approach itself.
        if (original.some(road => road.points.some(q =>
          Math.max(Math.abs(q.x - center.x), Math.abs(q.z - center.z)) < half + 11))) continue;
        const districtIndex = result.filter(n => n.parent === place.id).length;
        const neighborhood = districtIndex === 0 || city && districtIndex % 4 === 0 ? 'business' : city
          ? districtIndex % 4 === 3 ? 'homes' : 'apartments' : 'homes';
        const town = generateTown(map.spec.seed + place.id * 7919 + count * 101, center, {
          grid, junkyard: false, neighborhood,
        });
        town.groundY = level;
        const lines: [number, number, number, number][] = [[p.x, p.z, end.x, end.z]];
        for (const x of town.roadsX) lines.push([x, center.z - half, x, center.z + half]);
        for (const z of town.roadsZ) lines.push([center.x - half, z, center.x + half, z]);
        const roadStart = network.roads.length;
        for (const [lineIndex, [ax, az, bx, bz]] of lines.entries()) {
          const length = Math.hypot(bx - ax, bz - az);
          const n = Math.ceil(length / 6) * 2;
          const points: RoadPoint[] = Array.from({ length: n + 1 }, (_, i) => ({
            x: ax + (bx - ax) * i / n, z: az + (bz - az) * i / n,
            y: lineIndex === 0 ? p.y + (level - p.y) * i / n : level, bridge: false,
          }));
          const road: Road = { id: network.roads.length, local: true, class: 'road', from: place.id, to: place.id, points, length, bridgeLength: 0 };
          network.roads.push(road);
        }
        const trial = [...result, { parent: place.id, town }];
        const localRoads = network.roads.map(road => ({ ...road, points: road.points.filter(q =>
          Math.max(Math.abs(q.x - center.x), Math.abs(q.z - center.z)) < 220) })).filter(road => road.points.length > 1);
        const ground = createGround(map, { roads: localRoads, connected: [], neighborhoods: trial.filter(n =>
          Math.max(Math.abs(n.town.center.x - center.x), Math.abs(n.town.center.z - center.z)) < 180) }, residential);
        const compatible = localRoads.every(road => road.points.every((b, i) => {
          if (!i) return true;
          const a = road.points[i - 1];
          if (a.bridge || b.bridge || Math.hypot(b.x - center.x, b.z - center.z) > 105) return true;
          const length = Math.hypot(b.x - a.x, b.z - a.z);
          if (!length) return true;
          const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
          for (let j = 0; j <= Math.ceil(length); j++) {
            const t = j / Math.ceil(length), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            for (const offset of [-23, -14, -5, 0, 5, 14, 23])
              if (Math.abs(ground.height(x + nx * offset, z + nz * offset) - groundHeight(map, x + nx * offset, z + nz * offset)) > 5.95) return false;
            for (const half of [2, 5])
              if (Math.abs(ground.surface(x + nx * half, z + nz * half) - ground.surface(x - nx * half, z - nz * half)) / (2 * half) > 0.079) return false;
          }
          return true;
        }));
        if (!compatible) {
          network.roads.splice(roadStart);
          continue;
        }
        result.push({ parent: place.id, town });
        count += town.buildings.length;
        if (!r.local) entrances++;
        // Grow connected side-street blocks off accepted local districts as well as the arterial.
        // Their shared junction level is preserved; relief outside these small pads is untouched.
        const extensions: typeof ranked = [];
        for (const road of network.roads.slice(roadStart + 1)) {
          for (const point of [road.points[Math.floor(road.points.length / 2)], road.points[0], road.points.at(-1)!]) {
            if (Math.hypot(point.x - place.x, point.z - place.z) < reach)
              extensions.push({ p: point, r: road, rank: rand() });
          }
        }
        ranked.splice(candidateIndex + 1, 0, ...extensions);
        break;
      }
    }
  }
  return result;
}
