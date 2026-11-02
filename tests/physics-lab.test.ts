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
