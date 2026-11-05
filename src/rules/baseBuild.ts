// Base building rules: a grid of cells, pieces snapped to it, stacked in levels.
// Plain numbers, no rendering. Positions are whole grid cells, so everything snaps by design.
// The rules, in one place:
//  1. A container fills a block of cells (2 wide, 5 or 10 long, one level high). A pillar fills one
//     cell and can be several levels tall. No two pieces share a cell.
//  2. Level 0 sits on the ground. Anything higher needs support from the level below:
//       container: at least SHIPPING.minSupport of its footprint on something, OR something under all
//                  four corners. Overhangs and bridges are fine; floating is not.
//       pillar:    something directly under it.
//     This is a count of cells, not physics.
//  3. planPlace() can fix a missing support by adding corner pillars down to the ground (or down to
//     whatever is below). Those pillars belong to the container and go with it, unless something
//     else has come to rest on them.
//  4. A piece cannot be removed if that would leave something above it without support.

import { SHIPPING, type ShippingKind } from '../data/shippingContainers';
import { makeRandom } from './scatter';

export type PieceKind = ShippingKind | 'pillar';
export type Rotation = 0 | 1; // 0: long side along X, 1: long side along Z

export interface PieceSpec {
  kind: PieceKind;
  /** Grid cell of the lowest-X, lowest-Z corner. */
  gx: number;
  gz: number;
  /** Level of the lowest part of the piece. */
  level: number;
  rot: Rotation;
  /** Index into SHIPPING.colors. */
  color: number;
  /** How many levels tall. Only pillars use this; default 1. */
  levels?: number;
}

export interface Piece extends PieceSpec {
  id: number;
  /** For an automatic pillar: the container it was added for. */
  owner?: number;
}

export interface Layout {
  pieces: Map<number, Piece>;
  /** Which piece fills each cell, keyed by cellKey(). */
  cells: Map<number, number>;
  nextId: number;
}

export function createLayout(): Layout {
  return { pieces: new Map(), cells: new Map(), nextId: 1 };
}

/** Size in cells of the footprint, after rotation. */
export function footprint(kind: PieceKind, rot: Rotation): { w: number; d: number } {
  if (kind === 'pillar') return { w: 1, d: 1 };
  const k = SHIPPING.kinds[kind];
  return rot === 0 ? { w: k.long, d: k.wide } : { w: k.wide, d: k.long };
}

/** How many levels tall a piece is. */
export function heightLevels(spec: PieceSpec): number {
  return spec.kind === 'pillar' ? Math.max(1, spec.levels ?? 1) : 1;
}

const SPAN = 32768;
export function cellKey(level: number, gx: number, gz: number): number {
  return (level * SPAN + (gx + SPAN / 2)) * SPAN + (gz + SPAN / 2);
}

export interface PlaceCheck {
  ok: boolean;
  /** Share of the footprint resting on something below (1 on the ground). */
  support: number;
  reason?: string;
  /** Why it failed: lets planPlace know whether pillars could fix it. */
  code?: 'range' | 'blocked' | 'support';
}

interface Support {
  share: number;
  ok: boolean;
}

function supportInfo(layout: Layout, spec: PieceSpec, ignoreId = 0): Support {
  if (spec.level === 0) return { share: 1, ok: true };
  const below = spec.level - 1;
  const filled = (x: number, z: number) => {
    const id = layout.cells.get(cellKey(below, x, z));
    return id !== undefined && id !== ignoreId;
  };
  const { w, d } = footprint(spec.kind, spec.rot);
  if (spec.kind === 'pillar') {
    const held = filled(spec.gx, spec.gz);
    return { share: held ? 1 : 0, ok: held };
  }
  let held = 0;
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) if (filled(spec.gx + x, spec.gz + z)) held++;
  }
  const share = held / (w * d);
  const corners =
    filled(spec.gx, spec.gz) &&
    filled(spec.gx + w - 1, spec.gz) &&
    filled(spec.gx, spec.gz + d - 1) &&
    filled(spec.gx + w - 1, spec.gz + d - 1);
  return { share, ok: share >= SHIPPING.minSupport || corners };
}

/** Share of the footprint that sits on something one level down. Ignores one piece id if given. */
export function supportShare(layout: Layout, spec: PieceSpec, ignoreId = 0): number {
  return supportInfo(layout, spec, ignoreId).share;
}

function forEachCell(spec: PieceSpec, fn: (level: number, gx: number, gz: number) => void) {
  const { w, d } = footprint(spec.kind, spec.rot);
  const h = heightLevels(spec);
  for (let l = 0; l < h; l++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) fn(spec.level + l, spec.gx + x, spec.gz + z);
    }
  }
}

/** The strict rule check: is this spec allowed as it stands, with no help from extra pillars? */
export function checkPlace(layout: Layout, spec: PieceSpec): PlaceCheck {
  const { w, d } = footprint(spec.kind, spec.rot);
  if (spec.level < 0 || spec.level + heightLevels(spec) - 1 > SHIPPING.maxLevel) {
    return { ok: false, support: 0, reason: 'Too high', code: 'range' };
  }
  const m = SHIPPING.maxCell;
  if (Math.abs(spec.gx) > m || Math.abs(spec.gz) > m || Math.abs(spec.gx + w) > m || Math.abs(spec.gz + d) > m) {
    return { ok: false, support: 0, reason: 'Too far from the origin', code: 'range' };
  }
  let blocked = false;
  forEachCell(spec, (l, x, z) => {
    if (layout.cells.has(cellKey(l, x, z))) blocked = true;
  });
  if (blocked) return { ok: false, support: 0, reason: 'Blocked by another piece', code: 'blocked' };
  const s = supportInfo(layout, spec);
  if (!s.ok) {
    const reason =
      spec.kind === 'pillar'
        ? 'A pillar needs something under it'
        : `Needs support: ${Math.round(s.share * 100)}% of ${Math.round(SHIPPING.minSupport * 100)}%`;
    return { ok: false, support: s.share, reason, code: 'support' };
  }
  return { ok: true, support: s.share };
}

export interface PlacePlan extends PlaceCheck {
  /** Pillars that would be added under the piece to hold it up. */
  pillars: PieceSpec[];
}

/**
 * Like checkPlace, but a container with no support is allowed: the plan lists the corner pillars
 * that would be built under it. A pillar goes down from the container's corner to the ground, or
 * to the first piece it would stand on.
 */
export function planPlace(layout: Layout, spec: PieceSpec): PlacePlan {
  const check = checkPlace(layout, spec);
  if (check.ok || check.code !== 'support' || spec.kind === 'pillar') return { ...check, pillars: [] };
  const { w, d } = footprint(spec.kind, spec.rot);
  const corners = [
    [spec.gx, spec.gz],
    [spec.gx + w - 1, spec.gz],
    [spec.gx, spec.gz + d - 1],
    [spec.gx + w - 1, spec.gz + d - 1],
  ];
  const pillars: PieceSpec[] = [];
  for (const [x, z] of corners) {
    if (layout.cells.has(cellKey(spec.level - 1, x, z))) continue; // already held at this corner
    let k = spec.level - 2;
    while (k >= 0 && !layout.cells.has(cellKey(k, x, z))) k--;
    pillars.push({ kind: 'pillar', gx: x, gz: z, level: k + 1, levels: spec.level - 1 - k, rot: 0, color: 0 });
  }
  return { ok: true, support: check.support, pillars };
}

function insert(layout: Layout, spec: PieceSpec, owner?: number): Piece {
  const piece: Piece = { ...spec, id: layout.nextId++ };
  if (owner !== undefined) piece.owner = owner;
  layout.pieces.set(piece.id, piece);
  forEachCell(spec, (l, x, z) => layout.cells.set(cellKey(l, x, z), piece.id));
  return piece;
}

/** Add a piece if the rules allow it. With autoPillars, missing support is built for it. */
export function addPiece(layout: Layout, spec: PieceSpec, autoPillars = false): Piece | null {
  const plan = autoPillars ? planPlace(layout, spec) : { ...checkPlace(layout, spec), pillars: [] as PieceSpec[] };
  if (!plan.ok) return null;
  const pillars = plan.pillars.map((p) => insert(layout, p));
  const piece = insert(layout, spec);
  for (const p of pillars) p.owner = piece.id;
  return piece;
}

/** Pieces sitting directly on top of this one. */
function piecesAbove(layout: Layout, piece: Piece): Piece[] {
  const { w, d } = footprint(piece.kind, piece.rot);
  const top = piece.level + heightLevels(piece);
  const found = new Map<number, Piece>();
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      const id = layout.cells.get(cellKey(top, piece.gx + x, piece.gz + z));
      if (id !== undefined) found.set(id, layout.pieces.get(id)!);
    }
  }
  return [...found.values()];
}

export function checkRemove(layout: Layout, id: number): { ok: boolean; reason?: string } {
  const piece = layout.pieces.get(id);
  if (!piece) return { ok: false, reason: 'Nothing there' };
  for (const above of piecesAbove(layout, piece)) {
    if (!supportInfo(layout, above, id).ok) return { ok: false, reason: 'Something is resting on it' };
  }
  return { ok: true };
}

export function removePiece(layout: Layout, id: number): boolean {
  if (!checkRemove(layout, id).ok) return false;
  const piece = layout.pieces.get(id)!;
  forEachCell(piece, (l, x, z) => layout.cells.delete(cellKey(l, x, z)));
  layout.pieces.delete(id);
  // Take the container's own pillars with it, unless something else has come to rest on them.
  for (const p of [...layout.pieces.values()]) {
    if (p.owner !== id) continue;
    delete p.owner;
    removePiece(layout, p.id);
  }
  return true;
}

/**
 * Fill a layout with a seeded random base, for testing performance and for a demo. Grows clusters
 * by trying spots next to, on top of, and offset from containers that already exist, so the result
 * has stacks, offsets, overhangs and bridges. Every piece goes through the normal placement check.
 */
export function scatterBase(layout: Layout, seed: number, count: number, clusters = 3, radiusCells = 30): number {
  const rnd = makeRandom(seed);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const centers = Array.from({ length: clusters }, () => ({
    x: Math.round((rnd() - 0.5) * 2 * radiusCells),
    z: Math.round((rnd() - 0.5) * 2 * radiusCells),
  }));
  let added = 0;
  let attempts = 0;
  const pool: Piece[] = [];
  while (added < count && attempts < count * 40) {
    attempts++;
    const kind: ShippingKind = rnd() < 0.5 ? 'ft20' : 'ft40';
    const rot: Rotation = rnd() < 0.5 ? 0 : 1;
    const { w, d } = footprint(kind, rot);
    let spec: PieceSpec;
    if (pool.length === 0 || rnd() < 0.02) {
      const c = pick(centers);
      spec = { kind, rot, level: 0, gx: c.x + Math.round((rnd() - 0.5) * 24), gz: c.z + Math.round((rnd() - 0.5) * 24), color: 0 };
    } else {
      const base = pool[Math.floor(rnd() * pool.length)];
      const bf = footprint(base.kind, base.rot);
      const how = rnd();
      // A random offset within the base's footprint gives stacks, half-offsets and overhangs.
      const offX = Math.round((rnd() - 0.5) * (bf.w + w - 2));
      const offZ = Math.round((rnd() - 0.5) * (bf.d + d - 2));
      if (how < 0.55) {
        spec = { kind, rot, level: base.level + 1, gx: base.gx + offX, gz: base.gz + offZ, color: 0 };
      } else if (how < 0.8) {
        spec = { kind, rot, level: base.level, gx: base.gx + bf.w, gz: base.gz + offZ, color: 0 };
      } else {
        spec = { kind, rot, level: base.level, gx: base.gx + offX, gz: base.gz + bf.d, color: 0 };
      }
    }
    spec.color = Math.floor(rnd() * SHIPPING.colors.length);
    const piece = addPiece(layout, spec);
    if (piece) {
      pool.push(piece);
      added++;
    }
  }
  return added;
}
