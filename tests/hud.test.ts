// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, createInventory } from '../src/rules/inventory';
import { createHud } from '../src/ui/hud';
import { makeTrader } from '../src/rules/trade';

function setup() {
  document.body.replaceChildren();
  const hud = createHud(document.body);
  const q = (selector: string) => document.querySelector(selector) as HTMLElement;
  return { hud, q };
}

describe('hud', () => {
  it('opens pause controls, focuses resume and keeps keyboard focus inside', () => {
    const { hud, q } = setup();
    const resume = vi.fn(() => hud.setPaused(false));
    hud.setResumeHandler(resume);
    expect(hud.isPaused()).toBe(false);
    hud.setPaused(true);
    expect(hud.isPaused()).toBe(true);
    expect(q('.hud-pause').textContent).toContain('Handbrake');
    expect(q('.hud-pause').textContent).toContain('Change build level');
    expect(document.activeElement).toBe(q('.hud-resume'));
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    q('.hud-resume').dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    q('.hud-resume').click();
    expect(resume).toHaveBeenCalledOnce();
    expect(hud.isPaused()).toBe(false);
  });
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

  it('shows exactly ten numbered hotbar slots, leaving the rest in inventory', () => {
    const { hud } = setup();
    const inv = createInventory();
    addItem(inv, 'canned_beans', 3);
    hud.setInventory(inv);
    const slots = document.querySelectorAll('.hud-hotbar-slot');
    inv.slots[11] = { id: 'basic_bench', count: 1 };
    hud.setInventory(inv);
    expect(slots).toHaveLength(10);
    expect(document.querySelectorAll('.hud-hotbar-slot.empty')).toHaveLength(9);
    expect(slots[0].textContent).toContain('canned beans');
    expect(slots[0].querySelector('.hud-slot-count')?.textContent).toBe('3');
    expect([...document.querySelectorAll('.hud-hotbar-key')].map(e => e.textContent)).toEqual(['1','2','3','4','5','6','7','8','9','0']);
    expect(document.querySelector('.hud-hotbar')!.textContent).not.toContain('portable toolbox bench');
  });

  it('assigns a backpack item to 0 by swapping, without consuming food or losing stacks', () => {
    const { hud } = setup();
    const inv = createInventory();
    inv.slots[11] = { id: 'basic_bench', count: 1 };
    inv.slots[9] = { id: 'canned_beans', count: 3 };
    const consume = vi.fn(), activate = vi.fn();
    hud.setConsumeHandler(consume);
    hud.setHotbarHandler(activate);
    hud.setInventory(inv);
    hud.toggleInventory();
    document.querySelector<HTMLButtonElement>('[aria-label="Assign portable toolbox bench to hotbar"]')!.click();
    expect(hud.assignHotbar(9)).toBe(true);
    expect(inv.slots[9]).toEqual({ id: 'basic_bench', count: 1 });
    expect(inv.slots[11]).toEqual({ id: 'canned_beans', count: 3 });
    expect(consume).not.toHaveBeenCalled();
    expect(hud.assignHotbar(0)).toBe(false);
    hud.toggleInventory();
    document.querySelector<HTMLButtonElement>('.hud-hotbar-slot:nth-child(10)')!.click();
    expect(activate).toHaveBeenCalledWith(9);
    hud.setActiveHotbar(9);
    expect(document.querySelector('.hud-hotbar-slot.selected')!.getAttribute('aria-label')).toContain('portable toolbox bench');
  });

  it('calls the consume handler when a food or drink slot is clicked, and not for other items', () => {
    const { hud } = setup();
    const inv = createInventory();
    addItem(inv, 'canned_beans', 2);
    addItem(inv, 'wrench', 1);
    hud.setInventory(inv);
    const clicks: number[] = [];
    hud.setConsumeHandler((index) => clicks.push(index));
    hud.toggleInventory();
    const slots = document.querySelectorAll<HTMLElement>('.hud-inventory .hud-slot');
    expect(slots[0].classList.contains('usable')).toBe(true);
    expect(slots[1].classList.contains('usable')).toBe(false);
    slots[0].click();
    slots[1].click();
    expect(clicks).toEqual([0]);
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

  describe('yard barter screen', () => {
    it('labels the workshop trader as tools and vehicle parts', () => {
      const { hud, q } = setup();
      hud.openTrade(makeTrader(1, 0, 'tools-parts'), createInventory());
      expect(q('#hud-trade-title').textContent).toContain('Tools and vehicle parts');
      expect(q('.hud-trade-goods').textContent).toContain('Your pack is empty');
    });
    const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const action = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.hud-trade-actions button')].find(b => b.textContent === name)!;
    const trader = () => {
      const t = makeTrader(1, 0);
      t.stock = [{ id: 'tire', count: 3 }, { id: 'jerky', count: 9 }];
      t.margin = 1.3; t.floor = 1.1; t.patience = 2;
      return t;
    };
    it('opens an accessible empty-pack screen without changing stock', () => {
      const { hud, q } = setup(), t = trader();
      const before = structuredClone(t);
      hud.openTrade(t, createInventory());
      expect(hud.isTradeOpen()).toBe(true);
      expect(q('.hud').classList.contains('trading')).toBe(true);
      expect(q('[role="dialog"]').getAttribute('aria-modal')).toBe('true');
      expect(q('.hud-trade').textContent).toContain('Your pack is empty');
      expect(action('Trade').disabled).toBe(true);
      hud.closeTrade();
      expect(hud.isTradeOpen()).toBe(false);
      expect(q('.hud').classList.contains('trading')).toBe(false);
      expect(t).toEqual(before);
    });
    it('selects quantities, haggles, trades and refreshes the pack and stock', () => {
      const { hud, q } = setup(), t = trader(), inv = createInventory();
      addItem(inv, 'canned_beans', 6);
      hud.setInventory(inv);
      hud.openTrade(t, inv);
      button('Ask for tire').click();
      for (let i = 0; i < 5; i++) button('Offer canned beans').click();
      expect(action('Trade').disabled).toBe(true);
      button('Offer canned beans').click();
      expect(action('Trade').disabled).toBe(false);
      action('Haggle').click();
      expect(t.margin).toBeCloseTo(1.22);
      action('Trade').click();
      expect(inv.slots.filter(Boolean)).toEqual([{ id: 'tire', count: 1 }]);
      expect(t.stock.find(s => s.id === 'tire')!.count).toBe(2);
      expect(q('.hud-trade-message').textContent).toBe('Trade completed.');
      expect(q('.hud-hotbar').textContent).toContain('tire');
      hud.closeTrade();
      hud.openTrade(t, inv);
      expect(t.margin).toBeCloseTo(1.22);
      expect(q('.hud-trade-verdict').textContent).toContain('Offer value: 0');
    });
    it('shows a full-pack failure and leaves both sides untouched', () => {
      const { hud, q } = setup(), t = trader(), inv = createInventory(1);
      addItem(inv, 'canned_beans', 6);
      hud.openTrade(t, inv);
      button('Offer canned beans').click();
      button('Ask for jerky').click();
      const before = structuredClone({ t, inv });
      action('Trade').click();
      expect(q('.hud-trade-message').textContent).toContain('Nothing was exchanged');
      expect({ t, inv }).toEqual(before);
    });
    it('keeps refusal across reopening and traps keyboard focus in the screen', () => {
      const { hud, q } = setup(), t = trader(), inv = createInventory();
      addItem(inv, 'canned_beans', 6);
      hud.openTrade(t, inv);
      const close = q('.hud-trade .hud-inventory-title button');
      close.focus();
      close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(action('Haggle'));
      action('Haggle').click(); action('Haggle').click(); action('Haggle').click();
      expect(t.refusing).toBe(true);
      hud.closeTrade();
      hud.openTrade(t, inv);
      expect(action('Trade').disabled).toBe(true);
      expect(action('Haggle').disabled).toBe(true);
      expect(q('.hud-trade-message').textContent).toContain('refuses');
    });
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
