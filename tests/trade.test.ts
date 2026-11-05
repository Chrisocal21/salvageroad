import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { appraise, haggle, makeTrader, trade, WORTH } from '../src/rules/trade';

const fresh = () => {
  const t = makeTrader(1, 0);
  t.stock = [{ id: 'tire', count: 3 }, { id: 'canned_beans', count: 5 }];
  t.margin = 1.3;
  t.floor = 1.1;
  t.patience = 2;
  return t;
};

describe('barter', () => {
  it('stocks the tools-and-parts trader with existing tools and vehicle parts, not groceries', () => {
    for (const seed of [1, 7, 42]) {
      const t = makeTrader(seed, 0, 'tools-parts');
      expect(t.specialty).toBe('tools-parts');
      expect(t.stock.map(s => s.id)).toEqual(['wrench', 'tire', 'motor', 'rig_tire']);
      expect(t.stock.every(s => s.count > 0 && ['tool', 'part'].includes(ITEMS[s.id].kind))).toBe(true);
      expect(t).toEqual(makeTrader(seed, 0, 'tools-parts'));
    }
  });
  it('values every item the game has', () => {
    for (const id of Object.keys(ITEMS)) expect(WORTH[id], id).toBeGreaterThan(0);
  });

  it('wants more than the goods are worth, by the margin', () => {
    const t = fresh();
    expect(appraise(t, [{ id: 'canned_beans', count: 4 }], [{ id: 'tire', count: 1 }]).wanted).toBe(59); // 45 * 1.3
    expect(appraise(t, [{ id: 'canned_beans', count: 5 }], [{ id: 'tire', count: 1 }]).deal).toBe(false);
    expect(appraise(t, [{ id: 'canned_beans', count: 6 }], [{ id: 'tire', count: 1 }]).deal).toBe(true);
  });

  it('swaps goods for goods and updates both sides', () => {
    const t = fresh();
    const inv = createInventory();
    addItem(inv, 'canned_beans', 6);
    expect(trade(t, inv, [{ id: 'canned_beans', count: 6 }], [{ id: 'tire', count: 1 }])).toEqual({ ok: true });
    expect(countItem(inv, 'tire')).toBe(1);
    expect(countItem(inv, 'canned_beans')).toBe(0);
    expect(t.stock.find((s) => s.id === 'tire')!.count).toBe(2);
    expect(t.stock.find((s) => s.id === 'canned_beans')!.count).toBe(11);
  });

  it('refuses an unfair swap, or goods that are not there, and changes nothing', () => {
    const t = fresh();
    const inv = createInventory();
    addItem(inv, 'canned_beans', 3);
    expect(trade(t, inv, [{ id: 'canned_beans', count: 3 }], [{ id: 'tire', count: 1 }])).toEqual({ ok: false, reason: 'not_enough_worth' });
    expect(trade(t, inv, [{ id: 'canned_beans', count: 4 }], [{ id: 'canned_beans', count: 1 }])).toEqual({ ok: false, reason: 'you_lack' });
    addItem(inv, 'canned_beans', 20 - 3);
    expect(trade(t, inv, [{ id: 'canned_beans', count: 20 }], [{ id: 'rope', count: 1 }])).toEqual({ ok: false, reason: 'trader_lacks' });
    expect(countItem(inv, 'canned_beans')).toBe(20);
  });

  it('puts everything back if what you buy does not fit in the pack', () => {
    const t = fresh();
    t.stock.push({ id: 'wrench', count: 20 });
    const inv = createInventory(1);
    addItem(inv, 'rope', 5); // the only slot is full of rope
    expect(trade(t, inv, [{ id: 'rope', count: 5 }], [{ id: 'wrench', count: 1 }])).toEqual({ ok: true }); // rope slot frees, wrench fits
    expect(countItem(inv, 'wrench')).toBe(1);
    const full = createInventory(1);
    addItem(full, 'canned_beans', 6);
    addItem(full, 'canned_beans', 0);
    const t2 = fresh();
    t2.stock.push({ id: 'jerky', count: 9 });
    // give only part of the stack, so the slot stays used and the jerky has nowhere to go
    expect(trade(t2, full, [{ id: 'canned_beans', count: 1 }], [{ id: 'jerky', count: 1 }])).toEqual({ ok: false, reason: 'no_room' });
    expect(countItem(full, 'canned_beans')).toBe(6);
    expect(countItem(full, 'jerky')).toBe(0);
  });

  it('haggling lowers the margin to the floor, then the trader tires of it', () => {
    const t = fresh();
    expect(haggle(t)).toBe('better');
    expect(t.margin).toBeCloseTo(1.22);
    expect(haggle(t)).toBe('better');
    expect(t.margin).toBeCloseTo(1.14);
    expect(haggle(t)).toBe('refuses');
    expect(t.margin).toBeCloseTo(1.14);
  });

  it('never goes below the floor', () => {
    const t = fresh();
    t.patience = 10;
    for (let i = 0; i < 6; i++) haggle(t);
    expect(t.margin).toBeCloseTo(1.1);
  });

  it('refuses further trades after an extra haggle exhausts patience', () => {
    const t = fresh(), inv = createInventory();
    addItem(inv, 'canned_beans', 10);
    haggle(t); haggle(t);
    expect(t.refusing).toBe(false);
    expect(haggle(t)).toBe('refuses');
    expect(appraise(t, [{ id: 'canned_beans', count: 10 }], [{ id: 'tire', count: 1 }]).deal).toBe(false);
    expect(trade(t, inv, [{ id: 'canned_beans', count: 10 }], [{ id: 'tire', count: 1 }])).toEqual({ ok: false, reason: 'refuses' });
    expect(countItem(inv, 'canned_beans')).toBe(10);
  });

  it('leaves exact slot order, existing requested goods and stock unchanged when a swap does not fit', () => {
    const t = fresh(), inv = createInventory(2);
    t.stock = [{ id: 'canned_beans', count: 10 }, { id: 'wrench', count: 1 }];
    addItem(inv, 'canned_beans', 5);
    addItem(inv, 'batteries', 8);
    const before = structuredClone({ inv, t });
    expect(trade(t, inv, [{ id: 'batteries', count: 6 }], [{ id: 'canned_beans', count: 3 }, { id: 'wrench', count: 1 }])).toEqual({ ok: false, reason: 'no_room' });
    expect({ inv, t }).toEqual(before);
  });

  it('combines duplicate rows before checking availability and rejects invalid quantities', () => {
    const t = fresh(), inv = createInventory();
    addItem(inv, 'canned_beans', 6);
    expect(trade(t, inv, [{ id: 'canned_beans', count: 4 }, { id: 'canned_beans', count: 4 }], [{ id: 'tire', count: 1 }])).toEqual({ ok: false, reason: 'you_lack' });
    for (const count of [0, -1, 0.5, Infinity, NaN])
      expect(trade(t, inv, [{ id: 'canned_beans', count }], [{ id: 'tire', count: 1 }])).toEqual({ ok: false, reason: 'invalid_offer' });
    expect(countItem(inv, 'canned_beans')).toBe(6);
  });

  it('makes the same trader for the same seed and place, and different ones for different places', () => {
    expect(makeTrader(5, 2)).toEqual(makeTrader(5, 2));
    expect(makeTrader(5, 2)).not.toEqual(makeTrader(5, 3));
    for (let p = 0; p < 6; p++) expect(makeTrader(5, p).stock.some((s) => s.id === 'tire')).toBe(true);
  });
});
