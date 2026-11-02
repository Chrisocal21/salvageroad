import { describe, expect, it } from 'vitest';
import {
  DRIVING,
  engineForce,
  resistanceForce,
  resolvePedals,
  steerLimit,
  updateSteer,
} from '../src/rules/driving';

describe('engine', () => {
  it('is grip limited at low speed and power limited at high speed', () => {
    expect(engineForce(1, 0)).toBe(DRIVING.maxEngineForce);
    expect(engineForce(1, 30)).toBeCloseTo(DRIVING.enginePower / 30);
    expect(engineForce(1, 30)).toBeLessThan(engineForce(1, 10));
  });

  it('scales with the throttle', () => {
    expect(engineForce(0.5, 0)).toBeCloseTo(DRIVING.maxEngineForce / 2);
  });
});

describe('top speed', () => {
  it('is where engine force meets resistance, between 120 and 200 km/h', () => {
    let v = 0;
    for (let i = 0; i < 60 * 120; i++) {
      v += ((engineForce(1, v) - resistanceForce(v)) / DRIVING.mass) / 60;
    }
    const kmh = v * 3.6;
    expect(kmh).toBeGreaterThan(120);
    expect(kmh).toBeLessThan(200);
  });
});

describe('pedals', () => {
  it('brakes when S is pressed while rolling forward', () => {
    const p = resolvePedals(-1, 0, 15);
    expect(p.brake).toBe(1);
    expect(p.engine).toBe(0);
  });

  it('reverses only once stopped', () => {
    expect(resolvePedals(-1, 0, 0).engine).toBeLessThan(0);
  });

  it('brakes when W is pressed while rolling backwards', () => {
    expect(resolvePedals(1, 0, -3).brake).toBe(1);
  });

  it('limits reverse speed', () => {
    expect(resolvePedals(-1, 0, -DRIVING.maxReverseSpeed - 1).engine).toBe(0);
  });
});

describe('steering', () => {
  it('has less lock at speed', () => {
    expect(steerLimit(0)).toBeCloseTo(DRIVING.steerLockLow);
    expect(steerLimit(DRIVING.steerSpeedRef)).toBeCloseTo(DRIVING.steerLockLow / 2);
    expect(steerLimit(30)).toBeLessThan(steerLimit(10));
  });

  it('eases in instead of snapping to full lock', () => {
    const next = updateSteer(0, 1, 0, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(0.1);
  });

  it('reaches full lock in a fraction of a second', () => {
    let a = 0;
    for (let i = 0; i < 30; i++) a = updateSteer(a, 1, 0, 1 / 60);
    expect(a).toBeCloseTo(DRIVING.steerLockLow);
  });

  it('returns to centre when released', () => {
    let a = 0.4;
    for (let i = 0; i < 60; i++) a = updateSteer(a, 0, 0, 1 / 60);
    expect(a).toBe(0);
  });

  it('shrinks the angle if you speed up while turned', () => {
    expect(updateSteer(0.5, 1, 30, 1 / 60)).toBeLessThan(0.1);
  });
});
