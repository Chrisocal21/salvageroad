import { describe, expect, it } from 'vitest';
import { CONTAINERS } from '../src/data/containers';
import { ITEMS } from '../src/data/items';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { findTarget } from '../src/rules/interaction';
import { newContainerState, openContainer } from '../src/rules/loot';
import { generateTown, reachableContainers } from '../src/rules/town';
import { WORTH } from '../src/rules/trade';
import { craftWoodTool, planeLog, TOOL_RECIPES } from '../src/rules/woodCraft';

describe('wood tool crafting', () => {
  it('defines recipes and material/tool data', () => {
    expect(TOOL_RECIPES).toEqual({
      axe: { name: 'axe', ingredients: { log: 2, scrap_metal: 3, rope: 1 } },
      planer: { name: 'planer', ingredients: { log: 2, scrap_metal: 6 } },
    });
    expect(ITEMS.log).toMatchObject({ name: 'log', kind: 'material', stack: 20 });
    expect(ITEMS.wood.name).toBe('wood planks');
    expect(CONTAINERS.wood_bundle.name).toBe('log pile');
    for (const id of ['axe', 'planer']) {
      expect(ITEMS[id]).toMatchObject({ name: id, kind: 'tool', stack: 1 });
      expect(WORTH[id]).toBeGreaterThan(0);
    }
    expect(WORTH.log).toBeGreaterThan(WORTH.wood);
  });

  it.each(['axe', 'planer'] as const)('crafts %s using slots freed by ingredients', id => {
    const ingredients = Object.entries(TOOL_RECIPES[id].ingredients);
    const inv = createInventory(ingredients.length);
    for (const [ingredient, amount] of ingredients) addItem(inv, ingredient, amount);
    const slots = inv.slots;
    expect(craftWoodTool(inv, id).ok).toBe(true);
    expect(inv.slots).toBe(slots);
    expect(countItem(inv, id)).toBe(1);
    for (const [ingredient] of ingredients) expect(countItem(inv, ingredient)).toBe(0);
  });

  for (const id of ['axe', 'planer'] as const) {
    it.each(Object.keys(TOOL_RECIPES[id].ingredients))(`rejects ${id} with missing %s atomically`, missing => {
      const inv = createInventory();
      for (const [ingredient, amount] of Object.entries(TOOL_RECIPES[id].ingredients)) {
        addItem(inv, ingredient, amount - (ingredient === missing ? 1 : 0));
      }
      const before = structuredClone(inv);
      expect(craftWoodTool(inv, id).ok).toBe(false);
      expect(inv).toEqual(before);
    });
  }

  it.each(['axe', 'planer'] as const)('rejects %s overflow without losing ingredients', id => {
    const ingredients = Object.entries(TOOL_RECIPES[id].ingredients);
    const inv = createInventory(ingredients.length);
    for (const [ingredient, amount] of ingredients) addItem(inv, ingredient, amount + 1);
    const before = structuredClone(inv);
    const stacks = [...inv.slots];
    expect(craftWoodTool(inv, id)).toMatchObject({ ok: false, message: expect.stringContaining('No room') });
    expect(inv).toEqual(before);
    inv.slots.forEach((slot, i) => expect(slot).toBe(stacks[i]));
  });
});

describe('log planing', () => {
  it('converts one log to four planks with no tool or workbench policy in this rule', () => {
    const inv = createInventory(1);
    addItem(inv, 'log', 1);
    expect(planeLog(inv).ok).toBe(true);
    expect(inv.slots).toEqual([{ id: 'wood', count: 4 }]);
  });

  it('rejects missing logs without consuming planks', () => {
    const inv = createInventory(1);
    addItem(inv, 'wood', 4);
    const before = structuredClone(inv);
    expect(planeLog(inv).ok).toBe(false);
    expect(inv).toEqual(before);
  });

  it('rolls back partial output when four planks cannot fit', () => {
    const inv = createInventory(2);
    addItem(inv, 'log', 2);
    addItem(inv, 'wood', 38);
    const before = structuredClone(inv);
    const stack = inv.slots[1];
    expect(planeLog(inv)).toMatchObject({ ok: false, message: expect.stringContaining('No room') });
    expect(inv).toEqual(before);
    expect(inv.slots[1]).toBe(stack);
  });

  it('tops up planks while leaving the remaining logs untouched', () => {
    const inv = createInventory(2);
    addItem(inv, 'log', 2);
    addItem(inv, 'wood', 36);
    expect(planeLog(inv).ok).toBe(true);
    expect(countItem(inv, 'log')).toBe(1);
    expect(countItem(inv, 'wood')).toBe(40);
  });
});

describe('town wood tools', () => {
  it.each(['toolbox', 'hardware_shelf'] as const)('%s can roll both tools deterministically', kind => {
    const found = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const a = createInventory(), b = createInventory();
      openContainer(newContainerState(kind), seed, 7, a);
      openContainer(newContainerState(kind), seed, 7, b);
      expect(a).toEqual(b);
      for (const id of ['axe', 'planer']) if (countItem(a, id)) found.add(id);
    }
    expect([...found].sort()).toEqual(['axe', 'planer']);
  });

  it.each([1, 7, 42, 100])('guarantees accessible tools in the starter town for seed %i', seed => {
    const town = generateTown(seed);
    const toolbox = town.containers.find(c => c.kind === 'toolbox' && c.fixedLoot?.some(s => s.id === 'planer'))!;
    expect(toolbox).toBeDefined();
    expect(toolbox.inside).toBeUndefined();
    const walker = { x: toolbox.x - 1.3, z: toolbox.z, yaw: Math.PI / 2, pitch: 0 };
    expect(findTarget(walker, { containers: reachableContainers(town, walker.x, walker.z), truck: null }))
      .toEqual({ kind: 'container', id: toolbox.id });
    const inv = createInventory();
    openContainer(newContainerState(toolbox.kind, toolbox.fixedLoot), seed, toolbox.id, inv);
    for (const id of ['axe', 'planer', 'wrench', 'duct_tape']) expect(countItem(inv, id)).toBe(1);
  });
});
