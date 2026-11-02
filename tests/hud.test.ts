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

  it('shows and hides the debug readout', () => {
    const { hud, q } = setup();
    hud.setDebug('144 fps');
    expect(q('.hud-debug').hidden).toBe(false);
    hud.setDebug('');
    expect(q('.hud-debug').hidden).toBe(true);
  });
});
