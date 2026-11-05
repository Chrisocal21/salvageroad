import { describe, expect, it } from 'vitest';
import { generateWorld, groundHeight, KIND, kindAt, waterLevel } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { gatesOf, planRoads, ROAD_SPEC } from '../src/rules/roads';

// Each seed makes a whole island, so a few seeds are enough.
const SEEDS = [1, 2, 3];
const ROUTE_SEEDS = [...SEEDS, 7, 42];
const worlds = new Map(ROUTE_SEEDS.map((seed) => [seed, generateWorld({ seed, size: 12000, cells: 640 })]));
const plans = new Map(ROUTE_SEEDS.map((seed) => [seed, planPlaces(worlds.get(seed)!)]));
const networks = new Map(ROUTE_SEEDS.map((seed) => [seed, planRoads(worlds.get(seed)!, plans.get(seed)!)]));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('the road network', () => {
  it('always makes the same network for the same seed', () => {
    const again = planRoads(worlds.get(1)!, plans.get(1)!);
    const mine = networks.get(1)!;
    expect(again.roads.length).toBe(mine.roads.length);
    expect(again.roads.map((r) => [r.class, r.from, r.to, r.length])).toEqual(mine.roads.map((r) => [r.class, r.from, r.to, r.length]));
  }, 30000);

  it('connects every place to the starting town', () => {
    for (const seed of SEEDS) {
      const plan = plans.get(seed)!;
      const network = networks.get(seed)!;
      expect(network.connected.sort((a, b) => a - b), `seed ${seed}`).toEqual(plan.places.map((p) => p.id));
    }
  });

  it('has exactly one continuous main road visiting every settlement once', () => {
    for (const seed of ROUTE_SEEDS) {
      const plan = plans.get(seed)!;
      const network = networks.get(seed)!;
      const main = network.roads.filter((r) => r.via);
      expect(main, `seed ${seed}`).toHaveLength(1);
      const road = main[0];
      const settlements = plan.places.filter((p) => p.kind !== 'outpost' && p.kind !== 'lookout');
      expect(road.via!.slice().sort((a, b) => a - b)).toEqual(settlements.map((p) => p.id));
      expect(road.from).toBe(road.via![0]);
      expect(road.to).toBe(road.via![road.via!.length - 1]);
      let visited = 0;
      for (const id of road.via!) {
        const place = plan.places[id];
        const next = road.points.findIndex((p, i) => i >= visited && dist(p, place) < place.radius);
        expect(next, `${place.name}, seed ${seed}`).toBeGreaterThanOrEqual(visited);
        visited = next;
      }
      for (let i = 1; i < road.points.length; i++) expect(dist(road.points[i - 1], road.points[i])).toBeLessThan(worlds.get(seed)!.spacing * 3);
    }
  });

  it('does not double back over or braid the main road into parallel copies', () => {
    for (const seed of ROUTE_SEEDS) {
      const road = networks.get(seed)!.roads[0];
      const cells = new Map<string, number[]>();
      const clearance = ROAD_SPEC[road.class].width + 2;
      for (let i = 0; i < road.points.length; i++) {
        const p = road.points[i];
        const x = Math.floor(p.x / clearance);
        const z = Math.floor(p.z / clearance);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            for (const j of cells.get(`${x + dx}:${z + dz}`) ?? []) {
              if (i - j < 30) continue; // neighbouring points on an ordinary bend
              expect(dist(p, road.points[j]), `seed ${seed}, points ${j} and ${i}`).toBeGreaterThan(clearance);
            }
          }
        }
        const key = `${x}:${z}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(i);
        else cells.set(key, [i]);
      }
    }
  });

  it('gives each outpost and lookout one access road ending exactly on the existing network', () => {
    for (const seed of ROUTE_SEEDS) {
      const plan = plans.get(seed)!;
      const roads = networks.get(seed)!.roads;
      const access = plan.places.filter((p) => p.kind === 'outpost' || p.kind === 'lookout');
      expect(roads.length).toBeGreaterThan(access.length + 1);
      expect(roads.slice(1, access.length + 1).map((r) => r.from).sort((a, b) => a - b)).toEqual(access.map((p) => p.id));
      for (let i = 1; i < roads.length; i++) {
        if (roads[i].local) continue; // district street graphs are tested separately
        const end = roads[i].points[roads[i].points.length - 1];
        const lands = roads.slice(0, i).some((r) => r.points.some((p) => dist(p, end) < 0.001 && Math.abs(p.y - end.y) < 0.001));
        expect(lands, `seed ${seed}, road ${roads[i].id}`).toBe(true);
      }
    }
  });

  it('connects both ends of additional loop roads at matching network elevations', () => {
    for (const seed of ROUTE_SEEDS) {
      const roads = networks.get(seed)!.roads;
      const accessCount = plans.get(seed)!.places.filter(p => p.kind === 'outpost' || p.kind === 'lookout').length;
      const loops = roads.slice(accessCount + 1).filter(r => !r.local);
      expect(loops.length, `seed ${seed}`).toBeGreaterThan(0);
      console.log(JSON.stringify({
        seed, roads: roads.length, addedLoops: loops.length,
        addedKilometres: loops.reduce((sum, road) => sum + road.length, 0) / 1000,
      }));
      for (const road of loops) for (const end of [road.points[0], road.points[road.points.length - 1]]) {
        expect(roads.slice(0, road.id).some(r => r.points.some(p =>
          dist(p, end) < 0.001 && Math.abs(p.y - end.y) < 0.001)), `seed ${seed}, loop ${road.id}`).toBe(true);
      }
    }
  });

  it('keeps the continuous road on existing streets and at street level inside Sunrise', () => {
    for (const seed of ROUTE_SEEDS) {
      const world = worlds.get(seed)!;
      const town = world.settlement.town;
      const gates = gatesOf(world, plans.get(seed)!.places[0]);
      const points = networks.get(seed)!.roads[0].points.filter((p) => Math.abs(p.x - town.x) < 42.01 && Math.abs(p.z - town.z) < 42.01);
      expect(points.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const p of points) {
        const onStreet = gates.some((g) => Math.abs(p.x - g.x) < 0.01 || Math.abs(p.z - g.z) < 0.01);
        expect(onStreet, `seed ${seed}`).toBe(true);
        expect(p.y).toBeCloseTo(town.height, 2);
      }
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
    for (const seed of ROUTE_SEEDS) {
      for (const road of networks.get(seed)!.roads) {
        const spec = ROAD_SPEC[road.class];
        for (let i = 1; i < road.points.length; i++) {
          const a = road.points[i - 1];
          const b = road.points[i];
          const run = Math.hypot(b.x - a.x, b.z - a.z);
          if (run < 1e-6) continue;
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

  it('bridges over water with short dry abutments and the deck above water', () => {
    for (const seed of ROUTE_SEEDS) {
      const world = worlds.get(seed)!;
      for (const road of networks.get(seed)!.roads) {
        for (const p of road.points) {
          if (!p.bridge) continue;
          const water = waterLevel(world, p.x, p.z);
          if (water === null) {
            expect(road.points.some(q => dist(p, q) <= 27.01 && waterLevel(world, q.x, q.z) !== null), `dry abutment, road ${road.id} seed ${seed}`).toBe(true);
            continue;
          }
          expect(p.y, `road ${road.id} seed ${seed}`).toBeGreaterThan(water! + 0.5);
        }
        for (let i = 1; i < road.points.length; i++) {
          if (road.points[i - 1].bridge && road.points[i].bridge) {
            expect(Math.abs(road.points[i].y - road.points[i - 1].y) / dist(road.points[i], road.points[i - 1])).toBeLessThanOrEqual(ROAD_SPEC[road.class].maxGrade + 1e-6);
          }
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
