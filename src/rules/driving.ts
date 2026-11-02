// Realistic driving rules. Plain numbers in, plain numbers out: no physics engine, no rendering.
// Units: metres, seconds, kilograms, newtons, radians.

export const DRIVING = {
  mass: 1400,
  maxEngineForce: 5000, // N at the wheels, limited by tyre grip at low speed
  enginePower: 60000, // W, limits force at higher speed
  reverseForceScale: 0.4, // reverse gear is weaker than first
  maxReverseSpeed: 6, // m/s
  airDrag: 0.46, // N per (m/s)^2: half air density times drag area
  rollingResistance: 0.015, // fraction of weight
  steerLockLow: 0.55, // rad of wheel angle when crawling (about 31 degrees)
  steerSpeedRef: 8, // m/s: speed at which the steering lock has fallen to a half
  steerRate: 2.5, // rad/s: how fast the wheels turn into a corner
  steerReturnRate: 3.5, // rad/s: how fast they come back to centre
  stopSpeed: 0.5, // m/s: below this the car counts as stopped
};

export interface Pedals {
  /** Total engine force at the driven wheels in newtons. Negative drives backwards. */
  engine: number;
  /** Service brake, 0 to 1. */
  brake: number;
  /** Handbrake, 0 to 1. Rear wheels only. */
  handbrake: number;
}

/** Engine force for a throttle value from 0 to 1 at a given forward speed. */
export function engineForce(throttle: number, forwardSpeed: number): number {
  const speed = Math.max(forwardSpeed, 0);
  const limit = Math.min(DRIVING.maxEngineForce, DRIVING.enginePower / Math.max(speed, 1));
  return clamp(throttle, 0, 1) * limit;
}

/** Reverse engine force (negative) for a reverse pedal value from 0 to 1. */
export function reverseForce(pedal: number, forwardSpeed: number): number {
  if (forwardSpeed <= -DRIVING.maxReverseSpeed) return 0;
  return -clamp(pedal, 0, 1) * DRIVING.maxEngineForce * DRIVING.reverseForceScale;
}

/**
 * Turns W/S/Space into engine and brake. Like a real car: pressing the opposite pedal
 * to the way you are rolling brakes first, and only reverses once you have stopped.
 */
export function resolvePedals(throttle: number, handbrake: number, forwardSpeed: number): Pedals {
  const t = clamp(throttle, -1, 1);
  let engine = 0;
  let brake = 0;
  if (t > 0) {
    if (forwardSpeed < -DRIVING.stopSpeed) brake = t;
    else engine = engineForce(t, forwardSpeed);
  } else if (t < 0) {
    if (forwardSpeed > DRIVING.stopSpeed) brake = -t;
    else engine = reverseForce(-t, forwardSpeed);
  }
  return { engine, brake, handbrake: clamp(handbrake, 0, 1) };
}

/** Resistance in newtons that always opposes motion: air drag plus rolling resistance. */
export function resistanceForce(speed: number): number {
  const s = Math.abs(speed);
  if (s < 0.05) return 0;
  return DRIVING.airDrag * s * s + DRIVING.rollingResistance * DRIVING.mass * 9.81;
}

/** Largest wheel angle allowed at this speed. Shrinks as you go faster. */
export function steerLimit(speed: number): number {
  const r = speed / DRIVING.steerSpeedRef;
  return DRIVING.steerLockLow / (1 + r * r);
}

/** Moves the current wheel angle toward what the driver asked for, at a realistic rate. */
export function updateSteer(current: number, input: number, speed: number, dt: number): number {
  const limit = steerLimit(speed);
  const target = clamp(input, -1, 1) * limit;
  const held = clamp(current, -limit, limit);
  const returning = target === 0 || Math.abs(target) < Math.abs(held) || Math.sign(target) !== Math.sign(held);
  const rate = (returning ? DRIVING.steerReturnRate : DRIVING.steerRate) * dt;
  if (Math.abs(target - held) <= rate) return target;
  return held + Math.sign(target - held) * rate;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
