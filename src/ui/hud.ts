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
  /** Small controls reminder in the corner. */
  setHint(text: string): void;
  /** Developer readout: frame rate and so on. Empty text hides it. */
  setDebug(text: string): void;
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

  const panel = el('div', 'hud-inventory', root);
  const title = el('div', 'hud-inventory-title', panel);
  el('span', '', title, 'Carrying');
  const count = el('span', 'hud-inventory-count', title);
  const slotsEl = el('div', 'hud-slots', panel);
  el('div', 'hud-inventory-hint', panel, 'Tab or I to close');
  panel.hidden = true;
  let lastInventory: Inventory | null = null;

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

  return {
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
    setHint(text) {
      if (hint.textContent !== text) hint.textContent = text;
    },
    setDebug(text) {
      debug.hidden = text === '';
      if (debug.textContent !== text) debug.textContent = text;
    },
  };
}
