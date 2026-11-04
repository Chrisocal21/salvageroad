import { describe, expect, it } from 'vitest';
import { createRapierSim } from '../src/lab/rapierSim';
import type { CarSim } from '../src/lab/types';
import type { BuildBox } from '../src/rules/baseWorld';

// A container 30 m ahead of the lab spawn point, across the truck's path.
const wall: BuildBox = { x: 0, z: 30, hx: 4, hz: 1.2, y0: 0, height: 2.59 };

function driveFor(sim: CarSim, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
}

describe('built containers and the truck', () => {
  it('drives through the gap when nothing is built', async () => {
    const sim = await createRapierSim({});
    driveFor(sim, 8);
    expect(sim.chassis().position[2]).toBeGreaterThan(30);
  });

  it('is stopped by a container that was there from the start', async () => {
    const sim = await createRapierSim({ buildBoxes: [wall] });
    driveFor(sim, 8);
    expect(sim.chassis().position[2]).toBeLessThan(30 - wall.hz);
  });

  it('is stopped by a container added while the world runs, and passes once it is removed', async () => {
    const sim = await createRapierSim({});
    sim.setBuildBoxes!([wall]);
    driveFor(sim, 8);
    const stoppedAt = sim.chassis().position[2];
    expect(stoppedAt).toBeLessThan(30 - wall.hz);
    sim.setBuildBoxes!([]);
    driveFor(sim, 4);
    expect(sim.chassis().position[2]).toBeGreaterThan(stoppedAt + 3);
  });

  it('can drive under a container raised high enough', async () => {
    const sim = await createRapierSim({ buildBoxes: [{ ...wall, y0: 2.59 * 2 }] });
    driveFor(sim, 8);
    expect(sim.chassis().position[2]).toBeGreaterThan(30);
  });
});
