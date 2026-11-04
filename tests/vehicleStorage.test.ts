import { describe, expect, it } from 'vitest';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { BED_SLOTS, createStorage, moveAll, moveStack } from '../src/rules/vehicleStorage';

describe('vehicle storage', () => {
  it('starts empty with the bed size', () => {
    const bed = createStorage();
    expect(bed.slots.length).toBe(BED_SLOTS);
    expect(bed.slots.every((s) => s === null)).toBe(true);
  });

  it('moves a stack from the pack to the bed and back', () => {
    const pack = createInventory();
    const bed = createStorage();
    addItem(pack, 'canned_beans', 3);
    expect(moveStack(pack, 0, bed).moved).toBe(3);
    expect(countItem(pack, 'canned_beans')).toBe(0);
    expect(countItem(bed, 'canned_beans')).toBe(3);
    expect(moveStack(bed, 0, pack).moved).toBe(3);
    expect(countItem(pack, 'canned_beans')).toBe(3);
  });

  it('leaves what does not fit where it was, and says why when nothing fits', () => {
    const pack = createInventory();
    const bed = createStorage(1);
    addItem(pack, 'wrench', 1);
    addItem(pack, 'duct_tape', 1);
    expect(moveStack(pack, 0, bed).moved).toBe(1);
    const r = moveStack(pack, 1, bed);
    expect(r).toEqual({ moved: 0, reason: 'full' });
    expect(countItem(pack, 'duct_tape')).toBe(1);
    expect(moveStack(pack, 5, bed)).toEqual({ moved: 0, reason: 'empty' });
  });

  it('moves everything that fits', () => {
    const pack = createInventory();
    const bed = createStorage();
    addItem(pack, 'canned_beans', 2);
    addItem(pack, 'wrench', 1);
    expect(moveAll(pack, bed)).toBe(3);
    expect(pack.slots.every((s) => s === null)).toBe(true);
  });
});
