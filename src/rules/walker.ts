import { pushCircleOutOfBox, pushCircleOutOfObb, type Box2, type Obb2 } from './geometry';

// The player on foot. Walking is plain geometry, not the physics engine: a circle that slides
// along walls, boxes and the parked truck. Height follows the ground.

export const WALKER = {
  radius: 0.4,
  walkSpeed: 3.2, // m/s
  runSpeed: 6, // m/s
  eyeHeight: 1.7,
  maxPitch: 1.4, // radians up or down
  worldLimit: 190, // m from the origin: the edge of the generated terrain
};

export interface Walker {
  x: number;
  z: number;
  /** Direction faced, in radians. 0 faces +Z and positive turns toward +X. */
  yaw: number;
  /** Looking up is positive. */
  pitch: number;
}

export interface WalkInput {
  forward: number; // -1 to 1
  right: number; // -1 to 1
  run: boolean;
}

/** Moves the walker for one frame and slides it out of anything it overlaps. */
export function stepWalker(w: Walker, input: WalkInput, dt: number, solids: Box2[], turned: Obb2[]): void {
  const speed = input.run ? WALKER.runSpeed : WALKER.walkSpeed;
  let f = input.forward;
  let r = input.right;
  const len = Math.hypot(f, r);
  if (len > 1) {
    f /= len; // no faster diagonally
    r /= len;
  }
  const sin = Math.sin(w.yaw);
  const cos = Math.cos(w.yaw);
  // Facing +Z, the right hand is toward -X.
  w.x += (sin * f - cos * r) * speed * dt;
  w.z += (cos * f + sin * r) * speed * dt;

  for (let pass = 0; pass < 3; pass++) {
    for (const s of solids) [w.x, w.z] = pushCircleOutOfBox(w.x, w.z, WALKER.radius, s);
    for (const o of turned) [w.x, w.z] = pushCircleOutOfObb(w.x, w.z, WALKER.radius, o);
  }
  w.x = Math.min(Math.max(w.x, -WALKER.worldLimit), WALKER.worldLimit);
  w.z = Math.min(Math.max(w.z, -WALKER.worldLimit), WALKER.worldLimit);
}

/** Turns the view. Moving the mouse right turns right, and moving it down looks down. */
export function lookWalker(w: Walker, dx: number, dy: number, sensitivity: number): void {
  w.yaw -= dx * sensitivity;
  w.pitch = Math.min(WALKER.maxPitch, Math.max(-WALKER.maxPitch, w.pitch - dy * sensitivity));
}
