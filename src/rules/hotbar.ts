import type { Inventory } from './inventory';

export const HOTBAR_SIZE = 10;
export const hotbarLabel = (index: number) => index === 9 ? '0' : String(index + 1);
export function hotbarIndex(code: string): number | null {
  const match = /^Digit([0-9])$/.exec(code);
  return match ? (Number(match[1]) + 9) % 10 : null;
}
export function assignHotbar(inventory: Inventory, source: number, target: number): boolean {
  if (!Number.isInteger(source) || !Number.isInteger(target) || source < 0 || source >= inventory.slots.length ||
    target < 0 || target >= Math.min(HOTBAR_SIZE, inventory.slots.length) || !inventory.slots[source]) return false;
  [inventory.slots[source], inventory.slots[target]] = [inventory.slots[target], inventory.slots[source]];
  return true;
}
