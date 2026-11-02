import RAPIER from '@dimforge/rapier3d-compat';
import { describe, expect, it } from 'vitest';
import { createRapierSim, heightfieldDesc } from '../src/lab/rapierSim';
import { buildTerrainGrid, terrainHeight } from '../src/rules/terrain';
import { scatterProps } from '../src/rules/scatter';

describe('physics ground matches the visible terrain', () => {
  it('has the same height as the height function at many points, rows and columns not swapped', async () => {
    await RAPIER.init();
    const grid = buildTerrainGrid();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(heightfieldDesc(grid));
    world.step();

    let checked = 0;
    let worst = 0;
    // Points well outside the flat zone, where x and z differ a lot so a swap would show.
    for (const [x, z] of [[150, -80], [-120, 160], [90, 170], [-170, -60], [160, 40], [-60, -170]]) {
      const ray = new RAPIER.Ray({ x, y: 50, z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 100, true);
      expect(hit).not.toBeNull();
      const y = 50 - hit!.timeOfImpact;
      worst = Math.max(worst, Math.abs(y - terrainHeight(grid.spec.seed, x, z)));
      checked++;
    }
    console.log(`checked ${checked} points, worst difference ${worst.toFixed(3)} m`);
    // The grid spacing is 2 m, so a ray between vertices may differ a little from the smooth function.
    expect(worst).toBeLessThan(0.25);
  });

  it('lets the car drive on the terrain and stops it at a prop', async () => {
    const grid = buildTerrainGrid();
    const sim = await createRapierSim({ terrain: grid, props: scatterProps(5, 300, grid.spec.size, 45) });
    for (let i = 0; i < 120; i++) sim.step(1 / 60, { throttle: 0, steer: 0, brake: 0 });
    expect(sim.chassis().position[1]).toBeGreaterThan(0.5);
    expect(sim.chassis().position[1]).toBeLessThan(1);
    for (let i = 0; i < 60 * 8; i++) sim.step(1 / 60, { throttle: 1, steer: -0.3, brake: 0 });
    expect(Number.isFinite(sim.chassis().position[0])).toBe(true);
    expect(sim.chassis().position[1]).toBeGreaterThan(-5);
  });
});
