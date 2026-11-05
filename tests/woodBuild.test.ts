import { describe, expect, it } from 'vitest';
import { SHIPPING } from '../src/data/shippingContainers';
import { addPiece, createLayout } from '../src/rules/baseBuild';
import { loadLayout, serializeLayout } from '../src/rules/baseSave';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { stepWalker, WALKER } from '../src/rules/walker';
import { aimWood, checkWood, containerShells, createWoodLayout, loadWood, pickupBasicBench, placeWood, removeWood,
  woodBounds, woodBoxes, woodSurface, WOOD_PARTS, type WoodKind, type WoodSpec } from '../src/rules/woodBuild';

const spec = (kind: WoodKind, extra: Partial<WoodSpec> = {}): WoodSpec => ({ kind, gx: 0, gz: 0, level: 0, rot: 0, ...extra });
function pack() {
  const inv = createInventory();
  addItem(inv, 'wood', 160);
  addItem(inv, 'build_hammer', 1);
  addItem(inv, 'log', 20);
  addItem(inv, 'planer', 1);
  addItem(inv, 'basic_bench', 1);
  return inv;
}

describe('wood building', () => {
  it.each(Object.keys(WOOD_PARTS) as WoodKind[])('builds %s using exactly its cost and a hammer', kind => {
    const wood = createWoodLayout(), base = createLayout(), inv = pack();
    expect(placeWood(wood, base, spec(kind), inv).ok).toBe(true);
    expect(wood.pieces).toHaveLength(1);
    expect(countItem(inv, 'wood')).toBe(160 - WOOD_PARTS[kind].cost);
    if (kind === 'workbench') {
      expect(countItem(inv, 'log')).toBe(14);
      expect(countItem(inv, 'planer')).toBe(0);
    }
    expect(woodBoxes(wood).length).toBeGreaterThan(0);
    expect(woodBoxes(wood).every(b => b.height > 0 && b.hx > 0 && b.hz > 0)).toBe(true);
  });
  it('rejects missing hammer, materials, duplicate sockets and floating pieces atomically', () => {
    const wood = createWoodLayout(), base = createLayout(), inv = createInventory();
    addItem(inv, 'wood', 20);
    expect(placeWood(wood, base, spec('wall'), inv).ok).toBe(false);
    addItem(inv, 'build_hammer', 1);
    expect(placeWood(wood, base, spec('floor', { level: 1 }), inv).ok).toBe(false);
    expect(countItem(inv, 'wood')).toBe(20);
    expect(placeWood(wood, base, spec('wall'), inv).ok).toBe(true);
    expect(placeWood(wood, base, spec('wall'), inv).ok).toBe(false);
    expect(placeWood(wood, base, spec('garage', { gx: 5 }), inv).ok).toBe(true);
    expect(placeWood(wood, base, spec('door', { gx: 9 }), inv).ok).toBe(false);
    expect(countItem(inv, 'wood')).toBe(0);
  });
  it('allows floor, joined wall corners and rails to share different sockets', () => {
    const wood = createWoodLayout(), base = createLayout(), inv = pack();
    for (const p of [spec('floor'), spec('wall'), spec('wall', { rot: 1 }), spec('railing', { gz: 2 })])
      expect(placeWood(wood, base, p, inv).ok).toBe(true);
  });
  it.each([0, 1] as const)('cuts actual container walls with orientation %s, preserving the floor and roof', rot => {
    const base = createLayout(), wood = createWoodLayout();
    const container = addPiece(base, { kind: 'ft20', gx: 1, gz: 1, level: 0, rot, color: 0 })!;
    const p = aimWood('door', { x: 2 * SHIPPING.cell, y: 1, z: SHIPPING.cell }, 0, 0,
      { id: container.id, normalX: 0, normalZ: -1 }, base);
    expect(placeWood(wood, base, p, pack()).ok).toBe(true);
    const b = woodBounds(p), y = 1;
    const blocked = (boxes: ReturnType<typeof woodBoxes>) => boxes.some(box => Math.abs(b.x + .03 - box.x) < box.hx &&
      Math.abs(b.z - box.z) < box.hz && box.y0 < y && box.y0 + box.height > y);
    expect(blocked(containerShells(base, wood))).toBe(false);
    expect(blocked(woodBoxes(wood))).toBe(true);
    wood.pieces[0].open = true;
    expect(blocked(woodBoxes(wood))).toBe(false);
    expect(containerShells(base, wood).some(box => box.y0 > SHIPPING.height - .2)).toBe(true);
    expect(removeWood(wood, base, wood.pieces[0].id)).toBeNull();
    expect(containerShells(base, wood)).toHaveLength(1);
  });
  it('rejects openings away from their host wall, and solid pieces inside containers', () => {
    const base = createLayout(), wood = createWoodLayout(), inv = pack();
    const host = addPiece(base, { kind: 'ft20', gx: 0, gz: 0, level: 0, rot: 0, color: 0 })!;
    expect(placeWood(wood, base, spec('door', { gz: 1, containerId: host.id }), inv).ok).toBe(false);
    expect(placeWood(wood, base, spec('floor'), inv).ok).toBe(false);
    expect(countItem(inv, 'wood')).toBe(160);
  });
  it('snaps decks outside container walls and floors on odd-grid roofs', () => {
    const base = createLayout();
    const host = addPiece(base, { kind: 'ft20', gx: 1, gz: 1, level: 0, rot: 0, color: 0 })!;
    const point = { x: 3 * SHIPPING.cell, y: 0, z: SHIPPING.cell };
    const deck = aimWood('deck', point, 0, 0, { id: host.id, normalX: 0, normalZ: -1 }, base);
    expect(deck.gz).toBe(-1);
    expect(checkWood(createWoodLayout(), base, deck)).toBeNull();
    const floor = aimWood('floor', point, 0, 1, { id: host.id, normalX: 0, normalZ: 0 }, base);
    expect(floor.gz).toBe(1);
    expect(checkWood(createWoodLayout(), base, floor)).toBeNull();
  });
  it('prevents removing supports and climbs stairs without teleporting onto roofs', () => {
    const base = createLayout(), wood = createWoodLayout(), inv = pack();
    expect(placeWood(wood, base, spec('stairs'), inv).ok).toBe(true);
    expect(placeWood(wood, base, spec('floor', { level: 1, gx: 2 }), inv).ok).toBe(true);
    expect(removeWood(wood, base, 1)).toContain('supported');
    let height = 0;
    for (let i = 0; i < 18; i++)
      height = woodSurface(wood, base, (i + .5) * SHIPPING.cell * 4 / 18, SHIPPING.cell, height, 0);
    expect(height).toBeCloseTo(SHIPPING.height + .12);
    expect(woodSurface(wood, base, SHIPPING.cell, SHIPPING.cell, 0, 0)).toBe(0);
    expect(removeWood(wood, base, 2)).toBeNull();
    expect(removeWood(wood, base, 1)).toBeNull();
  });
  it('lets the actual walking circle ascend stairs with collision checks enabled', () => {
    const base = createLayout(), wood = createWoodLayout();
    placeWood(wood, base, spec('stairs'), pack());
    const walker = { x: -.6, z: SHIPPING.cell, yaw: Math.PI / 2, pitch: 0 };
    let height = 0;
    for (let n = 0; n < 100; n++) {
      height = woodSurface(wood, base, walker.x, walker.z, height, 0);
      const solids = woodBoxes(wood).filter(b => b.y0 < height + WALKER.eyeHeight && b.y0 + b.height > height + .35);
      stepWalker(walker, { forward: 1, right: 0, run: false }, 1 / 60, solids, []);
      height = woodSurface(wood, base, walker.x, walker.z, height, 0);
    }
    expect(walker.x).toBeGreaterThan(4.5);
    expect(height).toBeGreaterThan(2.4);
  });
  it('persists open state and remaps host ids after container removal/reload', () => {
    const base = createLayout(), wood = createWoodLayout();
    base.nextId = 12;
    const host = addPiece(base, { kind: 'ft20', gx: 0, gz: 0, level: 0, rot: 0, color: 0 })!;
    expect(placeWood(wood, base, spec('window', { containerId: host.id }), pack()).ok).toBe(true);
    wood.pieces[0].open = true;
    const restored = createLayout(), ids = new Map<number, number>();
    loadLayout(restored, serializeLayout(base), ids);
    const loaded = createWoodLayout();
    expect(loadWood(loaded, restored, JSON.stringify(wood.pieces), ids)).toBe(1);
    expect(loaded.pieces[0].containerId).toBe(1);
    expect(loaded.pieces[0].open).toBe(true);
    expect(containerShells(restored, loaded).length).toBeGreaterThan(1);
  });
  it('rejects invalid saves without partially loading them', () => {
    const wood = createWoodLayout();
    expect(() => loadWood(wood, createLayout(), JSON.stringify([{ ...spec('floor'), id: 1 }, { ...spec('wall'), level: -1 }]))).toThrow();
    expect(wood.pieces).toHaveLength(0);
    expect(() => loadWood(wood, createLayout(), '[{"kind":"constructor"}]')).toThrow();
  });
  it('deploys a toolbox from nearby car storage without a hammer and packs it up atomically', () => {
    const wood = createWoodLayout(), base = createLayout(), inventory = createInventory(1), car = createInventory(1);
    addItem(car, 'basic_bench', 1);
    const bench = spec('basicbench', { gx: 500, gz: -500, y: 120 });
    expect(placeWood(wood, base, bench, inventory, [car, car]).ok).toBe(true);
    expect(countItem(car, 'basic_bench')).toBe(0);
    expect(woodBounds(wood.pieces[0]).y0).toBe(120);
    addItem(inventory, 'rope', 5);
    expect(pickupBasicBench(wood, base, 1, inventory).ok).toBe(false);
    expect(wood.pieces).toHaveLength(1);
    inventory.slots[0] = null;
    expect(pickupBasicBench(wood, base, 1, inventory).ok).toBe(true);
    expect(countItem(inventory, 'basic_bench')).toBe(1);
    expect(wood.pieces).toHaveLength(0);
    expect(pickupBasicBench(wood, base, 1, inventory).ok).toBe(false);
  });
  it('saves portable benches at their independent ground elevation', () => {
    const wood = createWoodLayout(), base = createLayout();
    placeWood(wood, base, spec('basicbench', { y: 72 }), pack());
    const restored = createWoodLayout();
    loadWood(restored, base, JSON.stringify(wood.pieces));
    expect(restored.pieces[0].y).toBe(72);
    expect(woodBoxes(restored)[0].y0).toBe(72);
    expect(checkWood(restored, base, spec('floor', { y: 72 }))).toBe('Invalid bench height');
  });
});
