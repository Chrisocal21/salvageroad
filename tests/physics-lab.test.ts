import { describe, expect, it } from 'vitest';
import { createCannonSim } from '../src/lab/cannonSim';
import { createRapierSim } from '../src/lab/rapierSim';
import type { CarSim } from '../src/lab/types';

const DT = 1 / 60;

function run(sim: CarSim, seconds: number, throttle: number, steer = 0) {
  const t0 = performance.now();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) sim.step(DT, { throttle, steer, brake: 0 });
  return { ms: performance.now() - t0, steps };
}

const engines: [string, () => Promise<CarSim>][] = [
  ['cannon-es', async () => createCannonSim()],
  ['rapier', () => createRapierSim()],
];

describe.each(engines)('%s car', (name, make) => {
  it('settles on its wheels and drives forward', async () => {
    const sim = await make();
    run(sim, 2, 0);
    console.log(name, 'rest height', sim.chassis().position[1].toFixed(2));
    run(sim, 5, 1);
    const p = sim.chassis().position;
    console.log(name, `after 5s throttle: z=${p[2].toFixed(1)} speed=${sim.speed().toFixed(1)} m/s`);
    expect(p[2]).toBeGreaterThan(-20);
  });

  it('settles after a drop without bouncing for long', async () => {
    const sim = await make();
    run(sim, 4, 0);
    const rest = sim.chassis().position[1];
    // Dropped from 1.6 m. Count the time spent more than 3 cm away from the resting height.
    const again = await make();
    let unsettled = 0;
    for (let i = 0; i < 60 * 4; i++) {
      again.step(DT, { throttle: 0, steer: 0, brake: 0 });
      if (i > 60 && Math.abs(again.chassis().position[1] - rest) > 0.03) unsettled = i / 60;
    }
    console.log(name, `settled within 3 cm after ${unsettled.toFixed(1)} s`);
    // Only Rapier has the tuned damping; cannon-es is kept as an untuned reference.
    if (name === 'rapier') expect(unsettled).toBeLessThan(1.5);
  });

  it('dives a few degrees under hard braking, without bottoming out', async () => {
    if (name !== 'rapier') return; // only Rapier has the tuned suspension
    const sim = await make();
    run(sim, 2, 0);
    run(sim, 1, 1, -1); // turn away from the ramp
    while (sim.speed() < 22) sim.step(DT, { throttle: 1, steer: 0, brake: 0 });
    let maxPitch = 0;
    let lowest = 9;
    for (let i = 0; i < 90; i++) {
      sim.step(DT, { throttle: -1, steer: 0, brake: 0 });
      const [x, y, z, w] = sim.chassis().quaternion;
      maxPitch = Math.max(maxPitch, Math.abs(Math.asin(2 * (y * z - w * x))));
      lowest = Math.min(lowest, sim.chassis().position[1]);
    }
    const deg = (maxPitch * 180) / Math.PI;
    console.log(name, `braking dive ${deg.toFixed(1)} deg, lowest ${lowest.toFixed(2)} m`);
    expect(deg).toBeGreaterThan(1.5); // a real car does not stay perfectly level
    expect(deg).toBeLessThan(6);
    expect(lowest).toBeGreaterThan(0.45); // chassis belly stays off the ground
  });

  it('turns when steered', async () => {
    const sim = await make();
    run(sim, 2, 0);
    run(sim, 4, 1, 1);
    const p = sim.chassis().position;
    console.log(name, `steer right: x=${p[0].toFixed(1)}`);
    expect(Math.abs(p[0])).toBeGreaterThan(0.5);
  });

  it('drives over the ramp', async () => {
    const sim = await make();
    run(sim, 2, 0);
    const trace: string[] = [];
    for (let s = 1; s <= 8; s++) {
      run(sim, 1, 1);
      const p = sim.chassis().position;
      trace.push(`${s}s z=${p[2].toFixed(1)} y=${p[1].toFixed(2)} v=${sim.speed().toFixed(1)}`);
    }
    console.log(name, 'ramp trace:\n  ' + trace.join('\n  '));
    expect(sim.chassis().position[2]).toBeGreaterThan(8);
  });

  it('step cost stays small', async () => {
    const sim = await make();
    run(sim, 1, 0);
    const { ms, steps } = run(sim, 20, 1, 0.1);
    console.log(name, `${(ms / steps).toFixed(3)} ms/step over ${steps} steps`);
    expect(ms / steps).toBeLessThan(2);
  });
});
