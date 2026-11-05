import { describe, expect, it } from 'vitest';
import { CONTAINERS } from '../src/data/containers';
import { ITEMS } from '../src/data/items';
import { craftBuildHammer, HAMMER_LOG_COST } from '../src/rules/buildHammer';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { findTarget } from '../src/rules/interaction';
import { newContainerState, openContainer } from '../src/rules/loot';
import { boxesOverlap, generateTown, reachableContainers } from '../src/rules/town';
import { WORTH } from '../src/rules/trade';

describe('build hammer crafting', () => {
  it('defines stack sizes and barter values', () => {
    expect(ITEMS.wood).toMatchObject({ name: 'wood planks', kind: 'material', stack: 40 });
    expect(ITEMS.log).toMatchObject({ name: 'log', kind: 'material', stack: 20 });
    expect(ITEMS.build_hammer).toMatchObject({ kind: 'tool', stack: 1 });
    expect(WORTH.wood).toBeGreaterThan(0);
    expect(WORTH.build_hammer).toBeGreaterThan(0);
    expect(HAMMER_LOG_COST).toBe(1);
  });

  it('fails without logs even if planks are available without changing anything', () => {
    const inv = createInventory();
    addItem(inv, 'wood', 20);
    const before = structuredClone(inv);
    expect(craftBuildHammer(inv)).toMatchObject({ ok: false, message: expect.stringContaining('1 log') });
    expect(inv).toEqual(before);
  });

  it('consumes exactly one log and leaves unrelated items alone', () => {
    const inv = createInventory(4);
    inv.slots = [{ id: 'log', count: 2 }, { id: 'rope', count: 3 }, { id: 'wood', count: 5 }, null];
    expect(craftBuildHammer(inv)).toMatchObject({ ok: true });
    expect(countItem(inv, 'log')).toBe(1);
    expect(countItem(inv, 'wood')).toBe(5);
    expect(countItem(inv, 'rope')).toBe(3);
    expect(countItem(inv, 'build_hammer')).toBe(1);
  });

  it('does not consume logs or mutate existing stacks when the result cannot fit', () => {
    const inv = createInventory(2);
    addItem(inv, 'log', 5);
    addItem(inv, 'build_hammer', 1);
    const before = structuredClone(inv);
    const wood = inv.slots[0];
    expect(craftBuildHammer(inv)).toMatchObject({ ok: false, message: expect.stringContaining('No room') });
    expect(inv).toEqual(before);
    expect(inv.slots[0]).toBe(wood);
  });

  it('can use the slot freed by consuming the final log, even with no empty slots', () => {
    const inv = createInventory(2);
    addItem(inv, 'log', 1);
    addItem(inv, 'rope', 5);
    expect(craftBuildHammer(inv)).toMatchObject({ ok: true });
    expect(inv.slots).toEqual([{ id: 'build_hammer', count: 1 }, { id: 'rope', count: 5 }]);
  });
});

describe('town wood supplies', () => {
  it.each(['crate', 'hardware_shelf'] as const)('%s rolls logs deterministically', kind => {
    expect(CONTAINERS[kind].loot.some(entry => entry.item === 'log')).toBe(true);
    expect(CONTAINERS[kind].loot.some(entry => entry.item === 'wood')).toBe(false);
    let foundWood = false;
    for (let seed = 0; seed < 80; seed++) {
      const a = createInventory(40), b = createInventory(40);
      openContainer(newContainerState(kind), seed, 7, a);
      openContainer(newContainerState(kind), seed, 7, b);
      expect(a).toEqual(b);
      foundWood ||= countItem(a, 'log') > 0;
    }
    expect(foundWood).toBe(true);
  });

  it.each([1, 7, 42, 100])('provides reachable, deterministic ground bundles for seed %i', seed => {
    for (const options of [{}, { junkyard: false }, { grid: 2, neighborhood: 'homes' as const },
      { grid: 2, neighborhood: 'business' as const }, { grid: 5, neighborhood: 'apartments' as const }]) {
      const town = generateTown(seed, { x: 130, z: 250 }, { ...options, containerOffset: 500 });
      expect(town).toEqual(generateTown(seed, { x: 130, z: 250 }, { ...options, containerOffset: 500 }));
      const bundles = town.containers.filter(c => c.kind === 'wood_bundle');
      expect(bundles.length).toBeGreaterThan(0);
      expect(new Set(town.containers.map(c => c.id)).size).toBe(town.containers.length);
      for (const bundle of bundles) {
        expect(bundle.id).toBeGreaterThanOrEqual(500);
        expect(bundle.inside).toBeUndefined();
        expect(town.solids.some(s => boxesOverlap(s, bundle, 0.1))).toBe(false);
        expect(town.containers.some(c => c !== bundle && boxesOverlap(c, bundle, 0.1))).toBe(false);
        const walker = { x: bundle.x, z: bundle.z - 1.3, yaw: 0, pitch: 0 };
        expect(findTarget(walker, { containers: reachableContainers(town, walker.x, walker.z), truck: null }))
          .toEqual({ kind: 'container', id: bundle.id });
        const state = newContainerState(bundle.kind, bundle.fixedLoot);
        const inv = createInventory();
        openContainer(state, seed, bundle.id, inv);
        expect(countItem(inv, 'log')).toBe(8);
        expect(countItem(inv, 'build_hammer')).toBe(0);
        expect(openContainer(state, seed, bundle.id, inv).wasEmpty).toBe(true);
        expect(countItem(inv, 'log')).toBe(8);
        expect(craftBuildHammer(inv).ok).toBe(true);
      }
    }
  });

  it('leaves a ground bundle available when the pack is full', () => {
    const bundle = generateTown(1).containers.find(c => c.kind === 'wood_bundle')!;
    const state = newContainerState(bundle.kind, bundle.fixedLoot);
    const inv = createInventory(1);
    addItem(inv, 'rope', 5);
    expect(openContainer(state, 1, bundle.id, inv).leftBehind).toBe(true);
    expect(state.contents).toEqual([{ id: 'log', count: 8 }]);
    inv.slots[0] = null;
    expect(openContainer(state, 1, bundle.id, inv).leftBehind).toBe(false);
    expect(countItem(inv, 'log')).toBe(8);
  });
});
