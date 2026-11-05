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

describe('bed capacity', () => {
  it('limits mixed tires to four and leaves partial transfers in the pack', () => {
    const bed = createStorage(), pack = createInventory();
    addItem(bed, 'rig_tire', 3); addItem(pack, 'tire', 4);
    expect(moveStack(pack, 0, bed).moved).toBe(1);
    expect(countItem(pack, 'tire')).toBe(3);
    expect(addItem(bed, 'rig_tire', 1)).toBe(1);
    moveStack(bed, 0, pack);
    expect(moveStack(pack, 0, bed).moved).toBe(1);
  });
  it('fits four tires plus 24 cargo stacks and rejects excess without losing it', () => {
    const bed = createStorage();
    expect(addItem(bed, 'rig_tire', 4)).toBe(0);
    expect(addItem(bed, 'wrench', 25)).toBe(1);
    expect(countItem(bed, 'wrench')).toBe(24);
    expect(addItem(bed, 'motor', 1)).toBe(1);
  });
  it('allows topping up existing stacks and replaces twelve cargo stacks with one engine', () => {
    const bed = createStorage();
    addItem(bed, 'motor', 1);
    expect(addItem(bed, 'wrench', 11)).toBe(0);
    expect(addItem(bed, 'canned_beans', 1)).toBe(0);
    expect(addItem(bed, 'canned_beans', 1)).toBe(0);
    expect(addItem(bed, 'water_bottle', 1)).toBe(1);
    expect(addItem(bed, 'motor', 1)).toBe(1);
    const empty = createStorage();
    expect(addItem(empty, 'motor', 3)).toBe(1);
  });
});
