import { expect, it } from 'vitest';
import { generateWorld, isDryFootprint, KIND, waterLevel } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { planRoads } from '../src/rules/roads';
import { generateSettlements } from '../src/rules/settlements';
import { createGround } from '../src/rules/ground';
import { generateTown, LOT, reachableContainers, storeAt } from '../src/rules/town';
import { stepWalker } from '../src/rules/walker';
import { createInventory } from '../src/rules/inventory';
import { newContainerState, openContainer } from '../src/rules/loot';

it('rejects a wet corner even when a footprint center is dry and well above sea level', () => {
  const map = generateWorld({ seed: 1, size: 12000, cells: 640 });
  const box = { ...map.settlement.town, hx: 40, hz: 40 };
  expect(isDryFootprint(map, box)).toBe(true);
  const c = Math.floor((box.x + map.half) / map.spacing) + 2;
  const r = Math.floor((box.z + map.half) / map.spacing) + 2;
  const i = r * map.n + c;
  map.water[i] = map.ground[i] + 1;
  map.kind[i] = KIND.lake;
  expect(waterLevel(map, box.x, box.z)).toBeNull();
  expect(isDryFootprint(map, box)).toBe(false);
  expect(isDryFootprint(map, { x: map.half, z: 0, hx: 10, hz: 10 })).toBe(false);
});

it('organizes six homes into two street-facing rows with a shared rear garden strip', () => {
  const town = generateTown(7, { x: 130, z: -230 }, { grid: 2, junkyard: false, neighborhood: 'homes', containerOffset: 100 });
  expect(town.districtKind).toBe('homes');
  expect(town.buildings).toHaveLength(6);
  expect(town.roadsX).toHaveLength(2);
  expect(town.roadsZ).toHaveLength(2);
  expect(town.lawns).toHaveLength(7);
  expect(town.trees).toHaveLength(8);
  for (const tree of town.trees!) expect(town.solids.some(s => s.x === tree.x && s.z === tree.z && s.hx === 0.2)).toBe(true);
  expect(new Set(town.containers.map(c => c.id)).size).toBe(town.containers.length);
  expect(town.containers.filter(c => c.kind === 'crate')).toHaveLength(6);
  expect(town.containers.filter(c => c.kind === 'wood_bundle')).toHaveLength(1);
  expect(Math.min(...town.containers.map(c => c.id))).toBe(100);
  for (const b of town.buildings) {
    const side = Math.sign(b.z - town.center.z);
    expect(Math.cos(b.front!)).toBe(side);
    expect(b.store).toBeUndefined();
    expect(Math.abs(b.z - town.center.z) - b.hz).toBeGreaterThan(6);
    const front = { x: b.x, z: town.center.z + side * (LOT - 5) };
    expect(town.solids.some(s => Math.abs(front.x - s.x) < s.hx + 1 && Math.abs(front.z - s.z) < s.hz + 1)).toBe(false);
  }
});

it('shares a shopping promenade and parking court while keeping each shop separately enterable and lootable', () => {
  const town = generateTown(3, { x: 200, z: -300 }, { grid: 2, junkyard: false, neighborhood: 'business', containerOffset: 200 });
  expect(town.districtKind).toBe('shopping');
  expect(town.parking).toBeDefined();
  expect(town.buildings).toHaveLength(4);
  expect(town.roadsX).toHaveLength(2);
  expect(new Set(town.buildings.map(b => b.z)).size).toBe(1);
  for (const [i, b] of town.buildings.entries()) {
    expect(b.front).toBe(0);
    if (i) expect(b.x - b.hx - (town.buildings[i - 1].x + town.buildings[i - 1].hx)).toBeCloseTo(0.1);
    const walker = { x: b.x, z: town.center.z + 20, yaw: Math.PI, pitch: 0 };
    for (let frame = 0; frame < 1200 && storeAt(town, walker.x, walker.z) === null; frame++)
      stepWalker(walker, { forward: 1, right: 0, run: false }, 1 / 60, [...town.solids, ...town.containers], []);
    expect(storeAt(town, walker.x, walker.z)).toBe(b.id);
    const shelves = reachableContainers(town, walker.x, walker.z);
    expect(shelves.length).toBeGreaterThan(0);
    expect(shelves.every(c => c.inside === b.id && c.id >= 200)).toBe(true);
    expect(openContainer(newContainerState(shelves[0].kind), 3, shelves[0].id, createInventory()).taken.length).toBeGreaterThan(0);
  }
  for (let x = town.center.x - 20; x <= town.center.x + 20; x++) {
    expect(town.solids.some(s => Math.abs(x - s.x) < s.hx + 1.5 && Math.abs(town.center.z + 16 - s.z) < s.hz + 1.5)).toBe(false);
  }
});

for (const seed of [1, 2, 3, 7, 42]) it(`expands connected local neighbourhoods without giant pads: seed ${seed}`, () => {
  const map = generateWorld({ seed, size: 12000, cells: 640 });
  const plan = planPlaces(map), network = planRoads(map, plan);
  const places = plan.places.filter(p => p.id !== 0 && ['city', 'town', 'village'].includes(p.kind));
  const ground = createGround(map, network, places);
  const towns = generateSettlements(seed, map, plan, network);
  const ids = towns.flatMap(t => t.containers.map(c => c.id));
  expect(new Set(ids).size).toBe(ids.length);
  const measurements = places.map(p => {
    const districts = network.neighborhoods!.filter(n => n.parent === p.id);
    const core = towns[plan.places.filter(q => ['city', 'town', 'village'].includes(q.kind)).findIndex(q => q.id === p.id)];
    const buildings = [...core.buildings, ...districts.flatMap(d => d.town.buildings)];
    const xs = [core.roadsX[0], core.roadsX.at(-1)!, ...districts.flatMap(d => d.town.roadsX)];
    const zs = [core.roadsZ[0], core.roadsZ.at(-1)!, ...districts.flatMap(d => d.town.roadsZ)];
    const coreWidth = core.roadsX.at(-1)! - core.roadsX[0];
    return { name: p.name, kind: p.urban ? 'urban' : p.kind, districts: districts.length,
      developedArea: coreWidth ** 2 + districts.reduce((sum, d) => sum + (d.town.roadsX.at(-1)! - d.town.roadsX[0]) ** 2, 0),
      width: Math.round(Math.max(...xs) - Math.min(...xs)), depth: Math.round(Math.max(...zs) - Math.min(...zs)),
      buildings: buildings.length, businesses: buildings.filter(b => b.store).length,
      homes: buildings.filter(b => b.housing === 'home').length, apartments: buildings.filter(b => b.housing === 'apartments').length };
  });
  console.log(JSON.stringify({ seed, measurements }));
  expect(network.neighborhoods!.length).toBeGreaterThan(10);
  const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)}:${p.z.toFixed(3)}`;
  const graph = new Map<string, Set<string>>();
  const frontier: string[] = [];
  for (const road of network.roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = key(road.points[i - 1]), b = key(road.points[i]);
      if (!graph.has(a)) graph.set(a, new Set());
      if (!graph.has(b)) graph.set(b, new Set());
      graph.get(a)!.add(b); graph.get(b)!.add(a);
    }
    if (!road.local) frontier.push(...road.points.map(key));
  }
  const connected = new Set(frontier);
  const arterial = new Set(frontier);
  for (const a of frontier) for (const b of graph.get(a) ?? []) if (!connected.has(b)) {
    connected.add(b); frontier.push(b);
  }
  for (const road of network.roads.filter(r => r.local)) {
    expect(road.points.every(p => connected.has(key(p)))).toBe(true);
    for (const p of road.points) expect(waterLevel(map, p.x, p.z)).toBeNull();
    const homes = network.neighborhoods!.filter(n => n.parent === road.from).flatMap(n => [...n.town.solids, ...n.town.containers]);
    for (const p of road.points) expect(homes.some(b => Math.abs(p.x - b.x) < b.hx + 1.5 && Math.abs(p.z - b.z) < b.hz + 1.5)).toBe(false);
  }
  for (const m of measurements) {
    const place = places.find(p => p.name === m.name)!;
    const entrances = new Set(network.roads.filter(r => r.local && r.from === place.id &&
      arterial.has(key(r.points[0]))).map(r => key(r.points[0])));
    expect(entrances.size).toBeLessThanOrEqual(m.kind === 'city' || m.kind === 'urban' ? 4 : m.kind === 'town' ? 3 : 2);
    const before = m.kind === 'city' || m.kind === 'urban' ? 140 : m.kind === 'town' ? 84 : 56;
    expect(m.width * m.depth / (before * before), m.name).toBeGreaterThan(2.5);
    expect(m.developedArea / (before * before), `${m.name} actual street-block area, excluding gaps`).toBeGreaterThan(2.5);
    expect(m.homes, m.name).toBeGreaterThan(0);
    if (m.kind === 'city' || m.kind === 'urban') {
      expect(m.apartments).toBeGreaterThan(m.homes);
      expect(m.businesses).toBeGreaterThan(8);
      expect(m.buildings).toBeGreaterThan(60);
    }
  }
  const populations = (kind: string) => measurements.filter(m => m.kind === kind).map(m => m.buildings);
  expect(Math.min(...populations('city'), ...populations('urban'))).toBeGreaterThan(Math.max(...populations('town')));
  expect(Math.min(...populations('town'))).toBeGreaterThan(Math.max(...populations('village')));
  expect(new Set(populations('village')).size).toBeGreaterThan(1);
  for (const { town } of network.neighborhoods!) {
    expect(isDryFootprint(map, { ...town.center, hx: LOT + 4.5, hz: LOT + 4.5 }, map.spacing * 3)).toBe(true);
    expect(town.buildings.length).toBeGreaterThanOrEqual(3);
    if (town.districtKind === 'homes') expect(town.buildings).toHaveLength(6);
    if (town.districtKind === 'shopping') {
      expect(town.parking).toBeDefined();
      expect(town.buildings.every(b => b.store && b.front === 0)).toBe(true);
    }
    expect(town.roadsX).toHaveLength(town.districtKind === 'apartments' ? 3 : 2);
    expect(town.roadsZ).toHaveLength(town.districtKind === 'apartments' ? 3 : 2);
    for (const b of town.buildings) {
      expect(b.front).toBeDefined();
      const yaw = b.front!;
      const street = Math.abs(Math.sin(yaw)) > 0.5 ? town.roadsX : town.roadsZ;
      const coordinate = Math.abs(Math.sin(yaw)) > 0.5 ? b.x : b.z;
      expect(Math.min(...street.map(s => Math.abs(s - coordinate)))).toBeLessThan(16);
    }
    for (const box of [...town.solids, ...town.containers]) {
      expect(ground.surface(box.x, box.z)).toBeCloseTo(town.groundY!, 5);
      expect(ground.surface(box.x + box.hx, box.z + box.hz)).toBeCloseTo(town.groundY!, 5);
    }
    for (const b of town.buildings.filter(b => b.store)) {
      if (town.districtKind === 'shopping') expect(b.height).toBeLessThan(6);
      else expect(b.height).toBeGreaterThan(9);
      const yaw = b.front!, depth = Math.abs(Math.sin(yaw)) > 0.5 ? b.hx : b.hz;
      const walker = { x: b.x + Math.sin(yaw) * (depth + 1), z: b.z + Math.cos(yaw) * (depth + 1), yaw: yaw + Math.PI, pitch: 0 };
      for (let frame = 0; frame < 60; frame++) stepWalker(walker, { forward: 1, right: 0, run: false }, 1 / 60, [...town.solids, ...town.containers], []);
      expect(storeAt(town, walker.x, walker.z)).toBe(b.id);
      const shelf = reachableContainers(town, walker.x, walker.z)[0];
      expect(shelf).toBeDefined();
      expect(openContainer(newContainerState(shelf.kind), seed, shelf.id, createInventory()).taken.length).toBeGreaterThan(0);
    }
  }
}, 120000);
