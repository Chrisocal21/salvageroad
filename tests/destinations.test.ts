import { expect, it } from 'vitest';
import { generateDestinations, installDestinationGround, segmentHitsBox } from '../src/rules/destinations';
import type { Plan } from '../src/rules/places';
import type { RoadNetwork } from '../src/rules/roads';
import type { Ground } from '../src/rules/ground';
import { reachableContainers, storeAt } from '../src/rules/town';
import { generateWorld, isDryFootprint } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { planRoads } from '../src/rules/roads';
import { rigSpawns } from '../src/rules/rigBuild';
import { distanceToObb } from '../src/rules/geometry';
import { trailerSpawn } from '../src/rules/trailer';

const plan: Plan = {
  places: [
    { id: 0, kind: 'industrial', name: 'Ironworks', x: 0, z: 0, height: 5, radius: 160 },
    { id: 1, kind: 'outpost', name: 'Old Mill', x: 500, z: 0, height: 5, radius: 40 },
    { id: 2, kind: 'dock', name: 'North Quay', x: 1000, z: 0, height: 5, radius: 150,
      shore: { x: 1000, z: 90 }, seaward: { x: 0, z: 1 } } as Plan['docks'][number],
  ],
  docks: [],
};
const network: RoadNetwork = { connected: [0, 1, 2], roads: plan.places.map(p => ({
  id: p.id, class: 'road', from: p.id, to: p.id, length: 100, bridgeLength: 0,
  points: [{ x: p.x, z: 0, y: 5, bridge: false }, { x: p.x, z: 100, y: 5, bridge: false }],
})) };

it.each([1, 7, 42])('places every real-world destination clear of all formations for seed %i', seed => {
  const world = generateWorld({ seed, size: 12000, cells: 640 });
  const places = planPlaces(world), roads = planRoads(world, places);
  const sites = generateDestinations(seed, places, roads, 100000, world);
  expect(sites.filter(s => s.siteKind === 'salvage')).toHaveLength(3);
  const rigs = rigSpawns(sites);
  expect(rigs).toHaveLength(2);
  const trailer = trailerSpawn(sites);
  expect(rigs.every(r => Math.hypot(r.x - trailer.x, r.z - trailer.z) > 100)).toBe(true);
  expect(sites.filter(s => s.salvage).at(-1)!.salvage!.yard.wrecks.every(w => w.model !== 'big-rig')).toBe(true);
  expect(rigs.every(r => distanceToObb(world.settlement.town.x, world.settlement.town.z, r) > 150)).toBe(true);
  expect(sites).toHaveLength(places.places.filter(p => !['city', 'town', 'village'].includes(p.kind)).length);
  const ids = sites.flatMap(s => [...s.buildings, ...s.containers].map(b => b.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const s of sites) {
    expect(isDryFootprint(world, { ...s.center, hx: 48, hz: 48 }, world.spacing * 3)).toBe(true);
    if (s.salvage) {
      expect(s.salvage.yard.parts).toEqual([]);
      expect(s.containers.every(c => !c.fixedLoot)).toBe(true);
      for (const box of s.solids) expect(segmentHitsBox(s.accessLanes![0].from, s.accessLanes![0].to, box, 1.5)).toBe(false);
    }
  }
  for (const s of sites) for (const box of [...s.buildings, ...s.containers, ...s.fixtures!])
    for (const r of roads.roads) for (let i = 1; i < r.points.length; i++)
      expect(segmentHitsBox(r.points[i - 1], r.points[i], box, 8), `${s.siteKind} ${box.x},${box.z}`).toBe(false);
}, 120000);

it('makes differentiated road-end facilities with unique loot and unobstructed doors and turning courts', () => {
  const sites = generateDestinations(1, plan, network, 200);
  expect(sites.map(s => s.siteKind)).toEqual(['military', 'salvage', 'dock']);
  expect(sites.map(s => s.buildings.length)).toEqual([3, 1, 2]);
  const ids = sites.flatMap(s => s.containers.map(c => c.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(Math.min(...ids)).toBeGreaterThanOrEqual(200);
  for (const s of sites) {
    expect(s.hasJunkyard).toBe(false);
    for (const b of s.buildings) {
      expect(['warehouse', 'barracks']).toContain(b.store);
      expect(storeAt(s, b.x, b.z)).toBe(b.id);
      expect(reachableContainers(s, b.x, b.z)).toHaveLength(3);
      const yaw = b.front!;
      const depth = Math.abs(Math.sin(yaw)) > 0.5 ? b.hx : b.hz;
      const x = b.x + Math.sin(yaw) * depth, z = b.z + Math.cos(yaw) * depth;
      expect(s.solids.some(w => Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz)).toBe(false);
    }
    expect(s.solids.some(b => Math.abs(s.center.x - b.x) < b.hx + 5 && Math.abs(s.center.z - b.z) < b.hz + 5)).toBe(false);
  }
  expect(sites[0].fixtures!.length).toBeGreaterThan(8);
  expect(sites[1].salvage!.yard.wrecks).toHaveLength(6);
  expect(sites[1].salvage!.yard.wrecks.filter(w => w.model === 'big-rig')).toHaveLength(1);
  const [rig] = rigSpawns(sites);
  expect(sites[1].solids.some(box => Math.abs(rig.x - box.x) < rig.hx + box.hx &&
    Math.abs(rig.z - box.z) < rig.hz + box.hz)).toBe(false);
  expect(sites[1].salvage!.yard.fence).toHaveLength(5);
  expect(sites[1].salvage!.yard.parts).toEqual([]);
  expect(plan.places[1].name).toMatch(/Salvage Yard$/);
  expect(sites[1].containers.filter(c => c.inside === undefined)).toHaveLength(1);
  const names = plan.places.map(p => p.name);
  generateDestinations(1, plan, network, 200);
  expect(plan.places.map(p => p.name)).toEqual(names);
  expect(sites[2].quay).toBeDefined();
  expect(sites[2].fixtures!.filter(f => f.height >= 17)).toHaveLength(2);
});

it.each([
  [{ x: -250, z: -250 }, { x: 250, z: 250 }],
  [{ x: -250, z: -100 }, { x: -30, z: 20 }, { x: 80, z: -40 }, { x: 250, z: 160 }],
  [{ x: -250, z: -100 }, { x: 0, z: 0 }],
])('keeps the complete compound clear of diagonal, curving and terminating roads: %j', (...points) => {
  const roads: RoadNetwork = { connected: [0], roads: [{
    id: 0, class: 'road', from: 0, to: 0, length: 500, bridgeLength: 0,
    points: points.map(p => ({ ...p, y: 5, bridge: false })),
  }] };
  for (const kind of ['industrial', 'outpost'] as const) {
    const sites = generateDestinations(9, { places: [{ ...plan.places[0], kind }], docks: [] }, roads, 300);
    const s = sites[0], lane = s.accessLanes![0];
    expect(s.roadsX).toEqual([]);
    expect(s.roadsZ).toEqual([]);
    expect(roads.roads[0].points.slice(1).some((b, i) =>
      segmentHitsBox(roads.roads[0].points[i], b, { ...lane.from, hx: 0.001, hz: 0.001 }))).toBe(true);
    for (const box of [...s.buildings, ...s.containers, ...s.fixtures!]) {
      for (let i = 1; i < roads.roads[0].points.length; i++)
        expect(segmentHitsBox(roads.roads[0].points[i - 1], roads.roads[0].points[i], box, 8)).toBe(false);
    }
    for (const box of [...s.buildings, ...s.fixtures!])
      expect(segmentHitsBox(lane.from, lane.to, box, 6)).toBe(false);
    const g: Ground = { height: () => -3, surface: () => -3, roadDistance: () => Infinity, townHeight: 5 };
    installDestinationGround(g, sites);
    expect(g.surface(lane.to.x, lane.to.z)).toBe(5);
  }
});

it('gives quay and warehouse floors matching walking/driving surfaces, without filling sea terrain', () => {
  const sites = generateDestinations(1, plan, network, 200);
  const g: Ground = { height: () => -3, surface: () => -3, roadDistance: () => Infinity, townHeight: 5 };
  installDestinationGround(g, sites);
  expect(g.height(1000, 90)).toBe(-3);
  expect(g.surface(1000, 90)).toBe(5);
  for (const s of sites) for (const b of s.buildings) {
    expect(g.height(b.x, b.z)).toBe(5);
    expect(g.surface(b.x, b.z)).toBe(5);
  }
});

it('does not regrade an existing road formation for facility foundations', () => {
  const sites = generateDestinations(1, plan, network, 200);
  const height = (x: number, z: number) => 4 + x * 0.01 + z * 0.02;
  const g: Ground = { height, surface: height, roadDistance: () => 10, townHeight: 5 };
  installDestinationGround(g, sites);
  for (const s of sites) for (const b of s.buildings) expect(g.height(b.x, b.z)).toBe(height(b.x, b.z));
});

it('grades the land-side drive and court instead of burying pavement in hillside terrain', () => {
  const sites = generateDestinations(1, plan, network, 200);
  const g: Ground = { height: () => 11, surface: () => 11, roadDistance: () => Infinity, townHeight: 5 };
  installDestinationGround(g, sites);
  for (const s of sites) {
    const lane = s.accessLanes![0];
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const x = lane.from.x + (lane.to.x - lane.from.x) * t;
      const z = lane.from.z + (lane.to.z - lane.from.z) * t;
      expect(g.height(x, z)).toBe(s.groundY);
      expect(g.surface(x, z)).toBe(g.height(x, z));
    }
  }
});
