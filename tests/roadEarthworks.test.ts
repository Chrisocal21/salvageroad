import { expect, it } from 'vitest';
import { generateWorld, groundHeight, KIND, NO_WATER } from '../src/rules/world';
import { planPlaces } from '../src/rules/places';
import { MAX_ROAD_EARTHWORK, planRoads, ROAD_SPEC } from '../src/rules/roads';
import { createGround } from '../src/rules/ground';
import { createRapierSim } from '../src/lab/rapierSim';
import { restoreMountains } from '../src/rules/mountains';

it('bounds every constructed road formation and crossfall across five seeds, with driving smoke tests', async () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    const map = generateWorld({ seed, size: 12000, cells: 640 });
    const plan = planPlaces(map);
    const network = planRoads(map, plan);
    const draft = map.ground.slice();
    const water = map.water.slice();
    restoreMountains(map, plan, network);
    let restored = 0, retained = 0, original = 0;
    for (let i = 0; i < draft.length; i++) {
      restored = Math.max(restored, map.ground[i] - draft[i]);
      if (map.ground[i] > draft[i] + 20) retained++;
      if (map.ground[i] > 200 && Math.abs(map.ground[i] - map.mountainRelief[i]) < 0.001) original++;
      const downstream = map.flowTo[i];
      if (downstream >= 0)
        expect(map.drainageSurface[downstream]).toBeLessThanOrEqual(map.drainageSurface[i] + 0.001);
    }
    console.log(JSON.stringify({ seed, restored, retained, original, highest: map.stats.highest }));
    expect(restored).toBeGreaterThan(100);
    expect(retained).toBeGreaterThan(1000);
    expect(original).toBeGreaterThan(100);
    expect(map.stats.highest).toBeGreaterThan(300);
    expect(map.water).toEqual(water);
    const ground = createGround(map, network, plan.places.filter(p => p.id !== 0 && ['city', 'town', 'village'].includes(p.kind)));
    let squared = 0, count = 0, maximum = 0, grade = 0, crossfall = 0, cut = 0, fill = 0;
    let worst = {}, worstCrossfall = {};
    for (const road of network.roads) {
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        grade = Math.max(grade, Math.abs(b.y - a.y) / length / ROAD_SPEC[road.class].maxGrade);
        if (a.bridge && b.bridge) continue;
        const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
        const samples = Math.ceil(length);
        for (let j = 0; j <= samples; j++) {
          const t = j / samples;
          const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          for (const offset of [-23, -14, -5, -2.5, 0, 2.5, 5, 14, 23]) {
            const natural = groundHeight(map, x + nx * offset, z + nz * offset);
            const built = ground.height(x + nx * offset, z + nz * offset);
            const target = Math.abs(offset) <= 5 ? y : built;
            const delta = Math.max(Math.abs(target - natural), Math.abs(built - natural));
            cut = Math.max(cut, natural - target, natural - built);
            fill = Math.max(fill, target - natural, built - natural);
            squared += delta * delta; count++;
            if (delta > maximum) { maximum = delta; worst = { road: road.id, class: road.class, x, z, offset, y, natural }; }
          }
          for (const half of [2, 5]) {
            const value = Math.abs(ground.surface(x + nx * half, z + nz * half) - ground.surface(x - nx * half, z - nz * half)) / (2 * half);
            if (value > crossfall) { crossfall = value; worstCrossfall = { road: road.id, class: road.class, x, z, half, i }; }
          }
        }
      }
    }
    console.log(JSON.stringify({ seed, rms: Math.sqrt(squared / count), maximum, cut, fill, grade, crossfall, worst, worstCrossfall }));
    expect(network.connected).toHaveLength(plan.places.length);
    expect(plan.places.filter(p => p.kind === 'outpost')).toHaveLength(6);
    expect(plan.places.filter(p => p.kind === 'lookout')).toHaveLength(5);
    expect(new Set(network.roads.map(r => r.class))).toEqual(new Set(['road', 'dirt', 'trail']));
    expect(maximum).toBeLessThanOrEqual(MAX_ROAD_EARTHWORK + 1e-6);
    expect(grade).toBeLessThanOrEqual(1.001);
    expect(crossfall).toBeLessThanOrEqual(0.08);
    const points = network.roads[0].points;
    const start = points.findIndex((a, i) => {
      if (i + 14 >= points.length || points.slice(i, i + 15).some(p => p.bridge)) return false;
      const b = points[i + 14];
      return Math.hypot(b.x - a.x, b.z - a.z) > 125.9 && Math.abs(b.y - a.y) > 4;
    });
    expect(start).toBeGreaterThanOrEqual(0);
    const a = points[start], b = points[start + 14];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    const sim = await createRapierSim({ ground: ground.surface, carSpawn: { x: a.x, z: a.z, yaw: Math.atan2(dx, dz) } });
    for (let i = 0; i < 120; i++) sim.step(1 / 60, { throttle: 0, steer: 0, brake: 1 });
    for (let i = 0; i < 240; i++) sim.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    const [x, y, z] = sim.chassis().position;
    const forward = (x - a.x) * dx + (z - a.z) * dz;
    const lateral = Math.abs((x - a.x) * dz - (z - a.z) * dx);
    const clearance = y - ground.surface(x, z);
    console.log(JSON.stringify({ seed, drivingMetres: forward, lateral, clearance }));
    expect(forward).toBeGreaterThan(8);
    expect(lateral).toBeLessThan(3);
    expect(clearance).toBeGreaterThan(0.3);
    expect(clearance).toBeLessThan(1.5);
  }
}, 300000);

it('fails explicitly instead of dropping a settlement when terrain has no feasible surface corridor', () => {
  const map = generateWorld({ seed: 1, size: 12000, cells: 256 });
  const plan = planPlaces(map);
  const town = plan.places[0];
  for (let row = 0; row < map.n; row++) for (let col = 0; col < map.n; col++) {
    const distance = Math.hypot(-map.half + col * map.spacing - town.x, -map.half + row * map.spacing - town.z);
    if (distance < 250 || distance > 600) continue;
    const i = row * map.n + col;
    map.ground[i] = town.height + 1000;
    map.water[i] = NO_WATER;
    map.kind[i] = KIND.land;
  }
  expect(() => planRoads(map, plan)).toThrow(/Cannot route/);
});
