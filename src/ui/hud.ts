import { ITEMS } from '../data/items';
import type { Inventory } from '../rules/inventory';
import './hud.css';

// The in-game HUD, drawn as HTML on top of the canvas. The game only talks to this small interface, so
// swapping to a canvas-drawn HUD later means rewriting this one file and nothing else.
export interface Hud {
  /** The thing you can use right now, such as { key: 'E', text: 'Open the crate' }. null hides it. */
  setPrompt(prompt: { key: string; text: string } | null): void;
  /** A short message that fades out by itself. */
  toast(text: string): void;
  setInventory(inv: Inventory): void;
  toggleInventory(): void;
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
  el('div', 'hud-inventory-hint', panel, 'Tab or I to close');
  panel.hidden = true;
  let lastInventory: Inventory | null = null;

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

  function renderInventory() {
    if (!lastInventory) return;
    const slots = lastInventory.slots;
    count.textContent = `${slots.filter((s) => s !== null).length} of ${slots.length}`;
    slotsEl.replaceChildren(
      ...slots.map((s) => {
        const slot = el('div', s ? 'hud-slot' : 'hud-slot empty');
        if (s) {
          slot.textContent = ITEMS[s.id].name;
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
      if (!panel.hidden) renderInventory();
    },
    toggleInventory() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderInventory();
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
