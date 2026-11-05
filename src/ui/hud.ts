import { ITEMS } from '../data/items';
import type { Inventory } from '../rules/inventory';
import { appraise, haggle, trade, type Offer, type Trader, type TradeResult } from '../rules/trade';
import './hud.css';

// The in-game HUD, drawn as HTML on top of the canvas. The game only talks to this small interface, so
// swapping to a canvas-drawn HUD later means rewriting this one file and nothing else.
export interface Hud {
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  setResumeHandler(fn: () => void): void;
  /** The thing you can use right now, such as { key: 'E', text: 'Open the crate' }. null hides it. */
  setPrompt(prompt: { key: string; text: string } | null): void;
  /** A short message that fades out by itself. */
  toast(text: string): void;
  setInventory(inv: Inventory): void;
  toggleInventory(): void;
  isInventoryOpen(): boolean;
  /** Called when a slot in the inventory panel is clicked. The game decides what that does (eat, drink). */
  setConsumeHandler(fn: (index: number) => void): void;
  /** Walking shows a crosshair. Driving shows the speedometer. */
  setMode(mode: 'walking' | 'driving'): void;
  setSpeed(kmh: number): void;
  /** Hunger and thirst, each 0 (empty) to 100 (full). */
  setNeeds(needs: { hunger: number; thirst: number }): void;
  /** The build bar at the bottom of the screen. null leaves build mode. */
  setBuild(build: BuildHud | null): void;
  /** Opens the vehicle storage panel: the vehicle's slots beside yours. Clicking a slot sends that stack to the other side. */
  openStorage(title: string, store: Inventory, pack: Inventory, onMove: (from: 'store' | 'pack', index: number) => void): void;
  /** Redraws the storage panel after something moved. */
  refreshStorage(): void;
  closeStorage(): void;
  isStorageOpen(): boolean;
  openTrade(trader: Trader, pack: Inventory): void;
  closeTrade(): void;
  isTradeOpen(): boolean;
  /** Small controls reminder in the corner. */
  setHint(text: string): void;
  /** Developer readout: frame rate and so on. Empty text hides it. */
  setDebug(text: string): void;
}

/** What the build bar shows while the player is in build mode. */
export interface BuildHud {
  /** A heading above the items, such as 'On the truck: 3'. */
  title?: string;
  items: { name: string; selected: boolean }[];
  level: number;
  /** What the aimed spot would do, such as 'Level 1  +4 pillars', or why it cannot be built. */
  status: string;
  ok: boolean;
}

const TOAST_MS = 4000;

/** A colour per item kind, so the pack and the hotbar can be read at a glance. */
const KIND_COLOUR: Record<string, string> = {
  food: '#a8c66c',
  drink: '#6cb5c6',
  material: '#b8a88a',
  tool: '#d9d9d9',
  part: '#c98a4a',
  medical: '#e08a8a',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

export function createHud(parent: HTMLElement): Hud {
  const root = el('div', 'hud', parent);

  const crosshair = el('div', 'hud-crosshair', root);

  const prompt = el('div', 'hud-prompt', root);
  const promptKey = el('span', 'hud-key', prompt);
  const promptText = el('span', '', prompt);
  prompt.hidden = true;

  const toastEl = el('div', 'hud-toast', root);
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  let toastTimer = 0;

  const speed = el('div', 'hud-speed', root);
  const speedValue = el('div', 'hud-speed-value', speed, '0');
  el('div', 'hud-speed-unit', speed, 'km/h');
  speed.hidden = true;

  const needs = el('div', 'hud-needs', root);
  function needBar(label: string) {
    const row = el('div', 'hud-need', needs);
    el('span', 'hud-need-label', row, label);
    const track = el('div', 'hud-need-track', row);
    return { row, fill: el('div', 'hud-need-fill', track) };
  }
  const hungerBar = needBar('Hunger');
  const thirstBar = needBar('Thirst');
  function showNeed(bar: { row: HTMLElement; fill: HTMLElement }, value: number) {
    const pct = Math.round(Math.min(100, Math.max(0, value)));
    const width = `${pct}%`;
    if (bar.fill.style.width !== width) bar.fill.style.width = width;
    bar.row.classList.toggle('low', pct < 25);
  }

  const panel = el('div', 'hud-inventory', root);
  const title = el('div', 'hud-inventory-title', panel);
  el('span', '', title, 'Carrying');
  const count = el('span', 'hud-inventory-count', title);
  const slotsEl = el('div', 'hud-slots', panel);
  el('div', 'hud-inventory-hint', panel, 'Click food or drink to use it   Tab, I or Esc to close');
  panel.hidden = true;
  let lastInventory: Inventory | null = null;
  let consumeHandler: ((index: number) => void) | null = null;

  // The hotbar: what you carry, always visible at the bottom centre. Display only.
  const hotbar = el('div', 'hud-hotbar', root);

  // Vehicle storage: two grids side by side. Clicking a slot moves that stack across.
  const storageEl = el('div', 'hud-storage', root);
  const storageSides = [el('div', 'hud-storage-side', storageEl), el('div', 'hud-storage-side', storageEl)];
  const storageHeads = storageSides.map((side) => {
    const head = el('div', 'hud-inventory-title', side);
    return { name: el('span', '', head), count: el('span', 'hud-inventory-count', head) };
  });
  const storageGrids = storageSides.map((side) => el('div', 'hud-slots', side));
  el('div', 'hud-inventory-hint', storageEl, 'Click a stack to move it across   Tab, E or Esc to close');
  storageEl.hidden = true;
  let storageState: {
    store: Inventory;
    pack: Inventory;
    onMove: (from: 'store' | 'pack', index: number) => void;
  } | null = null;

  const tradeOverlay = el('div', 'hud-trade-overlay', root);
  tradeOverlay.hidden = true;
  const tradePanel = el('div', 'hud-trade', tradeOverlay);
  tradePanel.setAttribute('role', 'dialog');
  tradePanel.setAttribute('aria-modal', 'true');
  tradePanel.setAttribute('aria-labelledby', 'hud-trade-title');
  const tradeHead = el('div', 'hud-inventory-title', tradePanel);
  const tradeTitle = el('span', '', tradeHead);
  tradeTitle.id = 'hud-trade-title';
  const closeTradeButton = el('button', '', tradeHead, 'Close');
  closeTradeButton.type = 'button';
  el('p', '', tradePanel, 'Barter only. Choose goods on both sides; no money changes hands.');
  const tradeColumns = el('div', 'hud-trade-columns', tradePanel);
  const tradeSides = ['You give', 'You ask'].map(text => {
    const side = el('div', '', tradeColumns);
    el('h3', '', side, text);
    return el('div', 'hud-trade-goods', side);
  });
  const tradeVerdict = el('p', 'hud-trade-verdict', tradePanel);
  const tradeMessage = el('p', 'hud-trade-message', tradePanel);
  tradeMessage.setAttribute('role', 'status');
  const tradeActions = el('div', 'hud-trade-actions', tradePanel);
  const haggleButton = el('button', '', tradeActions, 'Haggle');
  const dealButton = el('button', '', tradeActions, 'Trade');
  haggleButton.type = dealButton.type = 'button';
  el('p', 'hud-inventory-hint', tradePanel, 'Each + selects one item. E or Esc closes. Haggling costs patience.');
  let tradeState: { trader: Trader; pack: Inventory; give: Offer[]; get: Offer[]; message: string } | null = null;
  let tradeFocus: HTMLElement | null = null;

  function closeTrade() {
    tradeOverlay.hidden = true;
    root.classList.remove('trading');
    tradeState = null;
    tradeFocus?.focus();
    tradeFocus = null;
  }
  closeTradeButton.addEventListener('click', closeTrade);
  tradeOverlay.addEventListener('click', event => { if (event.target === tradeOverlay) closeTrade(); });
  tradePanel.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...tradePanel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function renderTrade() {
    const st = tradeState;
    if (!st) return;
    const focused = tradePanel.contains(document.activeElement) ? document.activeElement?.getAttribute('aria-label') : null;
    const totals = new Map<string, number>();
    for (const slot of st.pack.slots) if (slot) totals.set(slot.id, (totals.get(slot.id) ?? 0) + slot.count);
    const lists = [[...totals].map(([id, count]) => ({ id, count })), st.trader.stock];
    lists.forEach((list, side) => {
      tradeSides[side].replaceChildren();
      if (!list.length) el('p', '', tradeSides[side], side === 0 ? 'Your pack is empty. Bring goods to barter.' : 'No goods left.');
      for (const item of list) {
        const selected = side === 0 ? st.give : st.get;
        const amount = selected.find(o => o.id === item.id)?.count ?? 0;
        const row = el('div', 'hud-trade-row', tradeSides[side]);
        el('span', '', row, ITEMS[item.id].name);
        const minus = el('button', '', row, '-');
        minus.type = 'button';
        minus.setAttribute('aria-label', `Remove ${side === 0 ? 'offered' : 'requested'} ${ITEMS[item.id].name}`);
        minus.disabled = amount === 0 || st.trader.refusing;
        el('span', 'hud-trade-count', row, `${amount} / ${item.count}`);
        const plus = el('button', '', row, '+');
        plus.type = 'button';
        plus.setAttribute('aria-label', `${side === 0 ? 'Offer' : 'Ask for'} ${ITEMS[item.id].name}`);
        plus.disabled = amount >= item.count || st.trader.refusing;
        const change = (delta: number) => {
          const offer = selected.find(o => o.id === item.id);
          if (offer) offer.count += delta;
          else selected.push({ id: item.id, count: delta });
          st.give = st.give.filter(o => o.count > 0);
          st.get = st.get.filter(o => o.count > 0);
          st.message = '';
          renderTrade();
        };
        minus.addEventListener('click', () => change(-1));
        plus.addEventListener('click', () => change(1));
      }
    });
    const verdict = appraise(st.trader, st.give, st.get);
    tradeVerdict.textContent = `Offer value: ${verdict.giveWorth} | Asked value: ${verdict.getWorth} | Trader wants: ${verdict.wanted}. Haggles left: ${st.trader.patience}.`;
    tradeMessage.textContent = st.message || (st.trader.refusing ? 'The trader refuses to deal for now.' :
      !st.get.length ? 'Choose what you want and what to give.' : verdict.deal ? 'The trader will accept this offer.' : 'The trader wants more goods.');
    haggleButton.disabled = st.trader.refusing;
    dealButton.disabled = !verdict.deal || !st.give.length;
    if (focused) ([...tradePanel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      .find(button => button.getAttribute('aria-label') === focused) ?? closeTradeButton).focus();
  }
  haggleButton.addEventListener('click', () => {
    if (!tradeState) return;
    const result = haggle(tradeState.trader);
    tradeState.message = result === 'better' ? 'The trader lowered their asking value.' :
      result === 'no_better' ? 'That is their best offer. Another push still costs patience.' : 'The trader refuses to deal for now.';
    renderTrade();
  });
  dealButton.addEventListener('click', () => {
    if (!tradeState) return;
    const st = tradeState;
    const result = trade(st.trader, st.pack, st.give, st.get);
    const errors: Record<Extract<TradeResult, { ok: false }>['reason'], string> = {
      empty: 'Choose goods on both sides.', invalid_offer: 'That offer is not valid.',
      not_enough_worth: 'The trader wants more goods.', you_lack: 'You no longer have those goods.',
      trader_lacks: 'The trader no longer has those goods.', no_room: 'Your pack has no room. Nothing was exchanged.',
      refuses: 'The trader refuses to deal for now.',
    };
    st.message = result.ok ? 'Trade completed.' : errors[result.reason];
    if (result.ok) {
      st.give = []; st.get = [];
      lastInventory = st.pack;
      renderHotbar();
    }
    renderTrade();
  });

  const buildEl = el('div', 'hud-build', root);
  const buildStatus = el('div', 'hud-build-status', buildEl);
  const buildTitle = el('div', 'hud-build-title', buildEl);
  const buildRow = el('div', 'hud-build-row', buildEl);
  const buildLevel = el('div', 'hud-build-level', buildEl);
  buildEl.hidden = true;
  let lastBuild = '';

  const hint = el('div', 'hud-hint', root);
  const debug = el('div', 'hud-debug', root);
  debug.hidden = true;

  let lastPrompt = '';

  const pauseOverlay = el('div', 'hud-pause-overlay', root);
  pauseOverlay.hidden = true;
  const pausePanel = el('section', 'hud-pause', pauseOverlay);
  pausePanel.setAttribute('role', 'dialog');
  pausePanel.setAttribute('aria-modal', 'true');
  pausePanel.setAttribute('aria-labelledby', 'pause-title');
  el('div', 'hud-pause-eyebrow', pausePanel, 'SALVAGE ROAD');
  el('h1', '', pausePanel, 'Paused').id = 'pause-title';
  el('p', 'hud-pause-description', pausePanel, 'Take your time. The world is paused.');
  const resume = el('button', 'hud-resume', pausePanel, 'Resume game · Esc');
  resume.type = 'button';
  let resumeHandler = () => {};
  resume.addEventListener('click', () => resumeHandler());
  const controls = el('div', 'hud-controls', pausePanel);
  const groups: [string, [string, string][]][] = [
    ['On foot & essentials', [['W A S D / Arrows', 'Move'], ['Mouse', 'Look around (click game to capture)'], ['Shift', 'Run'], ['E', 'Interact / enter or leave vehicle'], ['Tab / I', 'Inventory / vehicle storage'], ['F / Q', 'Eat / drink'], ['M', 'Map'], ['Esc', 'Close a panel / pause or resume']]],
    ['Driving', [['W / S', 'Accelerate / brake & reverse'], ['A / D', 'Steer'], ['Arrows', 'Alternative driving controls'], ['Space', 'Handbrake'], ['C', 'Switch seats'], ['V', 'Flip truck upright']]],
    ['Building & unloading', [['U', 'Start / finish unloading'], ['1–9', 'Choose cargo'], ['Left click', 'Place container'], ['Right click', 'Pick up container'], ['R', 'Rotate while unloading'], ['Wheel / PgUp / PgDn', 'Change build level']]],
    ['Testing & world tools', [['R', 'Reset to town (outside build mode)'], ['J', 'Jump to town'], ['G', 'Toggle fly mode'], ['W A S D · Q / E', 'Fly · descend / ascend (Space also ascends)'], ['Shift / Wheel', 'Fly faster / adjust flight speed'], ['T', 'Land on foot from fly mode'], ['N / [ / ]', 'New / previous / next world seed'], ['B / X', 'Toggle performance run / hide results']]],
  ];
  for (const [heading, bindings] of groups) {
    const section = el('section', 'hud-control-group', controls);
    el('h2', '', section, heading);
    const list = el('dl', '', section);
    for (const [key, action] of bindings) {
      const row = el('div', 'hud-control-row', list);
      el('dt', '', row, key);
      el('dd', '', row, action);
    }
  }
  pausePanel.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); resume.focus(); }
  });

  function renderInventory() {
    if (!lastInventory) return;
    const slots = lastInventory.slots;
    count.textContent = `${slots.filter((s) => s !== null).length} of ${slots.length}`;
    slotsEl.replaceChildren(
      ...slots.map((s, index) => {
        const usable = s !== null && (ITEMS[s.id].kind === 'food' || ITEMS[s.id].kind === 'drink');
        const slot = el('div', s ? (usable ? 'hud-slot usable' : 'hud-slot') : 'hud-slot empty');
        if (s) {
          slot.style.borderLeftColor = KIND_COLOUR[ITEMS[s.id].kind] ?? 'transparent';
          slot.textContent = ITEMS[s.id].name;
          if (s.count > 1) el('span', 'hud-slot-count', slot, String(s.count));
          if (usable) {
            slot.title = `Click to ${ITEMS[s.id].kind === 'food' ? 'eat' : 'drink'}`;
            slot.addEventListener('click', () => consumeHandler?.(index));
          }
        }
        return slot;
      }),
    );
  }

  function renderHotbar() {
    if (!lastInventory) return;
    hotbar.replaceChildren(
      ...lastInventory.slots.map((s) => {
        const slot = el('div', s ? 'hud-hotbar-slot' : 'hud-hotbar-slot empty');
        if (s) {
          slot.style.borderTopColor = KIND_COLOUR[ITEMS[s.id].kind] ?? 'transparent';
          slot.title = ITEMS[s.id].name;
          el('span', 'hud-hotbar-name', slot, ITEMS[s.id].name);
          if (s.count > 1) el('span', 'hud-slot-count', slot, String(s.count));
        }
        return slot;
      }),
    );
  }

  function renderStorage(titleText: string) {
    const st = storageState;
    if (!st) return;
    const sides: { name: string; inv: Inventory; from: 'store' | 'pack' }[] = [
      { name: titleText, inv: st.store, from: 'store' },
      { name: 'Carrying', inv: st.pack, from: 'pack' },
    ];
    sides.forEach((side, i) => {
      storageHeads[i].name.textContent = side.name;
      storageHeads[i].count.textContent = `${side.inv.slots.filter((s) => s !== null).length} of ${side.inv.slots.length}`;
      storageGrids[i].replaceChildren(
        ...side.inv.slots.map((s, index) => {
          const slot = el('div', s ? 'hud-slot full' : 'hud-slot empty');
          if (s) {
            slot.textContent = ITEMS[s.id].name;
            if (s.count > 1) el('span', 'hud-slot-count', slot, String(s.count));
            slot.addEventListener('click', () => st.onMove(side.from, index));
          }
          return slot;
        }),
      );
    });
  }
  let storageTitle = '';

  return {
    setPaused(paused) {
      pauseOverlay.hidden = !paused;
      root.classList.toggle('paused', paused);
      if (paused) resume.focus();
      else resume.blur();
    },
    isPaused: () => !pauseOverlay.hidden,
    setResumeHandler(fn) { resumeHandler = fn; },
    openTrade(trader, pack) {
      if (!tradeOverlay.hidden) closeTrade();
      tradeFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      panel.hidden = true;
      storageEl.hidden = true;
      storageState = null;
      tradeState = { trader, pack, give: [], get: [], message: '' };
      tradeTitle.textContent = `${trader.name} - ${trader.specialty === 'tools-parts' ? 'Tools and vehicle parts' : 'Salvage yard barter'}`;
      tradeOverlay.hidden = false;
      root.classList.add('trading');
      renderTrade();
      closeTradeButton.focus();
    },
    closeTrade,
    isTradeOpen: () => !tradeOverlay.hidden,
    openStorage(titleText, store, pack, onMove) {
      storageState = { store, pack, onMove };
      storageTitle = titleText;
      storageEl.hidden = false;
      renderStorage(titleText);
    },
    refreshStorage() {
      if (!storageEl.hidden) renderStorage(storageTitle);
    },
    closeStorage() {
      storageState = null;
      storageEl.hidden = true;
    },
    isStorageOpen() {
      return !storageEl.hidden;
    },
    setPrompt(p) {
      const key = p ? `${p.key}|${p.text}` : '';
      if (key === lastPrompt) return; // only touch the page when something changed
      lastPrompt = key;
      prompt.hidden = p === null;
      if (p) {
        promptKey.textContent = p.key;
        promptText.textContent = p.text;
      }
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
    },
    setInventory(inv) {
      lastInventory = inv;
      renderHotbar();
      if (!panel.hidden) renderInventory();
    },
    toggleInventory() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        renderInventory();
        renderHotbar();
      }
    },
    isInventoryOpen() {
      return !panel.hidden;
    },
    setConsumeHandler(fn) {
      consumeHandler = fn;
    },
    setMode(mode) {
      crosshair.hidden = mode !== 'walking';
      speed.hidden = mode !== 'driving';
    },
    setSpeed(kmh) {
      const text = String(Math.round(kmh));
      if (speedValue.textContent !== text) speedValue.textContent = text;
    },
    setNeeds(n) {
      showNeed(hungerBar, n.hunger);
      showNeed(thirstBar, n.thirst);
    },
    setBuild(build) {
      buildEl.hidden = build === null;
      if (!build) {
        lastBuild = '';
        return;
      }
      const key = JSON.stringify(build);
      if (key === lastBuild) return; // only touch the page when something changed
      lastBuild = key;
      buildStatus.textContent = build.status;
      buildStatus.classList.toggle('bad', !build.ok);
      buildStatus.hidden = build.status === '';
      buildTitle.textContent = build.title ?? '';
      buildTitle.hidden = !build.title;
      buildRow.replaceChildren(
        ...build.items.map((item, i) => {
          const slot = el('div', item.selected ? 'hud-build-item on' : 'hud-build-item');
          el('span', 'hud-build-key', slot, String(i + 1));
          el('span', '', slot, item.name);
          return slot;
        }),
      );
      buildLevel.textContent = `Build level ${build.level}   (mouse wheel)`;
    },
    setHint(text) {
      if (hint.textContent !== text) hint.textContent = text;
    },
    setDebug(text) {
      debug.hidden = text === '';
      if (debug.textContent !== text) debug.textContent = text;
    },
  };
}
