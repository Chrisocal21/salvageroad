import { describe, expect, it } from 'vitest';
import { createRapierSim } from '../src/lab/rapierSim';

// Gentle rolling hills, far from the origin, so the truck has to drive across many ground tiles.
const hills = (x: number, z: number) => 4 * Math.sin(z / 70) + 2.5 * Math.sin(x / 55 + 1);

describe('rolling ground for a big world', () => {
  it('keeps ground under the truck for hundreds of metres, over hills, with nothing missing', async () => {
    const sim = await createRapierSim({ ground: hills, carSpawn: { x: 3000, z: -2000, yaw: 0 } });
    let lowest = Infinity;
    for (let i = 0; i < 60 * 25; i++) {
      sim.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
      const [x, y, z] = sim.chassis().position;
      sim.setFocus!(x, z);
      lowest = Math.min(lowest, y - hills(x, z));
    }
    const [, , z] = sim.chassis().position;
    expect(z - -2000).toBeGreaterThan(300); // it really did drive across new ground
    expect(lowest).toBeGreaterThan(0); // and never dropped through it
  });

  it('is the same as the drawn ground: a heightfield tile sits on the same points as the lattice', async () => {
    const sim = await createRapierSim({ ground: hills, carSpawn: { x: 500, z: 500, yaw: 0 } });
    // Park and let the truck settle: its resting height follows the ground under it.
    for (let i = 0; i < 180; i++) sim.step(1 / 60, { throttle: 0, steer: 0, brake: 1 });
    const [x, y, z] = sim.chassis().position;
    expect(Math.abs(y - hills(x, z) - 0.75)).toBeLessThan(0.45);
  });

  it('does not build the whole world: only ground near the car', async () => {
    const t = performance.now();
    await createRapierSim({ ground: hills, carSpawn: { x: -4000, z: 4000, yaw: 0 } });
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
