import { describe, expect, it } from 'vitest';
import { bedLoad } from '../src/rules/bedLoad';
import { addItem } from '../src/rules/inventory';
import { createStorage } from '../src/rules/vehicleStorage';
import { createBedView } from '../src/render/bedLoad';

describe('physical bed layout', () => {
  it('mounts mixed tire sizes upright in four distinct positions', () => {
    const bed = createStorage();
    addItem(bed, 'tire', 2); addItem(bed, 'rig_tire', 2);
    expect(bedLoad(bed).map(p => p.rackIndex)).toEqual([0, 1, 2, 3]);
    const view = createBedView(); view.update(bed);
    const rack = view.group.getObjectByName('Four tire rack')!;
    const tires = rack.children.filter(c => c.name.startsWith('Secured tire'));
    expect(tires).toHaveLength(4);
    expect(tires[0].scale.x).toBeLessThan(tires[2].scale.x);
    expect(new Set(tires.map(t => t.position.x)).size).toBe(4);
    view.update(createStorage()); expect(view.group.children).toHaveLength(0);
  });
  it('packs 24 cargo stacks into six crates, two columns three high', () => {
    const bed = createStorage();
    expect(addItem(bed, 'wrench', 24)).toBe(0);
    const props = bedLoad(bed);
    expect(props).toHaveLength(6);
    expect(props.map(p => [p.column, p.level])).toEqual([[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]]);
    const view = createBedView(); view.update(bed);
    expect(view.group.children.every(c => c.position.z === -2.2)).toBe(true);
    expect(new Set(view.group.children.map(c => c.position.y)).size).toBe(3);
  });
  it('reserves an entire cargo column for each engine', () => {
    const bed = createStorage();
    addItem(bed, 'motor', 1); addItem(bed, 'wrench', 12);
    expect(bedLoad(bed).map(p => [p.look, p.column])).toEqual([['motor',0],['crate',1],['crate',1],['crate',1]]);
  });
});
