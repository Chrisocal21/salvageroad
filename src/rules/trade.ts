import { addItem, countItem, removeItem, type Inventory } from './inventory';
import { makeRandom } from './scatter';
import { ITEMS } from '../data/items';

// Barter: no money. Every item has a worth in "units"; a trader gives you goods only for goods worth more than
// what you ask for (the trader's margin). You can push the trader to lower the margin, a few times; push too
// often and the trader stops dealing. Plain numbers, no rendering.

/** What each item is worth, in barter units. Content as data: add a row, no code. */
export const WORTH: Record<string, number> = {
  crackers: 4,
  jerky: 6,
  soda: 5,
  water_bottle: 8,
  canned_beans: 10,
  bandage: 12,
  duct_tape: 7,
  rope: 8,
  scrap_metal: 3,
  wood: 2,
  log: 6,
  axe: 30,
  planer: 32,
  basic_bench: 24,
  build_hammer: 8,
  batteries: 14,
  wrench: 30,
  tire: 45,
  motor: 220,
  rig_tire: 90,
  rig_engine: 450, rig_transmission: 260, rig_battery: 75, rig_fuel_tank: 110, rig_steering: 140,
  truck_radiator: 80, truck_brakes: 45, truck_exhaust: 55, truck_dash: 70, truck_seat: 50,
  truck_windshield: 65, truck_driver_door: 85, truck_passenger_door: 85, truck_hood: 100,
  truck_grille: 65, truck_headlight: 35, truck_front_bumper: 70, truck_rear_bumper: 60,
  truck_box_floor: 150, truck_box_panel: 90, truck_box_roof: 120, truck_box_door: 85,
};

export interface Offer {
  id: string;
  count: number;
}

export interface Trader {
  specialty: 'general' | 'tools-parts';
  /** Which place (index into plan.places) this trader's salvage yard belongs to. */
  placeId: number;
  name: string;
  stock: Offer[];
  /** How much more than the asked goods' worth the trader wants back. 1.3 means 30 percent more. */
  margin: number;
  /** The lowest margin this trader will ever come down to. */
  floor: number;
  /** How many more pushes before the trader stops dealing for now. */
  patience: number;
  refusing: boolean;
}

export const worthOf = (offers: Offer[]): number => offers.reduce((sum, o) => sum + (WORTH[o.id] ?? 0) * o.count, 0);

export interface Verdict {
  giveWorth: number;
  getWorth: number;
  /** What the trader wants for the goods asked for. */
  wanted: number;
  deal: boolean;
}

/** Whether the trader would take `give` for `get` as things stand. */
export function appraise(trader: Trader, give: Offer[], get: Offer[]): Verdict {
  const giveWorth = worthOf(give);
  const getWorth = worthOf(get);
  const wanted = Math.ceil(getWorth * trader.margin);
  return { giveWorth, getWorth, wanted, deal: !trader.refusing && getWorth > 0 && giveWorth >= wanted };
}

/** Push for a better price. Lowers the margin a little, down to the floor; costs patience. */
export function haggle(trader: Trader): 'better' | 'no_better' | 'refuses' {
  if (trader.patience <= 0) {
    trader.refusing = true;
    return 'refuses';
  }
  trader.patience--;
  if (trader.margin <= trader.floor + 1e-9) return 'no_better';
  trader.margin = Math.max(trader.floor, trader.margin - 0.08);
  return 'better';
}

export type TradeResult = { ok: true } | { ok: false; reason: 'not_enough_worth' | 'you_lack' | 'trader_lacks' | 'no_room' | 'empty' | 'invalid_offer' | 'refuses' };

function combine(offers: Offer[]): Offer[] | null {
  const totals = new Map<string, number>();
  for (const o of offers) {
    if (!ITEMS[o.id] || !Number.isSafeInteger(o.count) || o.count <= 0) return null;
    const count = (totals.get(o.id) ?? 0) + o.count;
    if (!Number.isSafeInteger(count)) return null;
    totals.set(o.id, count);
  }
  return [...totals].map(([id, count]) => ({ id, count }));
}

/** Carries out the swap if it is fair, you have what you give, the trader has what you ask, and it fits. */
export function trade(trader: Trader, inv: Inventory, give: Offer[], get: Offer[]): TradeResult {
  if (give.length === 0 || get.length === 0) return { ok: false, reason: 'empty' };
  const given = combine(give), requested = combine(get);
  if (!given || !requested) return { ok: false, reason: 'invalid_offer' };
  give = given; get = requested;
  if (trader.refusing) return { ok: false, reason: 'refuses' };
  if (!appraise(trader, give, get).deal) return { ok: false, reason: 'not_enough_worth' };
  for (const o of give) if (countItem(inv, o.id) < o.count) return { ok: false, reason: 'you_lack' };
  for (const o of get) if ((trader.stock.find((s) => s.id === o.id)?.count ?? 0) < o.count) return { ok: false, reason: 'trader_lacks' };
  const draft: Inventory = { slots: inv.slots.map(s => s ? { ...s } : null) };
  for (const o of give) removeItem(draft, o.id, o.count);
  let leftover = 0;
  for (const o of get) leftover += addItem(draft, o.id, o.count);
  if (leftover > 0) return { ok: false, reason: 'no_room' };
  inv.slots = draft.slots;
  for (const o of give) {
    const row = trader.stock.find((s) => s.id === o.id);
    if (row) row.count += o.count;
    else trader.stock.push({ id: o.id, count: o.count });
  }
  for (const o of get) trader.stock.find((s) => s.id === o.id)!.count -= o.count;
  trader.stock = trader.stock.filter((s) => s.count > 0);
  return { ok: true };
}

const TRADER_NAMES = ['Ines', 'Dutch', 'Mara', 'Wick', 'Odell', 'Petra', 'Hollis', 'Tamsin'];

/**
 * A trader for a place: a seeded stock of food, parts and goods, and a seeded temper (how high the first margin
 * is, how low it can go, how many pushes they put up with). Every trader keeps a few vehicle parts for sale.
 */
export function makeTrader(seed: number, placeId: number, specialty: 'general' | 'tools-parts' = 'general'): Trader {
  const rand = makeRandom(Math.imul(seed, 7919) + placeId * 131 + 7);
  const pick = (ids: string[], min: number, max: number): Offer[] =>
    ids.filter(() => rand() < 0.75).map((id) => ({ id, count: min + Math.floor(rand() * (max - min + 1)) }));
  const stock = [
    ...pick(['crackers', 'jerky', 'soda', 'water_bottle', 'canned_beans'], 2, 10),
    ...pick(['bandage', 'duct_tape', 'rope', 'scrap_metal', 'batteries'], 2, 12),
    { id: 'tire', count: 2 + Math.floor(rand() * 5) },
    ...(rand() < 0.6 ? [{ id: 'motor', count: 1 }] : []),
    ...(rand() < 0.5 ? [{ id: 'wrench', count: 1 }] : []),
  ];
  const margin = 1.25 + rand() * 0.25;
  return {
    specialty,
    placeId,
    name: TRADER_NAMES[(placeId + Math.floor(rand() * TRADER_NAMES.length)) % TRADER_NAMES.length],
    stock: specialty === 'tools-parts' ? [
      { id: 'wrench', count: 2 },
      stock.find(s => s.id === 'tire')!,
      { id: 'motor', count: 1 },
      { id: 'rig_tire', count: 4 },
      { id: 'rig_battery', count: 1 },
      { id: 'rig_fuel_tank', count: 1 },
      { id: 'rig_steering', count: 1 },
    ] : stock,
    margin,
    floor: 1.05 + rand() * 0.1,
    patience: 2 + Math.floor(rand() * 3),
    refusing: false,
  };
}
