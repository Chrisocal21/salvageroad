import { ITEMS } from '../data/items';
import { addItem, countItem, removeItem, type Inventory } from './inventory';

export const TOOL_RECIPES: Record<'axe' | 'planer', { name: string; ingredients: Record<string, number> }> = {
  axe: { name: 'axe', ingredients: { log: 2, scrap_metal: 3, rope: 1 } },
  planer: { name: 'planer', ingredients: { log: 2, scrap_metal: 6 } },
};

function convert(inventory: Inventory, ingredients: Record<string, number>, id: string, count: number): { ok: boolean; message: string } {
  for (const [ingredient, amount] of Object.entries(ingredients)) {
    if (countItem(inventory, ingredient) < amount) {
      return { ok: false, message: `Need ${amount} ${ITEMS[ingredient].name}.` };
    }
  }
  const trial: Inventory = { ...inventory, slots: inventory.slots.map(slot => slot ? { ...slot } : null) };
  for (const [ingredient, amount] of Object.entries(ingredients)) removeItem(trial, ingredient, amount);
  if (addItem(trial, id, count) !== 0) {
    return { ok: false, message: `No room for ${count} ${ITEMS[id].name}.` };
  }
  inventory.slots.splice(0, inventory.slots.length, ...trial.slots);
  return { ok: true, message: `Crafted ${count} ${ITEMS[id].name}.` };
}

export function craftWoodTool(inventory: Inventory, id: 'axe' | 'planer'): { ok: boolean; message: string } {
  return convert(inventory, TOOL_RECIPES[id].ingredients, id, 1);
}

/** Converts only; the caller checks access to a nearby placed workbench. */
export function planeLog(inventory: Inventory): { ok: boolean; message: string } {
  return convert(inventory, { log: 1 }, 'wood', 4);
}
