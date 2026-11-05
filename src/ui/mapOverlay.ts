// The in-game map: a small one always in the corner, a big one on M. Both are drawn from one baked
// picture of the island with the roads on it; each redraw only blits the part needed and adds the
// place markers and the player arrow. Clicking the big map travels there (testing). Clicking the
// small one opens the big one.

import type { Place, PlaceKind } from '../rules/places';
import './theme.css';
import './mapOverlay.css';

const KIND_COLOUR: Record<PlaceKind, string> = {
  city: '#ffd24a',
  town: '#e8e2d0',
  village: '#c4ad7c',
  industrial: '#9aa0a6',
  outpost: '#b08954',
  dock: '#5aa3e0',
  lookout: '#e07c4a',
};

/** How much of the world the corner map shows: metres from the player to its edge. */
const MINIMAP_SPAN = 750;

export interface MapOverlay {
  toggle(): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Redraws the corner map, and the big map while it is open. yaw is the map direction: 0 is down-map (+Z). */
  redraw(px: number, pz: number, yaw: number): void;
}

export function createMapOverlay(
  parent: HTMLElement,
  opts: {
    /** Square baked picture of the whole island, terrain and roads already painted. */
    base: HTMLCanvasElement;
    /** Metres across the world. */
    worldSize: number;
    places: Place[];
    districts?: { x: number; z: number }[];
    /** Called with world coordinates when the big map is clicked. */
    onJump: (x: number, z: number) => void;
  },
): MapOverlay {
  const { base, worldSize, places, onJump } = opts;

  const mini = document.createElement('canvas');
  mini.className = 'map-minimap';
  mini.title = 'M: map';
  mini.tabIndex = 0;
  mini.setAttribute('role', 'button');
  mini.setAttribute('aria-label', 'Open region map');
  const widget = document.createElement('div');
  widget.className = 'map-widget';
  const miniHeader = document.createElement('div');
  miniHeader.className = 'map-mini-label';
  const regionLabel = document.createElement('span');
  regionLabel.textContent = 'REGION';
  const mapKey = document.createElement('span');
  mapKey.textContent = 'M';
  miniHeader.append(regionLabel, mapKey);
  const coordinates = document.createElement('div');
  coordinates.className = 'map-coordinates';
  widget.append(miniHeader, mini, coordinates);
  parent.append(widget);

  const overlay = document.createElement('div');
  overlay.className = 'map-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Region map');
  const mapHeader = document.createElement('header');
  mapHeader.className = 'map-header ui-panel-header';
  const mapTitle = document.createElement('div');
  const eyebrow = document.createElement('div');
  eyebrow.className = 'ui-eyebrow';
  eyebrow.textContent = 'Salvage Road / Navigation';
  const heading = document.createElement('h1');
  heading.textContent = 'Region survey';
  mapTitle.append(eyebrow, heading);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'ui-button';
  closeButton.textContent = 'Close · M / Esc';
  closeButton.addEventListener('click', () => api.close());
  mapHeader.append(mapTitle, closeButton);
  const big = document.createElement('canvas');
  big.className = 'map-big';
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.textContent = 'Click to travel there (testing)   M or Esc closes';
  overlay.append(mapHeader, big, legend);
  parent.appendChild(overlay);

  let last = { x: 0, z: 0, yaw: 0 };

  function arrow(ctx: CanvasRenderingContext2D, px: number, py: number, yaw: number, size: number) {
    const dx = Math.sin(yaw);
    const dy = Math.cos(yaw);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size / 5);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dx * size, py + dy * size);
    ctx.stroke();
    ctx.fillStyle = '#ff4a3a';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3, size * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawMini() {
    const px = Math.round(mini.clientWidth * Math.min(devicePixelRatio, 2));
    if (px === 0) return;
    if (mini.width !== px) {
      mini.width = px;
      mini.height = px;
    }
    const ctx = mini.getContext('2d')!;
    // The crop of the baked picture around the player.
    const half = (MINIMAP_SPAN / worldSize) * base.width;
    const cx = (last.x / worldSize + 0.5) * base.width;
    const cy = (last.z / worldSize + 0.5) * base.width;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#0c3f5c'; // sea blue past the map's edge
    ctx.fillRect(0, 0, px, px);
    ctx.drawImage(base, cx - half, cy - half, half * 2, half * 2, 0, 0, px, px);
    ctx.fillStyle = '#b7aaa0';
    for (const d of opts.districts ?? []) {
      const x = ((d.x - last.x) / (MINIMAP_SPAN * 2) + 0.5) * px;
      const z = ((d.z - last.z) / (MINIMAP_SPAN * 2) + 0.5) * px;
      const size = 28 / (MINIMAP_SPAN * 2) * px;
      ctx.fillRect(x - size / 2, z - size / 2, size, size);
    }
    // Places inside the window.
    for (const p of places) {
      const mx = ((p.x - last.x) / (MINIMAP_SPAN * 2) + 0.5) * px;
      const my = ((p.z - last.z) / (MINIMAP_SPAN * 2) + 0.5) * px;
      if (mx < 0 || my < 0 || mx > px || my > px) continue;
      ctx.fillStyle = KIND_COLOUR[p.kind];
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(2.5, px / 60), 0, Math.PI * 2);
      ctx.fill();
    }
    arrow(ctx, px / 2, px / 2, last.yaw, px * 0.09);
  }

  function drawBig() {
    const px = Math.round(big.clientWidth * Math.min(devicePixelRatio, 2));
    if (px === 0) return;
    if (big.width !== px) {
      big.width = px;
      big.height = px;
    }
    const ctx = big.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, px, px);
    const toX = (x: number) => (x / worldSize + 0.5) * px;
    ctx.fillStyle = '#b7aaa0';
    for (const d of opts.districts ?? []) {
      const size = Math.max(1.5, 28 / worldSize * px);
      ctx.fillRect(toX(d.x) - size / 2, toX(d.z) - size / 2, size, size);
    }
    // Places: a dot and the name. The starting town gets a ring too.
    ctx.font = `${Math.max(11, Math.round(px / 55))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const p of places) {
      const mx = toX(p.x);
      const my = toX(p.z);
      const r = Math.max(3, px / 130) * (p.kind === 'city' ? 1.6 : p.kind === 'town' || p.kind === 'dock' ? 1.25 : 1);
      ctx.fillStyle = KIND_COLOUR[p.kind];
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = Math.max(1.5, px / 400);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const label = `${p.name} · ${p.urban ? 'city district' : p.kind}`;
      const labelX = mx + r + 4 + ctx.measureText(label).width > px - 4 ? mx - r - 4 : mx + r + 4; // keep it on the map
      ctx.textAlign = labelX < mx ? 'right' : 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(label, labelX, my);
      ctx.fillStyle = '#f2ede2';
      ctx.fillText(label, labelX, my);
      ctx.textAlign = 'left';
    }
    arrow(ctx, toX(last.x), toX(last.z), last.yaw, px * 0.028);
    // A one kilometre scale bar and a north mark.
    const bar = (1000 / worldSize) * px;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px * 0.03, px * 0.955, bar, Math.max(3, px / 200));
    ctx.font = `${Math.round(px / 45)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('1 km', px * 0.03 + bar + 8, px * 0.962);
    ctx.textAlign = 'center';
    ctx.fillText('N', px * 0.5, px * 0.035);
  }

  big.addEventListener('click', (e) => {
    const rect = big.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * worldSize;
    const z = ((e.clientY - rect.top) / rect.height - 0.5) * worldSize;
    onJump(x, z);
  });
  mini.addEventListener('click', () => {
    if (overlay.hidden) api.open();
  });
  mini.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); api.open(); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); closeButton.focus(); }
  });

  const api: MapOverlay = {
    toggle() {
      if (overlay.hidden) api.open();
      else api.close();
    },
    open() {
      overlay.hidden = false;
      closeButton.focus();
      drawBig();
    },
    close() {
      const wasOpen = !overlay.hidden;
      overlay.hidden = true;
      if (wasOpen) mini.focus({ preventScroll: true });
    },
    isOpen() {
      return !overlay.hidden;
    },
    redraw(x, z, yaw) {
      last = { x, z, yaw };
      coordinates.textContent = `X ${Math.round(x).toLocaleString()}  /  Z ${Math.round(z).toLocaleString()}`;
      drawMini();
      if (!overlay.hidden) drawBig();
    },
  };
  return api;
}
