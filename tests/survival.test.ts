import { describe, expect, it } from 'vitest';
import { addItem, countItem, createInventory } from '../src/rules/inventory';
import { consume, createSurvival, isWeak, stepSurvival, SURVIVAL } from '../src/rules/survival';

describe('survival', () => {
  it('drains with time and never goes below zero', () => {
    const s = createSurvival();
    stepSurvival(s, 600);
    expect(s.hunger).toBeCloseTo(50);
    expect(s.thirst).toBeCloseTo(100 - (600 * 100) / 720);
    stepSurvival(s, 100000);
    expect(s).toEqual({ hunger: 0, thirst: 0 });
    expect(isWeak(s)).toBe(true);
  });

  it('is not weak while both bars have something left', () => {
    expect(isWeak({ hunger: 1, thirst: 1 })).toBe(false);
    expect(isWeak({ hunger: 0, thirst: 50 })).toBe(true);
  });

  it('eating uses one item and restores its value', () => {
    const s = { hunger: 40, thirst: 100 };
    const inv = createInventory();
    addItem(inv, 'canned_beans', 2);
    const r = consume(s, inv, 'food');
    expect(r).toEqual({ ok: true, itemId: 'canned_beans', restored: 35 });
    expect(s.hunger).toBe(75);
    expect(countItem(inv, 'canned_beans')).toBe(1);
  });

  it('caps at full and picks the smallest item that fills the gap', () => {
    const s = { hunger: 90, thirst: 100 };
    const inv = createInventory();
    addItem(inv, 'canned_beans', 1);
    addItem(inv, 'crackers', 1);
    const r = consume(s, inv, 'food');
    expect(r).toMatchObject({ ok: true, itemId: 'crackers', restored: 10 });
    expect(s.hunger).toBe(SURVIVAL.max);
  });

  it('uses the biggest item when none fill the gap', () => {
    const s = { hunger: 0, thirst: 100 };
    const inv = createInventory();
    addItem(inv, 'canned_beans', 1);
    addItem(inv, 'crackers', 1);
    expect(consume(s, inv, 'food')).toMatchObject({ itemId: 'canned_beans' });
  });

  it('does nothing when there is nothing to use or the bar is full', () => {
    const inv = createInventory();
    expect(consume({ hunger: 10, thirst: 10 }, inv, 'drink')).toEqual({ ok: false, reason: 'none' });
    addItem(inv, 'water_bottle', 1);
    expect(consume({ hunger: 10, thirst: 100 }, inv, 'drink')).toEqual({ ok: false, reason: 'full' });
    expect(countItem(inv, 'water_bottle')).toBe(1);
  });

  it('drinks water for thirst, not food', () => {
    const s = { hunger: 10, thirst: 20 };
    const inv = createInventory();
    addItem(inv, 'water_bottle', 1);
    addItem(inv, 'canned_beans', 1);
    expect(consume(s, inv, 'drink')).toMatchObject({ itemId: 'water_bottle' });
    expect(s.thirst).toBe(60);
    expect(s.hunger).toBe(10);
  });
});
