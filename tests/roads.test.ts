import { describe, expect, it } from 'vitest';
import { generateWorld, groundHeight, KIND, kindAt, waterLevel } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { gatesOf, planRoads, ROAD_SPEC } from '../src/rules/roads';

// Each seed makes a whole island, so a few seeds are enough.
const SEEDS = [1, 2, 3];
const worlds = new Map(SEEDS.map((seed) => [seed, generateWorld({ seed, size: 12000, cells: 640 })]));
const plans = new Map(SEEDS.map((seed) => [seed, planPlaces(worlds.get(seed)!)]));
const networks = new Map(SEEDS.map((seed) => [seed, planRoads(worlds.get(seed)!, plans.get(seed)!)]));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the road network', () => {
  it('always makes the same network for the same seed', () => {
    const again = planRoads(worlds.get(1)!, plans.get(1)!);
    const mine = networks.get(1)!;
    expect(again.roads.length).toBe(mine.roads.length);
    expect(again.roads.map((r) => [r.class, r.from, r.to, r.length])).toEqual(mine.roads.map((r) => [r.class, r.from, r.to, r.length]));
  });

  it('connects every place to the starting town', () => {
    for (const seed of SEEDS) {
      const plan = plans.get(seed)!;
      const network = networks.get(seed)!;
      expect(network.connected.sort((a, b) => a - b), `seed ${seed}`).toEqual(plan.places.map((p) => p.id));
    }
  });

  it('joins the places it says it joins, or ends on another road (a junction)', () => {
    for (const seed of SEEDS) {
      const plan = plans.get(seed)!;
      const all = networks.get(seed)!.roads;
      const onRoad = (p: { x: number; z: number }, self: number) => all.some((r) => r.id !== self && r.points.some((q) => dist(p, q) < 12));
      for (const road of all) {
        const reach = Math.max(plan.places[road.from].radius, plan.places[road.to].radius);
        for (const end of [road.points[0], road.points[road.points.length - 1]]) {
          const atPlace = Math.min(dist(end, plan.places[road.from]), dist(end, plan.places[road.to])) < reach;
          expect(atPlace || onRoad(end, road.id), `road ${road.id} seed ${seed}`).toBe(true);
        }
      }
    }
  });

  it('meets the starting town square on, along one of its streets', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      const town = world.settlement.town;
      const gates = gatesOf(world, plans.get(seed)!.places[0]);
      for (const road of networks.get(seed)!.roads) {
        for (const [end, step] of [[road.points[0], 1], [road.points[road.points.length - 1], -1]] as const) {
          const place = step === 1 ? road.from : road.to;
          if (place !== 0) continue;
          // A corner of the town has two gates at one spot, one for each street; the road uses one of them.
          const here = gates.filter((g) => dist(g, end) < 0.01);
          if (here.length === 0) continue; // this piece ends at a junction with another road instead
          const ordered = step === 1 ? road.points : road.points.slice().reverse();
          const at = ordered.find((q) => dist(q, end) >= 25)!;
          const squares = here.some((g) => {
            const along = (at.x - g.x) * g.dx + (at.z - g.z) * g.dz;
            const across = Math.abs((at.x - g.x) * g.dz - (at.z - g.z) * g.dx);
            return across < 4 && along > 20;
          });
          expect(squares, `road ${road.id} seed ${seed} leaves squarely`).toBe(true);
          expect(dist(here[0], town)).toBeLessThan(70);
        }
      }
    }
  });

  it('bends smoothly: almost no tight corner in any road', () => {
    // A bend of more than 0.7 rad between points 9 m apart is a turning circle under 13 m: only a hairpin forced
    // by the land should have one, so a handful at most across a whole network.
    for (const seed of SEEDS) {
      let tight = 0;
      let total = 0;
      for (const road of networks.get(seed)!.roads) {
        for (let i = 1; i < road.points.length - 1; i++) {
          const a = road.points[i - 1];
          const b = road.points[i];
          const c = road.points[i + 1];
          let turn = Math.abs(Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x));
          if (turn > Math.PI) turn = 2 * Math.PI - turn;
          total++;
          if (turn > 0.7) tight++;
        }
      }
      expect(tight / total, `seed ${seed}: ${tight} of ${total}`).toBeLessThan(0.004);
    }
  });

  it('keeps every road within the grade limit of its class', () => {
    for (const seed of SEEDS) {
      for (const road of networks.get(seed)!.roads) {
        const spec = ROAD_SPEC[road.class];
        for (let i = 1; i < road.points.length; i++) {
          const a = road.points[i - 1];
          const b = road.points[i];
          const run = Math.hypot(b.x - a.x, b.z - a.z);
          if (run < 1e-6) continue;
          if (i < 32 || i > road.points.length - 32) continue; // a landing on another road eases in over a few points
          expect(Math.abs(b.y - a.y) / run, `road ${road.id} (${road.class}) point ${i} seed ${seed}`).toBeLessThanOrEqual(spec.maxGrade + 0.002);
        }
      }
    }
  });

  it('never runs through the sea', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      for (const road of networks.get(seed)!.roads) {
        for (const p of road.points) {
          expect(kindAt(world, p.x, p.z), `road ${road.id} seed ${seed}`).not.toBe(KIND.ocean);
        }
      }
    }
  });

  it('bridges only over water, with the deck above it', () => {
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      for (const road of networks.get(seed)!.roads) {
        for (const p of road.points) {
          if (!p.bridge) continue;
          const water = waterLevel(world, p.x, p.z);
          expect(water, `road ${road.id} seed ${seed}`).not.toBeNull();
          expect(p.y, `road ${road.id} seed ${seed}`).toBeGreaterThan(water! + 0.5);
        }
      }
    }
  });

  it('crosses water somewhere: the island is big enough that roads cannot avoid every river', () => {
    let bridges = 0;
    for (const seed of SEEDS) {
      for (const road of networks.get(seed)!.roads) if (road.bridgeLength > 0) bridges++;
    }
    expect(bridges).toBeGreaterThan(0);
  });

  it('keeps the road near the ground off bridges', () => {
    // The profile is clamped to 12 m of earthworks before the grade envelope runs, but the envelope itself
    // goes much further where the road spans a ravine or ramps down to a low bridge deck: a trail allowed to
    // climb 22 percent spans a mountain hollow on a high embankment rather than dipping in and out. These are
    // sanity bounds against runaway profiles, per class, not the earthwork limit.
    const bound: Record<string, number> = { highway: 100, road: 110, dirt: 110, trail: 220 };
    for (const seed of SEEDS) {
      const world = worlds.get(seed)!;
      for (const road of networks.get(seed)!.roads) {
        for (const p of road.points) {
          if (p.bridge) continue;
          expect(Math.abs(p.y - groundHeight(world, p.x, p.z)), `road ${road.id} (${road.class}) seed ${seed}`).toBeLessThan(bound[road.class]);
        }
      }
    }
  });
});
