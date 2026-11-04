import { describe, expect, it } from 'vitest';
import { SHIPPING } from '../src/data/shippingContainers';
import { addPiece, createLayout, removePiece, type PieceSpec } from '../src/rules/baseBuild';
import { loadLayout, serializeLayout } from '../src/rules/baseSave';
import { HEADROOM, layoutBoxes, pieceBox, siteProblem, walkingSolids, type SiteContext } from '../src/rules/baseWorld';

const c = SHIPPING.cell;
const at = (gx: number, gz: number, level = 0, over: Partial<PieceSpec> = {}): PieceSpec => ({
  kind: 'ft40',
  rot: 0,
  gx,
  gz,
  level,
  color: 0,
  ...over,
});
const flat: SiteContext = { groundHeight: () => 0, solids: [], player: null, truck: null };

describe('solid boxes', () => {
  it('a container box matches its cells', () => {
    const b = pieceBox(at(2, 3));
    expect(b.x).toBeCloseTo((2 + 5) * c);
    expect(b.z).toBeCloseTo((3 + 1) * c);
    expect(b.hx).toBeCloseTo(5 * c);
    expect(b.hz).toBeCloseTo(1 * c);
    expect(b.y0).toBe(0);
    expect(b.height).toBeCloseTo(SHIPPING.height);
  });

  it('a pillar is a slim post as tall as its levels', () => {
    const b = pieceBox({ kind: 'pillar', gx: 0, gz: 0, level: 1, levels: 2, rot: 0, color: 0 });
    expect(b.hx).toBeCloseTo(SHIPPING.pillarWidth / 2);
    expect(b.y0).toBeCloseTo(SHIPPING.height);
    expect(b.height).toBeCloseTo(2 * SHIPPING.height);
  });

  it('you can walk under a raised container but not through a ground one', () => {
    const l = createLayout();
    addPiece(l, at(0, 0));
    addPiece(l, at(30, 0, 2), true); // two levels up, on pillars
    expect(layoutBoxes(l)).toHaveLength(6);
    const solids = walkingSolids(l);
    // the ground container and the four pillars block walking, the raised container does not
    expect(solids).toHaveLength(5);
    expect(SHIPPING.height).toBeGreaterThan(HEADROOM);
  });
});

describe('site rules in the game world', () => {
  it('allows building on open flat ground', () => {
    expect(siteProblem([at(0, 0)], flat)).toBeNull();
  });

  it('refuses sloped ground', () => {
    const hill: SiteContext = { ...flat, groundHeight: (x) => (x > 5 ? 1 : 0) };
    expect(siteProblem([at(0, 0)], hill)).toMatch(/flat/);
  });

  it('refuses to overlap a building or other solid', () => {
    const ctx: SiteContext = { ...flat, solids: [{ x: 5 * c, z: c, hx: 2, hz: 2 }] };
    expect(siteProblem([at(0, 0)], ctx)).toMatch(/in the way/);
    expect(siteProblem([at(40, 40)], ctx)).toBeNull();
  });

  it('checks the pillars that come with a raised container too', () => {
    const l = createLayout();
    const pillar = { kind: 'pillar', gx: 0, gz: 0, level: 0, levels: 1, rot: 0, color: 0 } as PieceSpec;
    const ctx: SiteContext = { ...flat, solids: [{ x: 0.6, z: 0.6, hx: 0.3, hz: 0.3 }] };
    expect(siteProblem([at(0, 0, 1), pillar], ctx)).toMatch(/in the way/);
    expect(l.pieces.size).toBe(0);
  });

  it('keeps pieces off the player and the truck', () => {
    const onPlayer: SiteContext = { ...flat, player: { x: 5 * c, z: c } };
    expect(siteProblem([at(0, 0)], onPlayer)).toMatch(/standing/);
    expect(siteProblem([at(0, 0, 2)], onPlayer)).toBeNull(); // far overhead is fine
    const onTruck: SiteContext = { ...flat, truck: { x: 5 * c, z: c } };
    expect(siteProblem([at(0, 0)], onTruck)).toMatch(/truck/);
  });
});

describe('saving and loading a base', () => {
  it('round trips pieces, pillars and ownership', () => {
    const a = createLayout();
    addPiece(a, at(0, 0));
    const high = addPiece(a, at(0, 20, 2), true)!;
    const b = createLayout();
    expect(loadLayout(b, serializeLayout(a))).toBe(a.pieces.size);
    expect(b.pieces.size).toBe(6);
    expect(b.cells.size).toBe(a.cells.size);
    const owners = [...b.pieces.values()].filter((p) => p.owner !== undefined);
    expect(owners).toHaveLength(4);
    // The loaded container owns its pillars, so removing it takes them along.
    const loadedHigh = [...b.pieces.values()].find((p) => p.level === 2 && p.kind === 'ft40')!;
    expect(owners.every((p) => p.owner === loadedHigh.id)).toBe(true);
    expect(removePiece(b, loadedHigh.id)).toBe(true);
    expect(b.pieces.size).toBe(1);
    expect(high.id).toBeGreaterThan(0);
  });

  it('ignores missing or damaged saves', () => {
    const l = createLayout();
    expect(loadLayout(l, null)).toBe(0);
    expect(loadLayout(l, 'not json')).toBe(0);
    expect(loadLayout(l, '{"a":1}')).toBe(0);
    expect(loadLayout(l, '[1, null, {"kind":5}]')).toBe(0);
    expect(l.pieces.size).toBe(0);
  });
});
