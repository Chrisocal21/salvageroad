import { distanceToBox, distanceToObb, type Box2, type Obb2 } from './geometry';
import type { Walker } from './walker';

// "What can I use right now?" Picks the thing the player is close to and roughly looking at.

export const REACH = 2.2; // m from the surface of the thing
export const LOOK_CONE = 1.0; // radians either side of straight ahead

export type Target = { kind: 'container'; id: number } | { kind: 'part'; id: number } | { kind: 'pickup'; id: number } | { kind: 'trader'; id: number } | { kind: 'truck' };

export interface Candidates {
  containers: (Box2 & { id: number })[];
  truck: Obb2 | null;
  /** Loose truck parts lying about, as small boxes. */
  parts?: (Box2 & { id: number })[];
  /** Things lying about that go straight into the pack, such as the big rig tyre. */
  pickups?: (Box2 & { id: number })[];
  traders?: (Box2 & { id: number })[];
}

function angleTo(w: Walker, x: number, z: number): number {
  const heading = Math.atan2(x - w.x, z - w.z); // same convention as yaw
  let d = heading - w.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.abs(d);
}

/** The nearest thing within reach that the player is facing, or null. */
export function findTarget(w: Walker, c: Candidates): Target | null {
  let best: Target | null = null;
  let bestDist = Infinity;
  const consider = (target: Target, dist: number, x: number, z: number) => {
    if (dist > REACH) return;
    // Touching distance counts even if the view is off, so you can open what you are standing against.
    if (dist > 0.6 && angleTo(w, x, z) > LOOK_CONE) return;
    if (dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  };
  for (const box of c.containers) consider({ kind: 'container', id: box.id }, distanceToBox(w.x, w.z, box), box.x, box.z);
  for (const box of c.parts ?? []) consider({ kind: 'part', id: box.id }, distanceToBox(w.x, w.z, box), box.x, box.z);
  for (const box of c.pickups ?? []) consider({ kind: 'pickup', id: box.id }, distanceToBox(w.x, w.z, box), box.x, box.z);
  for (const box of c.traders ?? []) consider({ kind: 'trader', id: box.id }, distanceToBox(w.x, w.z, box), box.x, box.z);
  if (c.truck) consider({ kind: 'truck' }, distanceToObb(w.x, w.z, c.truck), c.truck.x, c.truck.z);
  return best;
}

/** Where to stand when stepping out of the truck: beside the driver's door on the left, or the passenger's door on the right (side -1). */
export function exitPosition(truck: Obb2, leftOrRight: 1 | -1 = 1): { x: number; z: number; yaw: number } {
  const side = (truck.hx + 0.9) * leftOrRight;
  // Left of a vehicle facing +Z is +X. Its local X axis is (cos yaw, -sin yaw).
  return {
    x: truck.x + Math.cos(truck.yaw) * side,
    z: truck.z - Math.sin(truck.yaw) * side,
    yaw: truck.yaw,
  };
}
