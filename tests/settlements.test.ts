import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { gatesOf, planRoads } from '../src/rules/roads';
import { createGround } from '../src/rules/ground';
import { generateSettlements, settlementPlaces } from '../src/rules/settlements';
import { generateTown, LOT, reachableContainers, settlementGrid, storeAt, storeInterior } from '../src/rules/town';
import { stepWalker } from '../src/rules/walker';
import { createInventory } from '../src/rules/inventory';
import { newContainerState, openContainer } from '../src/rules/loot';

describe('drive-to-loot settlements', () => {
  it('builds city blocks with a multi-storey skyline instead of another small town', () => {
    const city = generateTown(1, { x: 0, z: 0 }, { grid: settlementGrid('city'), junkyard: false, urban: true });
    expect(city.buildings.length).toBeGreaterThan(18);
    expect(city.roadsX).toHaveLength(6);
    expect(city.roadsZ).toHaveLength(6);
    expect(Math.max(...city.buildings.map(b => b.height))).toBeGreaterThan(30);
    expect(city.buildings.every(b => b.height >= 9.6)).toBe(true);
    expect(city.solids.every(s => s.height >= 9.6)).toBe(true);
    expect(city.buildings.some(b => b.store === 'market')).toBe(true);
  });
  for (const seed of [1, 7, 42]) it(`connects visible, level, lootable places for seed ${seed}`, () => {
    const map = generateWorld({ seed, size: 12000, cells: 640 });
    const plan = planPlaces(map);
    const network = planRoads(map, plan);
    const places = settlementPlaces(map, plan);
    const ground = createGround(map, network, places);
    const towns = generateSettlements(seed, map, plan);
    expect(plan.places.filter(p => p.kind === 'city')).toHaveLength(1);
    if (seed === 1) expect(plan.places.find(p => p.urban)!.z).toBeLessThan(-2500);
    expect(towns[0]).toEqual(generateTown(seed, map.settlement.town));
    const containers = towns.flatMap(t => t.containers);
    expect(new Set(containers.map(c => c.id)).size).toBe(containers.length);
    for (const [i, place] of places.entries()) {
      const town = towns[i + 1];
      expect(town.hasJunkyard).toBe(false);
      expect(town.containers.every(c => !c.fixedLoot)).toBe(true);
      expect(town.roadsX).toHaveLength(settlementGrid(place.kind, place.urban) + 1);
      expect(town.roadsX.at(-1)! - town.roadsX[0]).toBe(settlementGrid(place.kind, place.urban) * LOT);
      const gates = gatesOf(map, place);
      expect(network.roads[0].points.some(p => gates.some(g => Math.hypot(p.x - g.x, p.z - g.z) < 10))).toBe(true);
      for (const box of [...town.solids, ...town.containers]) {
        expect(ground.surface(box.x, box.z)).toBeCloseTo(place.height, 5);
        expect(ground.surface(box.x + box.hx, box.z + box.hz)).toBeCloseTo(place.height, 5);
      }
      for (const p of network.roads[0].points) {
        if (Math.max(Math.abs(p.x - place.x), Math.abs(p.z - place.z)) > settlementGrid(place.kind, place.urban) * LOT / 2) continue;
        expect(p.y).toBeCloseTo(place.height, 5);
        expect([...town.solids, ...town.containers].some(b => Math.abs(p.x - b.x) < b.hx + 1 && Math.abs(p.z - b.z) < b.hz + 1)).toBe(false);
      }
      const market = town.buildings.find(b => b.store === 'market')!;
      expect(market).toBeDefined();
      for (const b of town.buildings.filter(b => b.store)) {
        const yaw = b.front!;
        const depth = Math.abs(Math.sin(yaw)) > 0.5 ? b.hx : b.hz;
        const walker = { x: b.x + Math.sin(yaw) * (depth + 1), z: b.z + Math.cos(yaw) * (depth + 1), yaw: yaw + Math.PI, pitch: 0 };
        for (let frame = 0; frame < 60; frame++) stepWalker(walker, { forward: 1, right: 0, run: false }, 1 / 60, [...town.solids, ...town.containers], []);
        expect(storeAt(town, walker.x, walker.z)).toBe(b.id);
      }
      const inside = storeInterior(market);
      const shelves = reachableContainers(town, inside.x, inside.z);
      expect(shelves.length).toBeGreaterThan(0);
      expect(shelves.every(c => c.inside === market.id)).toBe(true);
      expect(reachableContainers(town, town.roadsX[0], town.roadsZ[0]).some(c => c.inside !== undefined)).toBe(false);
      const state = newContainerState(shelves[0].kind);
      const inventory = createInventory();
      expect(openContainer(state, seed, shelves[0].id, inventory).taken.length).toBeGreaterThan(0);
      expect(openContainer(state, seed, shelves[0].id, inventory).taken).toHaveLength(0);
    }
  }, 60000);
});
