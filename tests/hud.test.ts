// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, createInventory } from '../src/rules/inventory';
import { createHud } from '../src/ui/hud';

function setup() {
  document.body.replaceChildren();
  const hud = createHud(document.body);
  const q = (selector: string) => document.querySelector(selector) as HTMLElement;
  return { hud, q };
}

describe('hud', () => {
  beforeEach(() => vi.useRealTimers());

  it('shows the prompt with its key, and hides it again', () => {
    const { hud, q } = setup();
    expect(q('.hud-prompt').hidden).toBe(true);
    hud.setPrompt({ key: 'E', text: 'Open the crate' });
    expect(q('.hud-prompt').hidden).toBe(false);
    expect(q('.hud-key').textContent).toBe('E');
    expect(q('.hud-prompt').textContent).toContain('Open the crate');
    hud.setPrompt(null);
    expect(q('.hud-prompt').hidden).toBe(true);
  });

  it('shows a toast that fades out by itself', () => {
    vi.useFakeTimers();
    const { hud, q } = setup();
    hud.toast('Took 2 canned beans');
    expect(q('.hud-toast').classList.contains('show')).toBe(true);
    expect(q('.hud-toast').textContent).toBe('Took 2 canned beans');
    vi.advanceTimersByTime(4500);
    expect(q('.hud-toast').classList.contains('show')).toBe(false);
  });

  it('lists what you carry when the panel is opened, and updates while open', () => {
    const { hud, q } = setup();
    const inv = createInventory();
    addItem(inv, 'canned_beans', 3);
    hud.setInventory(inv);
    expect(q('.hud-inventory').hidden).toBe(true);
    hud.toggleInventory();
    expect(q('.hud-inventory').hidden).toBe(false);
    expect(document.querySelectorAll('.hud-slot')).toHaveLength(12);
    expect(document.querySelectorAll('.hud-slot.empty')).toHaveLength(11);
    expect(q('.hud-slot').textContent).toContain('canned beans');
    expect(q('.hud-slot-count').textContent).toBe('3');
    expect(q('.hud-inventory-count').textContent).toBe('1 of 12');
    addItem(inv, 'wrench', 1);
    hud.setInventory(inv);
    expect(document.querySelectorAll('.hud-slot.empty')).toHaveLength(10);
    hud.toggleInventory();
    expect(q('.hud-inventory').hidden).toBe(true);
  });

  it('shows the crosshair on foot and the speedometer in the truck', () => {
    const { hud, q } = setup();
    hud.setMode('walking');
    expect(q('.hud-crosshair').hidden).toBe(false);
    expect(q('.hud-speed').hidden).toBe(true);
    hud.setMode('driving');
    hud.setSpeed(63.4);
    expect(q('.hud-crosshair').hidden).toBe(true);
    expect(q('.hud-speed').hidden).toBe(false);
    expect(q('.hud-speed-value').textContent).toBe('63');
  });

  it('shows hunger and thirst bars and flags a low one', () => {
    const { hud } = setup();
    hud.setNeeds({ hunger: 80, thirst: 10 });
    const fills = document.querySelectorAll<HTMLElement>('.hud-need-fill');
    expect(fills[0].style.width).toBe('80%');
    expect(fills[1].style.width).toBe('10%');
    const rows = document.querySelectorAll('.hud-need');
    expect(rows[0].classList.contains('low')).toBe(false);
    expect(rows[1].classList.contains('low')).toBe(true);
  });

  it('shows and hides the debug readout', () => {
    const { hud, q } = setup();
    hud.setDebug('144 fps');
    expect(q('.hud-debug').hidden).toBe(false);
    hud.setDebug('');
    expect(q('.hud-debug').hidden).toBe(true);
  });
});

describe('hud build bar', () => {
  it('shows the menu, the selected item, the level and the status, and hides on leaving build mode', () => {
    const { hud, q } = setup();
    expect(q('.hud-build').hidden).toBe(true);
    hud.setBuild({ items: [{ name: '20 ft container', selected: false }, { name: 'Support pillar', selected: true }], level: 2, status: 'Level 2  +4 pillars', ok: true });
    expect(q('.hud-build').hidden).toBe(false);
    expect(document.querySelectorAll('.hud-build-item')).toHaveLength(2);
    expect(q('.hud-build-item.on').textContent).toContain('Support pillar');
    expect(q('.hud-build-level').textContent).toContain('2');
    expect(q('.hud-build-status').classList.contains('bad')).toBe(false);
    hud.setBuild({ items: [], level: 0, status: 'The truck is in the way', ok: false });
    expect(q('.hud-build-status').classList.contains('bad')).toBe(true);
    hud.setBuild(null);
    expect(q('.hud-build').hidden).toBe(true);
  });

  it('shows the vehicle storage beside the pack and moves a clicked stack across', () => {
    const { hud, q } = setup();
    const pack = createInventory();
    const store = createInventory(4);
    addItem(pack, 'wrench', 1);
    const moves: [string, number][] = [];
    expect(hud.isStorageOpen()).toBe(false);
    hud.openStorage('El Cajon bed', store, pack, (from, i) => moves.push([from, i]));
    expect(hud.isStorageOpen()).toBe(true);
    expect(q('.hud-storage').textContent).toContain('El Cajon bed');
    (document.querySelector('.hud-storage .hud-slot.full') as HTMLElement).click();
    expect(moves).toEqual([['pack', 0]]);
    hud.closeStorage();
    expect(q('.hud-storage').hidden).toBe(true);
  });
});
