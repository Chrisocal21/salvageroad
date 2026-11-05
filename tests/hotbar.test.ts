import { describe, expect, it } from 'vitest';
import { assignHotbar, HOTBAR_SIZE, hotbarIndex, hotbarLabel } from '../src/rules/hotbar';
import { createInventory } from '../src/rules/inventory';
import { ITEMS } from '../src/data/items';

describe('hotbar', () => {
  it('maps only the keyboard number row, with 0 in the tenth slot', () => {
    expect(HOTBAR_SIZE).toBe(10);
    for (let index = 0; index < 10; index++) expect(hotbarIndex(`Digit${hotbarLabel(index)}`)).toBe(index);
    for (const code of ['KeyK', 'Numpad1', 'Digit10', 'Digit', 'Key0']) expect(hotbarIndex(code)).toBeNull();
  });
  it('swaps whole stacks and rejects invalid or empty assignments without mutation', () => {
    const inv = createInventory();
    inv.slots[11] = { id: 'basic_bench', count: 1 };
    inv.slots[0] = { id: 'wood', count: 40 };
    expect(assignHotbar(inv, 11, 0)).toBe(true);
    expect(inv.slots[0]?.id).toBe('basic_bench');
    expect(inv.slots[11]).toEqual({ id: 'wood', count: 40 });
    const before = JSON.stringify(inv);
    for (const [source, target] of [[-1, 0], [12, 0], [1, 0], [0, 10], [.5, 0], [0, -1]])
      expect(assignHotbar(inv, source, target)).toBe(false);
    expect(JSON.stringify(inv)).toBe(before);
  });
  it('declares bench items placeable without treating materials as placeables', () => {
    expect(ITEMS.basic_bench.placeable).toBe('basicbench');
    expect(ITEMS.planer.placeable).toBe('workbench');
    expect(ITEMS.wood.placeable).toBeUndefined();
  });
});
