import { describe, expect, it } from 'vitest';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { chopTree, TREE_HITS, TREE_LOGS, type HarvestTree } from '../src/rules/treeHarvest';
import { createRapierSim } from '../src/lab/rapierSim';
import { SHIPPING } from '../src/data/shippingContainers';
import { addPiece, createLayout } from '../src/rules/baseBuild';
import { containerShells, createWoodLayout, woodBoxes } from '../src/rules/woodBuild';

const tree = (): HarvestTree => ({ x: 0, z: 8, hits: 0, cut: false });
describe('tree harvesting', () => {
  it('requires an axe, three chops and awards logs exactly once', () => {
    const t = tree(), inv = createInventory();
    expect(chopTree(t, inv).ok).toBe(false);
    expect(t.hits).toBe(0);
    addItem(inv, 'axe', 1);
    for (let i = 0; i < TREE_HITS - 1; i++) expect(chopTree(t, inv).felled).toBe(false);
    expect(chopTree(t, inv).felled).toBe(true);
    expect(countItem(inv, 'log')).toBe(TREE_LOGS);
    expect(chopTree(t, inv).ok).toBe(false);
    expect(countItem(inv, 'log')).toBe(TREE_LOGS);
  });
  it('does not destroy the tree or lose logs when the pack is full', () => {
    const t = tree(), inv = createInventory(1);
    addItem(inv, 'axe', 1);
    chopTree(t, inv); chopTree(t, inv);
    expect(chopTree(t, inv).ok).toBe(false);
    expect(t.cut).toBe(false);
    expect(t.hits).toBe(2);
    inv.slots.push(null);
    expect(chopTree(t, inv).felled).toBe(true);
  });
  it.each(['prop', 'town'] as const)('removes %s tree collisions from the driving world', async kind => {
    const physics = await createRapierSim({
      ground: () => 0, carSpawn: { x: 0, z: 0, yaw: 0 },
      props: kind === 'prop' ? [{ kind: 'tree', x: 0, z: 8, yaw: 0, scale: 1 }] : [],
      boxes: kind === 'town' ? [{ x: 0, z: 8, hx: .2, hz: .2, height: 5, tree: true }] : [],
    });
    for (let i = 0; i < 420; i++) physics.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: 0, brake: i > 120 ? 0 : 1 });
    expect(physics.chassis().position[2]).toBeLessThan(6);
    physics.removeTree!(0, 8);
    for (let i = 0; i < 240; i++) physics.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    expect(physics.chassis().position[2]).toBeGreaterThan(12);
  });
  it('drives through an opened container garage, but not a closed one', async () => {
    const base = createLayout(), wood = createWoodLayout();
    const host = addPiece(base, { kind: 'ft40', gx: 0, gz: 0, level: 0, rot: 1, color: 0 })!;
    wood.pieces.push({ id: 1, kind: 'garage', gx: 0, gz: 0, level: 0, rot: 0, containerId: host.id });
    const physics = await createRapierSim({ ground: () => 0,
      carSpawn: { x: SHIPPING.cell, z: -7, yaw: 0 }, buildBoxes: [...containerShells(base, wood), ...woodBoxes(wood)] });
    for (let i = 0; i < 420; i++) physics.step(1 / 60, { throttle: i > 120 ? 1 : 0, steer: 0, brake: i > 120 ? 0 : 1 });
    expect(physics.chassis().position[2]).toBeLessThan(0);
    wood.pieces[0].open = true;
    physics.setBuildBoxes!([...containerShells(base, wood), ...woodBoxes(wood)]);
    for (let i = 0; i < 240; i++) physics.step(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    expect(physics.chassis().position[2]).toBeGreaterThan(3);
  });
});
