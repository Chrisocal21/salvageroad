// Flat (top-down) shapes for walking collisions and "what am I looking at". X and Z are the ground plane.

/** Axis-aligned box, given by its centre and half sizes. */
export interface Box2 {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Box that can be turned. yaw 0 means its hz side points along +Z. */
export interface Obb2 extends Box2 {
  yaw: number;
}

/** Distance from a point to the nearest edge of a box. Zero if the point is inside. */
export function distanceToBox(px: number, pz: number, b: Box2): number {
  const dx = Math.max(Math.abs(px - b.x) - b.hx, 0);
  const dz = Math.max(Math.abs(pz - b.z) - b.hz, 0);
  return Math.hypot(dx, dz);
}

export function distanceToObb(px: number, pz: number, b: Obb2): number {
  const [lx, lz] = toLocal(px, pz, b);
  return distanceToBox(lx, lz, { x: 0, z: 0, hx: b.hx, hz: b.hz });
}

/** Moves a circle out of a box if it overlaps. Returns the corrected position. */
export function pushCircleOutOfBox(px: number, pz: number, r: number, b: Box2): [number, number] {
  const cx = Math.min(Math.max(px, b.x - b.hx), b.x + b.hx);
  const cz = Math.min(Math.max(pz, b.z - b.hz), b.z + b.hz);
  let dx = px - cx;
  let dz = pz - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return [px, pz];
  if (d > 1e-6) {
    dx /= d;
    dz /= d;
    return [cx + dx * r, cz + dz * r];
  }
  // The centre is inside the box: leave by the nearest side.
  const left = px - (b.x - b.hx);
  const right = b.x + b.hx - px;
  const near = pz - (b.z - b.hz);
  const far = b.z + b.hz - pz;
  const m = Math.min(left, right, near, far);
  if (m === left) return [b.x - b.hx - r, pz];
  if (m === right) return [b.x + b.hx + r, pz];
  if (m === near) return [px, b.z - b.hz - r];
  return [px, b.z + b.hz + r];
}

export function pushCircleOutOfObb(px: number, pz: number, r: number, b: Obb2): [number, number] {
  const [lx, lz] = toLocal(px, pz, b);
  const [ox, oz] = pushCircleOutOfBox(lx, lz, r, { x: 0, z: 0, hx: b.hx, hz: b.hz });
  return toWorld(ox, oz, b);
}

// A box turned by yaw has its local Z along (sin yaw, cos yaw) and its local X along (cos yaw, -sin yaw).
function toLocal(px: number, pz: number, b: Obb2): [number, number] {
  const dx = px - b.x;
  const dz = pz - b.z;
  const s = Math.sin(b.yaw);
  const c = Math.cos(b.yaw);
  return [dx * c - dz * s, dx * s + dz * c];
}

function toWorld(lx: number, lz: number, b: Obb2): [number, number] {
  const s = Math.sin(b.yaw);
  const c = Math.cos(b.yaw);
  return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
}
