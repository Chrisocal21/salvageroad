import { describe, expect, it } from 'vitest';
import { BED_SPOTS, bedLoad } from '../src/rules/bedLoad';
import { addItem } from '../src/rules/inventory';
import { createStorage } from '../src/rules/vehicleStorage';

describe('what the bed shows', () => {
  it('is empty when nothing is stored', () => {
    expect(bedLoad(createStorage())).toEqual([]);
  });

  it('shows tires as stacks of up to three', () => {
    const bed = createStorage();
    addItem(bed, 'tire', 2);
    expect(bedLoad(bed)).toEqual([{ look: 'tire', count: 2 }]);
    addItem(bed, 'tire', 5);
    expect(bedLoad(bed).map((p) => p.count)).toEqual([3, 3, 1]);
  });

  it('shows each motor on its own, ahead of the tires', () => {
    const bed = createStorage();
    addItem(bed, 'tire', 1);
    addItem(bed, 'motor', 1);
    addItem(bed, 'motor', 1);
    expect(bedLoad(bed).map((p) => p.look)).toEqual(['motor', 'motor', 'tire']);
  });

  it('shows a few small things as themselves', () => {
    const bed = createStorage();
    addItem(bed, 'canned_beans', 3);
    addItem(bed, 'wrench', 1);
    expect(bedLoad(bed)).toEqual([{ look: 'food', count: 3 }, { look: 'tool', count: 1 }]);
  });

  it('turns a bunch of small things into one supply crate', () => {
    const bed = createStorage();
    addItem(bed, 'canned_beans', 3);
    addItem(bed, 'wrench', 1);
    addItem(bed, 'water_bottle', 2);
    addItem(bed, 'rope', 2);
    expect(bedLoad(bed)).toEqual([{ look: 'crate', count: 8 }]);
  });

  it('shows a big rig tire taking a whole row, ahead of everything else', () => {
    const bed = createStorage();
    addItem(bed, 'tire', 1);
    addItem(bed, 'rig_tire', 1);
    expect(bedLoad(bed)).toEqual([{ look: 'rig_tire', count: 1, spots: 2 }, { look: 'tire', count: 1 }]);
    // Four more places are left in the bed after it.
    for (let i = 0; i < 6; i++) addItem(bed, 'motor', 1);
    const shown = bedLoad(bed);
    expect(shown.length).toBe(5);
    expect(shown[0].look).toBe('rig_tire');
  });

  it('keeps big things beside the crate and never draws more than the bed has room for', () => {
    const bed = createStorage();
    addItem(bed, 'motor', 1);
    for (const id of ['canned_beans', 'wrench', 'water_bottle', 'rope']) addItem(bed, id, 1);
    expect(bedLoad(bed).map((p) => p.look)).toEqual(['motor', 'crate']);
    for (let i = 0; i < 10; i++) addItem(bed, 'motor', 1);
    expect(bedLoad(bed).length).toBe(BED_SPOTS);
  });
});
