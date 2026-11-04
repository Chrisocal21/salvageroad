import { describe, expect, it } from 'vitest';
import { planPlaces, DEFAULT_PLAN } from '../src/rules/places';
import { generateWorld, groundHeight, KIND, kindAt, waterLevel } from '../src/rules/world';

// Each seed makes a whole island, so a few seeds are enough.
const SEEDS = [1, 2, 3];
const worlds = new Map(SEEDS.map((seed) => [seed, generateWorld({ seed, size: 12000, cells: 640 })]));
const plans = new Map(SEEDS.map((seed) => [seed, planPlaces(worlds.get(seed)!)]));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('where the places go', () => {
  it('always makes the same plan for the same seed', () => {
    const again = planPlaces(worlds.get(1)!);
    expect(again.places.map((p) => [p.kind, p.x, p.z])).toEqual(plans.get(1)!.places.map((p) => [p.kind, p.x, p.z]));
  });

  it('starts with the starting town, then has at least two docks', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      const plan = plans.get(seed)!;
      expect(plan.places[0].kind).toBe('town');
      expect([plan.places[0].x, plan.places[0].z]).toEqual([world.settlement.town.x, world.settlement.town.z]);
      expect(plan.docks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has the number of each kind of place that was asked for', () => {
    for (const seed of SEEDS) {
      const count = (kind: string) => plans.get(seed)!.places.filter((p) => p.kind === kind).length;
      expect(count('city')).toBe(DEFAULT_PLAN.cities);
      expect(count('town')).toBe(DEFAULT_PLAN.towns + 1); // plus the starting town
      expect(count('village')).toBe(DEFAULT_PLAN.villages);
      expect(count('industrial')).toBe(DEFAULT_PLAN.industrial);
      expect(count('outpost')).toBeGreaterThanOrEqual(DEFAULT_PLAN.outposts - 1);
    }
  });

  it('puts every place on dry land, apart from the others', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      const { places } = plans.get(seed)!;
      for (const p of places) {
        expect(waterLevel(world, p.x, p.z), `${p.name} on seed ${seed}`).toBeNull();
        expect(groundHeight(world, p.x, p.z), `${p.name} on seed ${seed}`).toBeGreaterThan(0.5);
      }
      for (let i = 0; i < places.length; i++) {
        for (let j = i + 1; j < places.length; j++) {
          const min = places[i].kind === 'lookout' || places[j].kind === 'lookout' ? 700 : 900;
          expect(dist(places[i], places[j]), `${places[i].name} and ${places[j].name} on seed ${seed}`).toBeGreaterThan(min);
        }
      }
    }
  });

  it('puts the docks on the coast, with deep open water off the quay and dry land behind', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      for (const dock of plans.get(seed)!.docks) {
        const { shore, seaward } = dock;
        expect(Math.hypot(seaward.x, seaward.z)).toBeCloseTo(1, 5);
        for (const d of [60, 140, 240]) {
          const x = shore.x + seaward.x * d;
          const z = shore.z + seaward.z * d;
          expect(kindAt(world, x, z), `${dock.name} ${d} m out, seed ${seed}`).toBe(KIND.ocean);
          expect(groundHeight(world, x, z)).toBeLessThan(-2);
        }
        expect(groundHeight(world, shore.x, shore.z)).toBeGreaterThan(0);
        expect(dist(dock, shore)).toBeLessThan(130); // the yard is just behind the quay
      }
    }
  });

  it('keeps the two docks far apart, and not at the starting town', () => {
    for (const seed of SEEDS) {
      const { docks, places } = plans.get(seed)!;
      expect(dist(docks[0], docks[1])).toBeGreaterThan(3500);
      for (const d of docks) expect(dist(d, places[0])).toBeGreaterThan(2500);
    }
  });
});
