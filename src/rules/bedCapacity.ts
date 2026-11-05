import { ITEMS } from '../data/items';
import type { Inventory } from './inventory';

export const TIRE_CAPACITY = 4;
export const CRATE_STACKS = 4;
export const CRATE_CAPACITY = 6;
export const STACKS_PER_COLUMN = 12;

export function bedUsage(inv: Inventory) {
  let tires = 0, motors = 0, stacks = 0;
  for (const slot of inv.slots) {
    if (!slot) continue;
    const look = ITEMS[slot.id].look;
    if (look === 'tire' || look === 'rig_tire') tires += slot.count;
    else if (look === 'motor') motors += slot.count;
    else stacks++;
  }
  return { tires, motors, stacks };
}

/** Physical space available, independent of the inventory's empty UI slots. */
export function bedRoom(inv: Inventory, id: string): number {
  const { tires, motors, stacks } = bedUsage(inv);
  const item = ITEMS[id];
  if (item.look === 'tire' || item.look === 'rig_tire') return Math.max(0, TIRE_CAPACITY - tires);
  const freeStacks = CRATE_CAPACITY * CRATE_STACKS - motors * STACKS_PER_COLUMN - stacks;
  if (item.look === 'motor') return Math.max(0, Math.floor(freeStacks / STACKS_PER_COLUMN));
  const topUp = inv.slots.reduce((n, slot) => n + (slot?.id === id ? item.stack - slot.count : 0), 0);
  return Math.max(0, freeStacks) * item.stack + topUp;
}

export function bedCapacityLabel(inv: Inventory): string {
  const u = bedUsage(inv);
  return `Tires ${u.tires}/4 | Cargo stacks ${u.stacks}/${24 - u.motors * 12} | Engines ${u.motors}/2`;
}
