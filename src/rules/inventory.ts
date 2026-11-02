import { ITEMS } from '../data/items';

// What the player carries: a fixed number of slots, each holding one kind of item up to its stack size.

export interface ItemStack {
  id: string;
  count: number;
}

export interface Inventory {
  slots: (ItemStack | null)[];
}

export const INVENTORY_SLOTS = 12;

export function createInventory(slotCount = INVENTORY_SLOTS): Inventory {
  return { slots: Array.from({ length: slotCount }, () => null) };
}

/** Adds items, topping up existing stacks first. Returns how many did NOT fit. */
export function addItem(inv: Inventory, id: string, count: number): number {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  let left = count;
  for (const slot of inv.slots) {
    if (left <= 0) break;
    if (slot && slot.id === id && slot.count < def.stack) {
      const put = Math.min(left, def.stack - slot.count);
      slot.count += put;
      left -= put;
    }
  }
  for (let i = 0; i < inv.slots.length && left > 0; i++) {
    if (inv.slots[i] === null) {
      const put = Math.min(left, def.stack);
      inv.slots[i] = { id, count: put };
      left -= put;
    }
  }
  return left;
}

export function countItem(inv: Inventory, id: string): number {
  return inv.slots.reduce((sum, s) => sum + (s && s.id === id ? s.count : 0), 0);
}

/** Removes items. Returns false and changes nothing if there are not enough. */
export function removeItem(inv: Inventory, id: string, count: number): boolean {
  if (countItem(inv, id) < count) return false;
  let left = count;
  for (let i = inv.slots.length - 1; i >= 0 && left > 0; i--) {
    const slot = inv.slots[i];
    if (slot && slot.id === id) {
      const take = Math.min(left, slot.count);
      slot.count -= take;
      left -= take;
      if (slot.count === 0) inv.slots[i] = null;
    }
  }
  return true;
}

export function usedSlots(inv: Inventory): number {
  return inv.slots.filter((s) => s !== null).length;
}

/** One line such as "3 canned beans, 1 wrench", or "nothing" when empty. */
export function describeInventory(inv: Inventory): string {
  const totals = new Map<string, number>();
  for (const s of inv.slots) if (s) totals.set(s.id, (totals.get(s.id) ?? 0) + s.count);
  if (totals.size === 0) return 'nothing';
  return [...totals].map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', ');
}
