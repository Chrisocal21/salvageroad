import { describe, expect, it } from 'vitest';
import { SHIPPING } from '../src/data/shippingContainers';
import { aimToSpec } from '../src/rules/baseAim';
import { addPiece, createLayout } from '../src/rules/baseBuild';

const c = SHIPPING.cell;
const H = SHIPPING.height;

describe('aimToSpec', () => {
  it('centres a container on the ground point and snaps to whole cells', () => {
    // A 40 ft container along X is 10 by 2 cells. Aim at the middle of cells (5, 1).
    const s = aimToSpec('ft40', 0, 0, { x: 5 * c + 0.1, y: 0, z: 1 * c - 0.1 }, null, null);
    expect(s).toMatchObject({ level: 0, gx: 0, gz: 0 });
    // Moving the aim point by more than half a cell moves it by one cell.
    const t = aimToSpec('ft40', 0, 0, { x: 5 * c + 0.7 * c, y: 0, z: 1 * c }, null, null);
    expect(t.gx).toBe(1);
  });

  it('puts a container on top of the one it hit, one level up', () => {
    const l = createLayout();
    const base = addPiece(l, { kind: 'ft40', rot: 0, gx: 0, gz: 0, level: 0, color: 0 })!;
    const s = aimToSpec('ft40', 0, 0, { x: 5 * c, y: H, z: c }, { x: 0, y: 1, z: 0 }, base);
    expect(s.level).toBe(1);
    expect(s.gx).toBe(0);
  });

  it('puts a container flush beside the face it hit, at the same level', () => {
    const l = createLayout();
    const base = addPiece(l, { kind: 'ft40', rot: 0, gx: 0, gz: 0, level: 0, color: 0 })!;
    // Hit the +Z long face: new container goes right next to it, no gap and no overlap.
    const side = aimToSpec('ft40', 0, 0, { x: 5 * c, y: 1, z: 2 * c }, { x: 0, y: 0, z: 1 }, base);
    expect(side).toMatchObject({ level: 0, gz: 2 });
    // Hit the +X end face: new container continues the line.
    const end = aimToSpec('ft20', 0, 0, { x: 10 * c, y: 1, z: c }, { x: 1, y: 0, z: 0 }, base);
    expect(end).toMatchObject({ level: 0, gx: 10 });
    // Hit the -X end face: it goes on the other end, its own length away.
    const back = aimToSpec('ft20', 0, 0, { x: 0, y: 1, z: c }, { x: -1, y: 0, z: 0 }, base);
    expect(back).toMatchObject({ level: 0, gx: -5 });
  });

  it('keeps the level of a side hit on an upper container', () => {
    const l = createLayout();
    addPiece(l, { kind: 'ft40', rot: 0, gx: 0, gz: 0, level: 0, color: 0 });
    const up = addPiece(l, { kind: 'ft40', rot: 0, gx: 0, gz: 0, level: 1, color: 0 })!;
    const s = aimToSpec('ft40', 0, 0, { x: 5 * c, y: 1.5 * H, z: 2 * c }, { x: 0, y: 0, z: 1 }, up);
    expect(s.level).toBe(1);
  });
});
