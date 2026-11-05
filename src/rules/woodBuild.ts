import { SHIPPING } from '../data/shippingContainers';
import { footprint, type Layout, type Rotation } from './baseBuild';
import { pieceBox, type BuildBox } from './baseWorld';
import { addItem, countItem, removeItem, type Inventory } from './inventory';

export const WOOD_PARTS = {
  door: { name: 'Wood door', cost: 6 },
  window: { name: 'Wood shutter window', cost: 5 },
  deck: { name: 'Wood deck', cost: 10 },
  railing: { name: 'Wood railing', cost: 4 },
  garage: { name: 'Wood garage doors', cost: 12 },
  floor: { name: 'Wood floor', cost: 8 },
  wall: { name: 'Wood wall', cost: 8 },
  stairs: { name: 'Wood stairs', cost: 12 },
  workbench: { name: 'Wood planer bench', cost: 0 },
  basicbench: { name: 'Portable toolbox bench', cost: 0 },
} as const;
export type WoodKind = keyof typeof WOOD_PARTS;
export interface WoodSpec {
  kind: WoodKind;
  gx: number;
  gz: number;
  level: number;
  rot: Rotation;
  flip?: boolean;
  y?: number;
  containerId?: number;
}
export interface WoodPiece extends WoodSpec { id: number; open?: boolean }
export interface WoodLayout { pieces: WoodPiece[]; nextId: number }
export interface WoodBox extends BuildBox { material?: 'wood' | 'metal'; pieceId?: number }
export const createWoodLayout = (): WoodLayout => ({ pieces: [], nextId: 1 });
export const woodMaterials = (kind: WoodKind): Record<string, number> =>
  kind === 'basicbench' ? { basic_bench: 1 } : kind === 'workbench' ? { log: 6, planer: 1 } : { wood: WOOD_PARTS[kind].cost };
export const isBench = (kind: WoodKind) => kind === 'workbench' || kind === 'basicbench';
export const isOpening = (kind: WoodKind) => kind === 'door' || kind === 'window' || kind === 'garage';
const CELL = SHIPPING.cell;
const HEIGHT = SHIPPING.height;
const WIDTH = CELL * 2;
const EPS = .015;

export function woodBounds(p: WoodSpec): BuildBox {
  const flat = p.kind === 'floor' || p.kind === 'deck' || p.kind === 'stairs' || isBench(p.kind);
  const run = p.kind === 'stairs' ? 2 : 1;
  return {
    x: (p.gx + (flat ? p.rot === 0 ? run : 1 : p.rot === 0 ? 1 : 0)) * CELL,
    z: (p.gz + (flat ? p.rot === 1 ? run : 1 : p.rot === 1 ? 1 : 0)) * CELL,
    hx: flat ? p.rot === 0 ? CELL * run : CELL : p.rot === 0 ? CELL : .09,
    hz: flat ? p.rot === 1 ? CELL * run : CELL : p.rot === 1 ? CELL : .09,
    y0: p.y ?? p.level * HEIGHT,
    height: p.kind === 'floor' || p.kind === 'deck' ? .12 : p.kind === 'railing' ? 1.05 : p.kind === 'workbench' ? 1.25 : p.kind === 'basicbench' ? .65 : HEIGHT,
  };
}

function frameBoxes(p: WoodPiece): WoodBox[] {
  const b = woodBounds(p);
  const boxes: WoodBox[] = [];
  const add = (a: number, y: number, width: number, height: number, depth = .14) => {
    if (width <= 0 || height <= 0) return;
    boxes.push({ x: b.x + (p.rot === 0 ? a : 0), z: b.z + (p.rot === 1 ? a : 0),
      hx: (p.rot === 0 ? width : depth) / 2, hz: (p.rot === 1 ? width : depth) / 2,
      y0: b.y0 + y, height, pieceId: p.id, material: 'wood' });
  };
  if (p.kind === 'basicbench') {
    boxes.push({ ...b, hx: .6, hz: .35, height: .45, material: 'metal', pieceId: p.id },
      { ...b, hx: .64, hz: .38, y0: b.y0 + .45, height: .09, pieceId: p.id },
      { ...b, hx: .16, hz: .045, y0: b.y0 + .54, height: .1, material: 'metal', pieceId: p.id });
  } else if (p.kind === 'workbench') {
    boxes.push({ ...b, hx: 1, hz: .55, y0: b.y0 + .86, height: .14, pieceId: p.id });
    for (const x of [-.8, .8]) for (const z of [-.38, .38])
      boxes.push({ x: b.x + x, z: b.z + z, hx: .07, hz: .07, y0: b.y0, height: .86, pieceId: p.id });
    boxes.push({ x: b.x, z: b.z, hx: .36, hz: .3, y0: b.y0 + 1, height: .25, material: 'metal', pieceId: p.id });
    boxes.push({ x: b.x + .37, z: b.z, hx: .16, hz: .04, y0: b.y0 + 1.05, height: .04, material: 'metal', pieceId: p.id });
  } else if (p.kind === 'floor' || p.kind === 'deck') {
    for (let n = 0; n < 12; n++) boxes.push({ x: b.x - CELL + (n + .5) * WIDTH / 12,
      z: b.z, hx: WIDTH / 24 - .005, hz: CELL, y0: b.y0, height: .12, pieceId: p.id });
  } else if (p.kind === 'stairs') {
    for (let n = 0; n < 18; n++) {
      const step = (n + .5) * WIDTH * 2 / 18 - WIDTH;
      boxes.push({ x: b.x + (p.rot === 0 ? step : 0), z: b.z + (p.rot === 1 ? step : 0),
        hx: p.rot === 0 ? WIDTH / 18 : CELL, hz: p.rot === 1 ? WIDTH / 18 : CELL,
        y0: b.y0, height: (p.flip ? 18 - n : n + 1) * HEIGHT / 18, pieceId: p.id });
    }
  } else if (p.kind === 'wall') add(0, 0, WIDTH, HEIGHT);
  else if (p.kind === 'railing') {
    for (let n = 0; n <= 6; n++) add(-CELL + n * WIDTH / 6, 0, .07, 1.05);
    add(0, .95, WIDTH, .1);
    add(0, .35, WIDTH, .07);
  } else {
    const openingWidth = p.kind === 'garage' ? WIDTH - .16 : p.kind === 'door' ? 1.02 : 1.4;
    const sill = p.kind === 'window' ? .9 : .12;
    const top = p.kind === 'window' ? 2 : 2.3;
    const side = (WIDTH - openingWidth) / 2;
    add(-(openingWidth + side) / 2, 0, side, HEIGHT);
    add((openingWidth + side) / 2, 0, side, HEIGHT);
    add(0, top, openingWidth, HEIGHT - top);
    add(0, 0, openingWidth, sill);
    if (!p.open) {
      for (let n = 0; n < 8; n++) add(-openingWidth / 2 + (n + .5) * openingWidth / 8,
        sill, openingWidth / 8, top - sill, .08);
    } else {
      // Folded leaves remain visible beside the opening rather than vanishing.
      add(-openingWidth / 2 - .05, sill, .08, top - sill, openingWidth / 2);
      add(openingWidth / 2 + .05, sill, .08, top - sill, openingWidth / 2);
    }
  }
  return boxes;
}
export const woodBoxes = (layout: WoodLayout): WoodBox[] => layout.pieces.flatMap(frameBoxes);

function overlap(a: BuildBox, b: BuildBox): boolean {
  return Math.abs(a.x - b.x) < a.hx + b.hx - EPS && Math.abs(a.z - b.z) < a.hz + b.hz - EPS &&
    a.y0 < b.y0 + b.height - EPS && b.y0 < a.y0 + a.height - EPS;
}
function containerEdge(s: WoodSpec, containers: Layout): boolean {
  const p = s.containerId === undefined ? undefined : containers.pieces.get(s.containerId);
  if (!p || p.kind === 'pillar' || p.level !== s.level || !isOpening(s.kind)) return false;
  const { w, d } = footprint(p.kind, p.rot);
  return s.rot === 0
    ? (s.gz === p.gz || s.gz === p.gz + d) && s.gx >= p.gx && s.gx + 2 <= p.gx + w
    : (s.gx === p.gx || s.gx === p.gx + w) && s.gz >= p.gz && s.gz + 2 <= p.gz + d;
}
export function checkWood(layout: WoodLayout, containers: Layout, s: WoodSpec): string | null {
  if (!Object.hasOwn(WOOD_PARTS, s.kind) || ![s.gx, s.gz, s.level, s.rot].every(Number.isInteger) ||
      s.level < 0 || s.level > SHIPPING.maxLevel || Math.abs(s.gx) > SHIPPING.maxCell - 2 ||
      Math.abs(s.gz) > SHIPPING.maxCell - 2 || (s.rot !== 0 && s.rot !== 1)) return 'Invalid building grid position';
  if (s.y !== undefined && (!isBench(s.kind) || !Number.isFinite(s.y) || Math.abs(s.y) > 2000)) return 'Invalid bench height';
  if (s.containerId !== undefined && !containerEdge(s, containers)) return 'Aim at a container wall';
  const b = woodBounds(s);
  const flat = (kind: WoodKind) => kind === 'floor' || kind === 'deck';
  if (layout.pieces.some(p => {
    if (flat(p.kind) !== flat(s.kind)) return false;
    if (!flat(p.kind) && p.kind !== 'stairs' && s.kind !== 'stairs' && !isBench(p.kind) && !isBench(s.kind) && p.rot !== s.rot) return false;
    return overlap(b, woodBounds(p));
  })) return 'Another wood piece occupies this socket';
  if (s.containerId === undefined && [...containers.pieces.values()].some(p => overlap(b, pieceBox(p))))
    return 'Inside a container: choose a door or window on its wall';
  if (s.level > 0 && s.containerId === undefined) {
    const supported = (x: number, z: number) => {
      const top = s.level * HEIGHT;
      return [...containers.pieces.values()].some(p => {
        const c = pieceBox(p);
        return Math.abs(c.y0 + c.height - top) < .02 && Math.abs(x - c.x) <= c.hx + EPS && Math.abs(z - c.z) <= c.hz + EPS;
      }) || layout.pieces.some(p => {
        const c = woodBounds(p);
        const surface = p.kind === 'floor' || p.kind === 'deck' ? c.y0 : c.y0 + HEIGHT;
        return (p.kind === 'wall' || p.kind === 'stairs' || p.kind === 'floor' || p.kind === 'deck') &&
          Math.abs(surface - top) < .02 && Math.abs(x - c.x) <= c.hx + EPS && Math.abs(z - c.z) <= c.hz + EPS;
      });
    };
    if (![[b.x - b.hx + .08, b.z - b.hz + .08], [b.x + b.hx - .08, b.z + b.hz - .08]]
      .every(([x, z]) => supported(x, z))) return 'Needs a container roof, floor or supported walls below';
  }
  return null;
}
export function placeWood(layout: WoodLayout, containers: Layout, spec: WoodSpec, inventory: Inventory, storage: Inventory[] = []) {
  if (spec.kind !== 'basicbench' && !countItem(inventory, 'build_hammer')) return { ok: false, message: 'Craft and carry a build hammer first' };
  const problem = checkWood(layout, containers, spec);
  if (problem) return { ok: false, message: problem };
  const materials = woodMaterials(spec.kind);
  const sources = [...new Set([inventory, ...storage])];
  if (Object.entries(materials).some(([id, count]) => sources.reduce((n, source) => n + countItem(source, id), 0) < count))
    return { ok: false, message: spec.kind === 'basicbench' ? 'Need a portable toolbox bench in your pack or nearby vehicle' :
      spec.kind === 'workbench' ? 'Need 6 logs and a planer in your pack or nearby vehicle' : 'Not enough wood planks in your pack or nearby vehicle' };
  for (const [id, count] of Object.entries(materials)) {
    let remaining = count;
    for (const source of sources) {
      const take = Math.min(remaining, countItem(source, id));
      removeItem(source, id, take);
      remaining -= take;
    }
  }
  layout.pieces.push({ ...spec, id: layout.nextId++ });
  return { ok: true, message: `Built ${WOOD_PARTS[spec.kind].name}` };
}
export function pickupBasicBench(layout: WoodLayout, containers: Layout, id: number, inventory: Inventory) {
  if (layout.pieces.find(p => p.id === id)?.kind !== 'basicbench') return { ok: false, message: 'This bench cannot be packed up' };
  const trial: Inventory = { ...inventory, slots: inventory.slots.map(s => s ? { ...s } : null) };
  if (addItem(trial, 'basic_bench', 1)) return { ok: false, message: 'Make room in your pack for the toolbox bench' };
  const problem = removeWood(layout, containers, id);
  if (problem) return { ok: false, message: problem };
  inventory.slots.splice(0, inventory.slots.length, ...trial.slots);
  return { ok: true, message: 'Packed up the portable toolbox bench' };
}
export function removeWood(layout: WoodLayout, containers: Layout, id: number): string | null {
  const index = layout.pieces.findIndex(p => p.id === id);
  if (index < 0) return 'Nothing to dismantle';
  const rest = { pieces: layout.pieces.filter(p => p.id !== id), nextId: layout.nextId };
  if (rest.pieces.some(p => checkWood({ ...rest, pieces: rest.pieces.filter(q => q.id !== p.id) }, containers, p)))
    return 'Remove supported pieces first';
  layout.pieces.splice(index, 1);
  return null;
}

/** Split a wall into solid rectangles around each real opening. Same boxes render and collide. */
export function containerShells(containers: Layout, wood: WoodLayout): WoodBox[] {
  const boxes: WoodBox[] = [];
  for (const p of containers.pieces.values()) {
    if (p.kind === 'pillar') { boxes.push(pieceBox(p)); continue; }
    const b = pieceBox(p);
    const holes = wood.pieces.filter(w => w.containerId === p.id);
    if (!holes.length) { boxes.push(b); continue; }
    boxes.push({ ...b, height: .1, material: 'metal' }, { ...b, y0: b.y0 + b.height - .1, height: .1, material: 'metal' });
    for (const rot of [0, 1] as const) for (const side of [-1, 1]) {
      const length = (rot === 0 ? b.hx : b.hz) * 2;
      const center = rot === 0 ? b.x : b.z;
      const edge = (rot === 0 ? b.z : b.x) + side * (rot === 0 ? b.hz : b.hx);
      let rects = [{ lo: center - length / 2, hi: center + length / 2, bottom: b.y0, top: b.y0 + b.height }];
      for (const hole of holes.filter(h => h.rot === rot && Math.abs((rot === 0 ? h.gz : h.gx) * CELL - edge) < .02)) {
        const h = woodBounds(hole), c = rot === 0 ? h.x : h.z;
        const cut = { lo: c - CELL, hi: c + CELL, bottom: b.y0, top: b.y0 + HEIGHT };
        rects = rects.flatMap(r => {
          if (cut.lo >= r.hi || cut.hi <= r.lo) return [r];
          return [{ ...r, hi: Math.max(r.lo, cut.lo) }, { ...r, lo: Math.min(r.hi, cut.hi) }];
        }).filter(r => r.hi - r.lo > .001);
      }
      for (const r of rects) boxes.push({ x: rot === 0 ? (r.lo + r.hi) / 2 : edge,
        z: rot === 1 ? (r.lo + r.hi) / 2 : edge, hx: rot === 0 ? (r.hi - r.lo) / 2 : .05,
        hz: rot === 1 ? (r.hi - r.lo) / 2 : .05, y0: r.bottom, height: r.top - r.bottom, material: 'metal' });
    }
  }
  return boxes;
}

export function aimWood(kind: WoodKind, point: { x: number; y: number; z: number }, rot: Rotation, level: number,
  hit?: { id: number; normalX: number; normalZ: number }, containers?: Layout): WoodSpec {
  const spec: WoodSpec = { kind, gx: Math.round(point.x / CELL) - (rot === 0 ? 1 : 0),
    gz: Math.round(point.z / CELL) - (rot === 1 ? 1 : 0), level, rot };
  if (containers && hit && isOpening(kind)) {
    const p = containers.pieces.get(hit.id);
    if (p && p.kind !== 'pillar' && Math.max(Math.abs(hit.normalX), Math.abs(hit.normalZ)) > .5) {
      const { w, d } = footprint(p.kind, p.rot);
      spec.rot = Math.abs(hit.normalZ) > .5 ? 0 : 1;
      spec.level = p.level;
      spec.containerId = p.id;
      if (spec.rot === 0) {
        spec.gz = p.gz + (hit.normalZ > 0 ? d : 0);
        spec.gx = Math.max(p.gx, Math.min(p.gx + w - 2, Math.round(point.x / CELL) - 1));
      } else {
        spec.gx = p.gx + (hit.normalX > 0 ? w : 0);
        spec.gz = Math.max(p.gz, Math.min(p.gz + d - 2, Math.round(point.z / CELL) - 1));
      }
    }
  }
  if (kind === 'floor' || kind === 'deck' || kind === 'stairs') {
    spec.gx = Math.round(point.x / CELL) - 1;
    spec.gz = Math.round(point.z / CELL) - 1;
    const p = hit && containers?.pieces.get(hit.id);
    if (p && p.kind !== 'pillar') {
      const { w, d } = footprint(p.kind, p.rot);
      if (Math.abs(hit!.normalX) > .5) {
        spec.gx = hit!.normalX > 0 ? p.gx + w : p.gx - (kind === 'stairs' && rot === 0 ? 4 : 2);
        spec.gz = Math.max(p.gz, Math.min(p.gz + d - 2, spec.gz));
        if (kind === 'stairs' && rot === 0) spec.flip = hit!.normalX > 0;
      } else if (Math.abs(hit!.normalZ) > .5) {
        spec.gz = hit!.normalZ > 0 ? p.gz + d : p.gz - (kind === 'stairs' && rot === 1 ? 4 : 2);
        spec.gx = Math.max(p.gx, Math.min(p.gx + w - 2, spec.gx));
        if (kind === 'stairs' && rot === 1) spec.flip = hit!.normalZ > 0;
      } else {
        spec.gx = Math.max(p.gx, Math.min(p.gx + w - 2, spec.gx));
        spec.gz = Math.max(p.gz, Math.min(p.gz + d - 2, spec.gz));
      }
    }
  }
  return spec;
}

/** Reachable walking surfaces only: roofs cannot teleport a player up from ground level. */
export function woodSurface(wood: WoodLayout, containers: Layout, x: number, z: number, previous: number, ground: number): number {
  let y = ground;
  const accept = (height: number) => { if (height <= previous + .35) y = Math.max(y, height); };
  for (const p of wood.pieces) {
    const b = woodBounds(p);
    if (Math.abs(x - b.x) > b.hx || Math.abs(z - b.z) > b.hz) continue;
    if (p.kind === 'floor' || p.kind === 'deck') accept(b.y0 + .12);
    if (p.kind === 'stairs') {
      const t = ((p.rot === 0 ? x - b.x : z - b.z) + WIDTH) / (WIDTH * 2);
      accept(b.y0 + Math.ceil((p.flip ? 1 - t : t) * 18) * HEIGHT / 18);
    }
  }
  for (const p of containers.pieces.values()) {
    if (p.kind === 'pillar') continue;
    const b = pieceBox(p);
    if (Math.abs(x - b.x) > b.hx || Math.abs(z - b.z) > b.hz) continue;
    accept(b.y0 + b.height);
    if (wood.pieces.some(w => w.containerId === p.id)) accept(b.y0 + .12);
  }
  return y;
}

export function loadWood(layout: WoodLayout, containers: Layout, raw: string | null, containerIds?: Map<number, number>): number {
  if (!raw) return 0;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid saved wood layout');
  const valid = (p: unknown): p is WoodPiece => !!p && typeof p === 'object' && 'kind' in p &&
    typeof p.kind === 'string' && Object.hasOwn(WOOD_PARTS, p.kind) &&
    'gx' in p && 'gz' in p && 'level' in p && 'rot' in p &&
    [p.gx, p.gz, p.level, p.rot].every(Number.isInteger) &&
    (!('containerId' in p) || p.containerId === undefined || Number.isInteger(p.containerId)) &&
    (!('flip' in p) || p.flip === undefined || typeof p.flip === 'boolean') &&
    (!('y' in p) || p.y === undefined || typeof p.y === 'number' && Number.isFinite(p.y)) &&
    (!('open' in p) || p.open === undefined || typeof p.open === 'boolean');
  if (!parsed.every(valid)) throw new Error('Invalid saved wood piece');
  const saved = parsed.sort((a, b) => a.level - b.level);
  const restored = createWoodLayout();
  for (const original of saved) {
    const p = { ...original };
    if (p.containerId !== undefined && containerIds) {
      const id = containerIds.get(p.containerId);
      if (id === undefined) throw new Error('Saved opening has no container');
      p.containerId = id;
    }
    if (checkWood(restored, containers, p)) throw new Error('Saved wood piece has invalid placement or support');
    restored.pieces.push({ ...p, id: restored.nextId++ });
  }
  layout.pieces = restored.pieces;
  layout.nextId = restored.nextId;
  return saved.length;
}
