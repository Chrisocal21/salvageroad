import { addItem, countItem, removeItem, type Inventory } from './inventory';

export const HAMMER_LOG_COST = 1;

/** Trial on a copy so a full inventory never consumes the ingredients. */
export function craftBuildHammer(inventory: Inventory): { ok: boolean; message: string } {
  if (countItem(inventory, 'log') < HAMMER_LOG_COST) {
    return { ok: false, message: `Need ${HAMMER_LOG_COST} log to craft a build hammer.` };
  }
  const trial: Inventory = { ...inventory, slots: inventory.slots.map(slot => slot ? { ...slot } : null) };
  removeItem(trial, 'log', HAMMER_LOG_COST);
  if (addItem(trial, 'build_hammer', 1) !== 0) {
    return { ok: false, message: 'No room for a build hammer.' };
  }
  inventory.slots.splice(0, inventory.slots.length, ...trial.slots);
  return { ok: true, message: 'Crafted a build hammer.' };
}
