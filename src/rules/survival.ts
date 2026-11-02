import { ITEMS } from '../data/items';
import { removeItem, type Inventory } from './inventory';

// Hunger and thirst. Both bars run from 100 (full) down to 0 (empty) and drain with time.
// Nothing kills you yet: an empty bar only makes you weak (slower on foot).

export const SURVIVAL = {
  max: 100,
  hungerPerSecond: 100 / 1200, // full to empty in 20 minutes
  thirstPerSecond: 100 / 720, // full to empty in 12 minutes
  weakSpeedScale: 0.6, // walking speed multiplier while either bar is empty
  lowBelow: 25, // the HUD warns under this
};

export interface Survival {
  hunger: number;
  thirst: number;
}

export function createSurvival(): Survival {
  return { hunger: SURVIVAL.max, thirst: SURVIVAL.max };
}

export function stepSurvival(s: Survival, dt: number): void {
  s.hunger = Math.max(0, s.hunger - SURVIVAL.hungerPerSecond * dt);
  s.thirst = Math.max(0, s.thirst - SURVIVAL.thirstPerSecond * dt);
}

export function isWeak(s: Survival): boolean {
  return s.hunger <= 0 || s.thirst <= 0;
}

export type ConsumeResult =
  | { ok: true; itemId: string; restored: number }
  | { ok: false; reason: 'none' | 'full' };

/**
 * Eats or drinks one item from the inventory. Picks the item that fits the need best: the smallest
 * one that fills the gap, or the biggest if none do. Does nothing if the bar is already full.
 */
export function consume(s: Survival, inv: Inventory, kind: 'food' | 'drink'): ConsumeResult {
  const bar = kind === 'food' ? 'hunger' : 'thirst';
  const carried = [...new Set(inv.slots.flatMap((slot) => (slot && ITEMS[slot.id].kind === kind ? [slot.id] : [])))];
  if (carried.length === 0) return { ok: false, reason: 'none' };
  if (s[bar] >= SURVIVAL.max) return { ok: false, reason: 'full' };
  const gap = SURVIVAL.max - s[bar];
  const byValue = carried.sort((a, b) => (ITEMS[a].restores ?? 0) - (ITEMS[b].restores ?? 0));
  const itemId = byValue.find((id) => (ITEMS[id].restores ?? 0) >= gap) ?? byValue[byValue.length - 1];
  removeItem(inv, itemId, 1);
  const before = s[bar];
  s[bar] = Math.min(SURVIVAL.max, before + (ITEMS[itemId].restores ?? 0));
  return { ok: true, itemId, restored: s[bar] - before };
}
