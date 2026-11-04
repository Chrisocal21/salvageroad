import { describe, expect, it } from 'vitest';
import { SHIPPING } from '../src/data/shippingContainers';
import {
  addPiece,
  checkPlace,
  checkRemove,
  createLayout,
  footprint,
  planPlace,
  removePiece,
  scatterBase,
  supportShare,
  type PieceSpec,
} from '../src/rules/baseBuild';

const at = (gx: number, gz: number, level = 0, over: Partial<PieceSpec> = {}): PieceSpec => ({
  kind: 'ft40',
  rot: 0,
  gx,
  gz,
  level,
  color: 0,
  ...over,
});

describe('shipping container grid', () => {
  it('uses real container sizes on a 4 ft grid', () => {
    expect(footprint('ft40', 0)).toEqual({ w: 10, d: 2 });
    expect(footprint('ft40', 1)).toEqual({ w: 2, d: 10 });
    expect(footprint('ft20', 0)).toEqual({ w: 5, d: 2 });
    expect(10 * SHIPPING.cell).toBeCloseTo(12.19, 1); // 40 ft
    expect(2 * SHIPPING.cell).toBeCloseTo(2.44, 1); // 8 ft wide
  });

  it('allows ground containers and refuses overlaps', () => {
    const l = createLayout();
    expect(addPiece(l, at(0, 0))).not.toBeNull();
    expect(checkPlace(l, at(5, 1)).ok).toBe(false); // overlaps
    expect(addPiece(l, at(0, 2))).not.toBeNull(); // right beside, touching
    expect(addPiece(l, at(10, 0))).not.toBeNull(); // end to end
  });

  it('refuses containers floating with nothing below', () => {
    const l = createLayout();
    const r = checkPlace(l, at(0, 0, 1));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/support/i);
  });

  it('stacks directly on top', () => {
    const l = createLayout();
    addPiece(l, at(0, 0));
    expect(checkPlace(l, at(0, 0, 1)).support).toBe(1);
    expect(addPiece(l, at(0, 0, 1))).not.toBeNull();
  });

  it('allows a half-width offset and a rotated container across the top', () => {
    const l = createLayout();
    addPiece(l, at(0, 0));
    expect(addPiece(l, at(0, 1, 1))).not.toBeNull(); // shifted by one cell: half on, half off
    const l2 = createLayout();
    addPiece(l2, at(0, 0));
    addPiece(l2, at(0, 2));
    expect(addPiece(l2, at(4, 0, 1, { rot: 1 }))).not.toBeNull(); // crosses both
  });

  it('allows an overhang up to the support limit and no further', () => {
    const l = createLayout();
    addPiece(l, at(0, 0)); // cells x 0..9
    // Upper 40 ft with only 4 of 10 columns on the base: exactly 40 percent.
    expect(supportShare(l, at(6, 0, 1))).toBeCloseTo(0.4);
    expect(checkPlace(l, at(6, 0, 1)).ok).toBe(true);
    // 3 of 10 columns: 30 percent, floats.
    expect(supportShare(l, at(7, 0, 1))).toBeCloseTo(0.3);
    expect(checkPlace(l, at(7, 0, 1)).ok).toBe(false);
  });

  it('allows a bridge across a gap', () => {
    const l = createLayout();
    addPiece(l, at(0, 0, 0, { kind: 'ft20' })); // x 0..4
    addPiece(l, at(9, 0, 0, { kind: 'ft20' })); // x 9..13, gap of 4 cells (about 4.9 m)
    // A 40 ft on top spans x 3..12: 2 columns on the first, 4 on the second, 6 of 10 held.
    expect(supportShare(l, at(3, 0, 1))).toBeCloseTo(0.6);
    expect(addPiece(l, at(3, 0, 1))).not.toBeNull();
  });

  it('supports levels above level 1 and refuses beyond the maximum', () => {
    const l = createLayout();
    for (let level = 0; level <= SHIPPING.maxLevel; level++) expect(addPiece(l, at(0, 0, level))).not.toBeNull();
    expect(checkPlace(l, at(0, 0, SHIPPING.maxLevel + 1)).ok).toBe(false);
  });

  it('refuses to remove a container that holds up another, but allows it once the top is gone', () => {
    const l = createLayout();
    const base = addPiece(l, at(0, 0))!;
    const top = addPiece(l, at(0, 0, 1))!;
    expect(checkRemove(l, base.id).ok).toBe(false);
    expect(removePiece(l, base.id)).toBe(false);
    expect(removePiece(l, top.id)).toBe(true);
    expect(removePiece(l, base.id)).toBe(true);
    expect(l.pieces.size).toBe(0);
    expect(l.cells.size).toBe(0);
  });

  it('allows removing one of two supports when the top is still held', () => {
    const l = createLayout();
    const a = addPiece(l, at(0, 0))!;
    addPiece(l, at(0, 2));
    addPiece(l, at(0, 1, 1)); // one cell row on each: 50 percent from each below
    expect(checkRemove(l, a.id).ok).toBe(true); // the other still gives 50 percent
  });

  it('keeps level 0 and level 1 cells separate', () => {
    const l = createLayout();
    addPiece(l, at(0, 0));
    expect(l.cells.size).toBe(20);
    addPiece(l, at(0, 0, 1));
    expect(l.cells.size).toBe(40);
  });
});

describe('scatterBase', () => {
  it('is reproducible and every piece is valid', () => {
    const a = createLayout();
    const b = createLayout();
    expect(scatterBase(a, 5, 300)).toBe(scatterBase(b, 5, 300));
    expect([...a.pieces.values()].map((p) => `${p.kind}${p.gx},${p.gz},${p.level}`)).toEqual(
      [...b.pieces.values()].map((p) => `${p.kind}${p.gx},${p.gz},${p.level}`),
    );
    // Rebuild each piece into a fresh layout in level order: it must pass the normal check.
    const fresh = createLayout();
    const sorted = [...a.pieces.values()].sort((p, q) => p.level - q.level);
    for (const p of sorted) expect(addPiece(fresh, p)).not.toBeNull();
  });

  it('makes a mix of levels, with overhangs among them', () => {
    const l = createLayout();
    expect(scatterBase(l, 3, 500)).toBeGreaterThan(400);
    const levels = new Set([...l.pieces.values()].map((p) => p.level));
    expect(levels.size).toBeGreaterThan(2);
    const overhung = [...l.pieces.values()].some((p) => p.level > 0 && supportShare(l, p) < 0.99);
    expect(overhung).toBe(true);
  });

  it('handles thousands of containers quickly', () => {
    const l = createLayout();
    const t = performance.now();
    scatterBase(l, 9, 5000);
    expect(performance.now() - t).toBeLessThan(3000); // alone it takes well under 500 ms; the margin is for a busy machine
  });
});

describe('pillars and automatic support', () => {
  it('lets a container go anywhere high up and builds corner pillars to the ground', () => {
    const l = createLayout();
    const spec = at(0, 0, 2);
    expect(checkPlace(l, spec).ok).toBe(false); // strict rule: it would float
    const plan = planPlace(l, spec);
    expect(plan.ok).toBe(true);
    expect(plan.pillars).toHaveLength(4);
    for (const p of plan.pillars) expect(p).toMatchObject({ kind: 'pillar', level: 0, levels: 2 });
    const piece = addPiece(l, spec, true)!;
    expect(piece).not.toBeNull();
    expect(l.pieces.size).toBe(5);
    expect(l.cells.size).toBe(20 + 4 * 2); // the container plus 4 pillars two levels tall
    expect([...l.pieces.values()].filter((p) => p.owner === piece.id)).toHaveLength(4);
  });

  it('does not add pillars when the container is already held up', () => {
    const l = createLayout();
    addPiece(l, at(0, 0));
    expect(planPlace(l, at(0, 0, 1)).pillars).toHaveLength(0);
  });

  it('stops a pillar on top of whatever it would stand on', () => {
    const l = createLayout();
    addPiece(l, at(0, 0)); // fills x 0..9, z 0..1 at level 0
    // A container two levels up over the same spot: level 1 is empty, so each corner gets a 1-level pillar on top.
    const plan = planPlace(l, at(0, 0, 2));
    expect(plan.pillars).toHaveLength(4);
    for (const p of plan.pillars) expect(p).toMatchObject({ level: 1, levels: 1 });
  });

  it('only adds pillars at the corners that need them', () => {
    const l = createLayout();
    addPiece(l, at(0, 0, 0, { kind: 'ft20' })); // x 0..4
    // 40 ft level 1 from x 3: only 2 of 10 columns held, corners at x 3 and 12; the corner at x 3 is held.
    const plan = planPlace(l, at(3, 0, 1));
    expect(plan.ok).toBe(true);
    expect(plan.pillars.map((p) => p.gx).sort()).toEqual([12, 12]);
  });

  it('removes a container together with its own pillars', () => {
    const l = createLayout();
    const piece = addPiece(l, at(0, 0, 3), true)!;
    expect(removePiece(l, piece.id)).toBe(true);
    expect(l.pieces.size).toBe(0);
    expect(l.cells.size).toBe(0);
  });

  it('refuses to remove a pillar that holds a container', () => {
    const l = createLayout();
    addPiece(l, at(0, 0, 1), true);
    const pillar = [...l.pieces.values()].find((p) => p.kind === 'pillar')!;
    expect(checkRemove(l, pillar.id).ok).toBe(false);
  });

  it('places a pillar by hand only on the ground or on something', () => {
    const l = createLayout();
    const pillar = (gx: number, gz: number, level: number): PieceSpec => ({ kind: 'pillar', gx, gz, level, rot: 0, color: 0 });
    expect(addPiece(l, pillar(3, 3, 0))).not.toBeNull();
    expect(addPiece(l, pillar(3, 3, 1))).not.toBeNull(); // stacked
    expect(addPiece(l, pillar(8, 8, 1))).toBeNull(); // floating
    expect(checkPlace(l, pillar(3, 3, 1)).ok).toBe(false); // that cell is now taken
  });

  it('allows a container held only by its four corners with a hollow underneath', () => {
    const l = createLayout();
    const pillar = (gx: number, gz: number): PieceSpec => ({ kind: 'pillar', gx, gz, level: 0, rot: 0, color: 0 });
    for (const [x, z] of [[0, 0], [9, 0], [0, 1], [9, 1]]) addPiece(l, pillar(x, z));
    expect(supportShare(l, at(0, 0, 1))).toBeCloseTo(0.2); // 4 of 20 cells, below the 40 percent rule
    expect(checkPlace(l, at(0, 0, 1)).ok).toBe(true); // but all four corners are held
  });

  it('respects the height limit for pillars', () => {
    const l = createLayout();
    expect(planPlace(l, at(0, 0, SHIPPING.maxLevel)).ok).toBe(true);
    expect(planPlace(l, at(0, 0, SHIPPING.maxLevel + 1)).ok).toBe(false);
  });
});
