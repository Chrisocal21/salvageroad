import { ITEMS } from '../data/items';
import { addItem, createInventory, type Inventory } from './inventory';

// Storage on a vehicle: the El Cajon's bed. It is just another inventory, so every vehicle can have its own.

export const BED_SLOTS = 28;
export const BOX_TRUCK_SLOTS = 96;

export function createBoxStorage(): Inventory {
  return createInventory(BOX_TRUCK_SLOTS);
}

export function createStorage(slots = BED_SLOTS): Inventory {
  return { ...createInventory(slots), storage: 'vehicle' };
}

export interface MoveResult {
  moved: number;
  /** Set when nothing could move. */
  reason?: 'empty' | 'full';
}

/** Moves the whole stack in one slot from one inventory to another. What does not fit stays where it was. */
export function moveStack(from: Inventory, index: number, to: Inventory): MoveResult {
  const stack = from.slots[index];
  if (!stack) return { moved: 0, reason: 'empty' };
  const notFit = addItem(to, stack.id, stack.count);
  const moved = stack.count - notFit;
  if (moved === 0) return { moved: 0, reason: 'full' };
  if (notFit === 0) from.slots[index] = null;
  else stack.count = notFit;
  return { moved };
}

/** Moves everything that fits. Returns how many items moved. */
export function moveAll(from: Inventory, to: Inventory): number {
  let total = 0;
  for (let i = 0; i < from.slots.length; i++) total += moveStack(from, i, to).moved;
  return total;
}

export function describeMove(from: Inventory, index: number): string {
  const s = from.slots[index];
  return s ? `${s.count} ${ITEMS[s.id].name}` : 'nothing';
}
