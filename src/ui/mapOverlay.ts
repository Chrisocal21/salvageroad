// The in-game map: a small one always in the corner, a big one on M. Both are drawn from one baked
// picture of the island with the roads on it; each redraw only blits the part needed and adds the
// place markers and the player arrow. Clicking the big map travels there (testing). Clicking the
// small one opens the big one.

import type { Place, PlaceKind } from '../rules/places';
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
    /** Called with world coordinates when the big map is clicked. */
    onJump: (x: number, z: number) => void;
  },
): MapOverlay {
  const { base, worldSize, places, onJump } = opts;

  const mini = document.createElement('canvas');
  mini.className = 'map-minimap';
  mini.title = 'M: map';
  parent.appendChild(mini);

  const overlay = document.createElement('div');
  overlay.className = 'map-overlay';
  overlay.hidden = true;
  const big = document.createElement('canvas');
  big.className = 'map-big';
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.textContent = 'Click to travel there (testing)   M or Esc closes';
  overlay.append(big, legend);
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
      const label = `${p.name} · ${p.kind}`;
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

  const api: MapOverlay = {
    toggle() {
      if (overlay.hidden) api.open();
      else api.close();
    },
    open() {
      overlay.hidden = false;
      drawBig();
    },
    close() {
      overlay.hidden = true;
    },
    isOpen() {
      return !overlay.hidden;
    },
    redraw(x, z, yaw) {
      last = { x, z, yaw };
      drawMini();
      if (!overlay.hidden) drawBig();
    },
  };
  return api;
}
