// How a built base meets the rest of the world: solid boxes for walking and driving into, and the
// checks for whether a piece may be built at a spot in the game world. Plain numbers, no rendering.

import { SHIPPING } from '../data/shippingContainers';
import { footprint, heightLevels, type Layout, type PieceSpec } from './baseBuild';
import { distanceToBox, type Box2 } from './geometry';

/** A solid block: footprint on the ground, bottom height above ground, and its height. */
export interface BuildBox extends Box2 {
  y0: number;
  height: number;
}

/** The solid block a piece fills. A pillar is solid only where it is drawn, a slim post. */
export function pieceBox(p: PieceSpec): BuildBox {
  const { w, d } = footprint(p.kind, p.rot);
  const cell = SHIPPING.cell;
  const x = (p.gx + w / 2) * cell;
  const z = (p.gz + d / 2) * cell;
  const hx = p.kind === 'pillar' ? SHIPPING.pillarWidth / 2 : (w * cell) / 2;
  const hz = p.kind === 'pillar' ? SHIPPING.pillarWidth / 2 : (d * cell) / 2;
  return { x, z, hx, hz, y0: p.level * SHIPPING.height, height: heightLevels(p) * SHIPPING.height };
}

export function layoutBoxes(layout: Layout): BuildBox[] {
  return [...layout.pieces.values()].map(pieceBox);
}

/** Pieces whose underside is above this height can be walked under. Roughly the player's height. */
export const HEADROOM = 1.9;

/** The flat footprints of everything the player on foot cannot walk through. */
export function walkingSolids(layout: Layout): Box2[] {
  return layoutBoxes(layout)
    .filter((b) => b.y0 < HEADROOM)
    .map(({ x, z, hx, hz }) => ({ x, z, hx, hz }));
}

export interface SiteContext {
  /** Ground height at a spot. Building assumes level ground at height 0. */
  groundHeight(x: number, z: number): number;
  /** Things already in the world that a piece must not overlap: buildings, props, lootables. */
  solids: Box2[];
  /** Where the player stands, if they could be in the way. */
  player: { x: number; z: number } | null;
  /** Where the truck is, if it could be in the way. */
  truck: { x: number; z: number } | null;
}

const PLAYER_CLEARANCE = 0.75; // metres between a new piece and the player's centre
const TRUCK_CLEARANCE = 3.2; // metres from the truck's centre: its half length plus some room
const FLAT_TOLERANCE = 0.02;

/**
 * Why a set of pieces (a piece and the pillars that come with it) cannot be built here in the game
 * world, or null if it can. The grid rules (overlap, support) are checked separately by planPlace.
 */
export function siteProblem(specs: PieceSpec[], ctx: SiteContext): string | null {
  for (const spec of specs) {
    const { w, d } = footprint(spec.kind, spec.rot);
    const x0 = spec.gx * SHIPPING.cell;
    const z0 = spec.gz * SHIPPING.cell;
    const x1 = (spec.gx + w) * SHIPPING.cell;
    const z1 = (spec.gz + d) * SHIPPING.cell;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) {
      if (Math.abs(ctx.groundHeight(x, z)) > FLAT_TOLERANCE) return 'The ground is not flat here';
    }
    const box = pieceBox(spec);
    for (const s of ctx.solids) {
      if (Math.abs(box.x - s.x) < box.hx + s.hx && Math.abs(box.z - s.z) < box.hz + s.hz) return 'Something is in the way';
    }
    if (box.y0 < HEADROOM) {
      if (ctx.player && distanceToBox(ctx.player.x, ctx.player.z, box) < PLAYER_CLEARANCE) return 'You are standing there';
    }
    if (box.y0 < 1.6 && ctx.truck && distanceToBox(ctx.truck.x, ctx.truck.z, box) < TRUCK_CLEARANCE) {
      return 'The truck is in the way';
    }
  }
  return null;
}
