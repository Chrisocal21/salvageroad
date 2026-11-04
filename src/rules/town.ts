import { CONTAINERS, OUTSIDE_KINDS, type ContainerKind } from '../data/containers';
import type { PartKind } from './carParts';
import { PARTS, PART_KINDS } from './carParts';
import type { Box2 } from './geometry';
import type { ItemStack } from './inventory';
import { makeRandom } from './scatter';
import { SHIPPING } from '../data/shippingContainers';
import type { PieceSpec } from './baseBuild';
import { pieceBox } from './baseWorld';

// A seeded little town: a 3 by 3 grid of lots between streets. Each lot may hold a building, and each building has
// a few lootable containers against its walls. Some buildings are stores you can walk into, with shelves inside.
// Beside the town is a fenced junkyard where the El Cajon sits stripped, its parts lying round the yard.
// Plain numbers, no rendering.

export const LOT = 28; // m from street centre to street centre
export const ROAD = 9; // m wide
export const GRID = 3;
const LOT_INSET = ROAD / 2; // free space inside a lot starts this far from the lot edge

/** Store walls. */
export const STORE = { wall: 0.3, doorHalf: 0.8 };
/** The junkyard's fence and gate. */
export const YARD = { hx: 18, hz: 14, fence: 0.2, fenceHeight: 2.2, gateHalf: 3.5 };

export type StoreKind = 'market' | 'hardware';

export interface Building extends Box2 {
  id: number;
  height: number;
  color: number;
  /** Set for a store you can walk into. */
  store?: StoreKind;
  /** Which way the store's door faces, as a yaw: 0 faces +Z, PI/2 faces +X. Only for stores. */
  front?: number;
}

export interface ContainerSpawn extends Box2 {
  id: number;
  kind: ContainerKind;
  height: number;
  /** The store it is inside, if any. It can only be reached from inside that store. */
  inside?: number;
  /** What it holds, when not left to chance. */
  fixedLoot?: ItemStack[];
}

/** Something you cannot walk or drive through, with its height. */
export interface Solid extends Box2 {
  height: number;
}

/** A dead car in the junkyard. Lies along X when turned is true, otherwise along Z. */
export interface Wreck extends Solid {
  turned: boolean;
  color: number;
}

/** A part of the El Cajon lying in the junkyard. */
export interface PartSpawn {
  id: number;
  kind: PartKind;
  x: number;
  z: number;
  yaw: number;
  /** For things stacked on each other, such as the tyres: 0 is on the ground, 1 is on top of that. */
  level?: number;
}

export interface Junkyard extends Box2 {
  /** The gap in the fence on the street side (+Z), centred on this X. */
  gateX: number;
  fence: Solid[];
  wrecks: Wreck[];
  shed: Solid;
  tires: Solid[];
  parts: PartSpawn[];
  /** A big rig tyre lying in the yard: far too big for the El Cajon, but something bigger will want it. */
  rigTire: { x: number; z: number; yaw: number };
  /**
   * A shipping container that stands in the yard, on the build grid. It is part of the world, not the player's base:
   * something to come back for with a truck that can haul it.
   */
  cargo: PieceSpec;
}

export interface Town {
  center: { x: number; z: number };
  /** Street centre lines. Vertical streets run along Z at these X values and vice versa. */
  roadsX: number[];
  roadsZ: number[];
  buildings: Building[];
  containers: ContainerSpawn[];
  junkyard: Junkyard;
  /** Everything solid: buildings (or a store's walls), the junkyard fence, wrecks, shed and tyre piles. Not containers. */
  solids: Solid[];
  /** Where the El Cajon sits in the junkyard, facing the gate. yaw 0 faces +Z. */
  carSpawn: { x: number; z: number; yaw: number };
  /** A spot on the street outside the junkyard gate. For tests; the game starts the player out in the desert. */
  playerSpawn: { x: number; z: number; yaw: number };
}

const BUILDING_COLORS = [0xb8a98a, 0x9aa6a8, 0xa88a7a, 0x8f9b86, 0xc0b49c];
const WRECK_COLORS = [0x6d4b3a, 0x5b6470, 0x7a6a4a, 0x4f5a4a, 0x8a5a44];

/** Turns a point given in a frame facing yaw (local +Z along yaw) into world X and Z, about (ox, oz). */
function toWorld(ox: number, oz: number, yaw: number, lx: number, lz: number): [number, number] {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

/** A box given in a quarter-turned local frame, as a world box. */
function localBox(ox: number, oz: number, yaw: number, lx: number, lz: number, lhx: number, lhz: number): Box2 {
  const [x, z] = toWorld(ox, oz, yaw, lx, lz);
  const quarter = Math.abs(Math.sin(yaw)) > 0.5;
  return { x, z, hx: quarter ? lhz : lhx, hz: quarter ? lhx : lhz };
}

/** Half the store's width across its front, and half its depth, in its own frame. */
function storeHalves(b: Building): [number, number] {
  return Math.abs(Math.sin(b.front ?? 0)) > 0.5 ? [b.hz, b.hx] : [b.hx, b.hz];
}

/**
 * A store's walls: back, left, right, and the front either side of the door. The front pieces are marked, so they can
 * be drawn with windows.
 */
export function storeWalls(b: Building): (Box2 & { front: boolean })[] {
  const yaw = b.front ?? 0;
  const [w, d] = storeHalves(b);
  const t = STORE.wall;
  const door = STORE.doorHalf;
  const side = (w - door) / 2;
  return [
    { ...localBox(b.x, b.z, yaw, 0, -d + t / 2, w, t / 2), front: false },
    { ...localBox(b.x, b.z, yaw, -w + t / 2, 0, t / 2, d), front: false },
    { ...localBox(b.x, b.z, yaw, w - t / 2, 0, t / 2, d), front: false },
    { ...localBox(b.x, b.z, yaw, -door - side, d - t / 2, side, t / 2), front: true },
    { ...localBox(b.x, b.z, yaw, door + side, d - t / 2, side, t / 2), front: true },
  ];
}

/** The floor space inside a store's walls. */
export function storeInterior(b: Building): Box2 {
  return { x: b.x, z: b.z, hx: b.hx - STORE.wall, hz: b.hz - STORE.wall };
}

/** The store the point is inside, or null when outside. */
export function storeAt(town: Town, x: number, z: number): number | null {
  for (const b of town.buildings) {
    if (!b.store) continue;
    const r = storeInterior(b);
    if (Math.abs(x - r.x) <= r.hx && Math.abs(z - r.z) <= r.hz) return b.id;
  }
  return null;
}

/** The containers that can be reached from a point: those in the same store, or those outside when outside. */
export function reachableContainers(town: Town, x: number, z: number): ContainerSpawn[] {
  const here = storeAt(town, x, z);
  return town.containers.filter((c) => (c.inside ?? null) === here);
}

export function generateTown(seed: number, center = { x: 0, z: 100 }): Town {
  const rand = makeRandom(seed * 31 + 17);
  const x0 = center.x - (GRID * LOT) / 2;
  const z0 = center.z - (GRID * LOT) / 2;
  const roadsX = Array.from({ length: GRID + 1 }, (_, i) => x0 + i * LOT);
  const roadsZ = Array.from({ length: GRID + 1 }, (_, i) => z0 + i * LOT);

  const buildings: Building[] = [];
  const containers: ContainerSpawn[] = [];
  const lots: { lotX: number; lotZ: number; i: number; j: number }[] = [];

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (rand() < 0.15) continue; // an empty lot now and then
      const lotX = roadsX[i] + LOT / 2;
      const lotZ = roadsZ[j] + LOT / 2;
      const free = LOT - 2 * LOT_INSET; // 19 m of usable ground in the lot
      const w = 9 + rand() * 6; // 9 to 15 m
      const d = 9 + rand() * 6;
      const slackX = (free - w) / 2 - 2.5; // leave room along the walls for containers
      const slackZ = (free - d) / 2 - 2.5;
      const b: Building = {
        id: buildings.length,
        x: lotX + (rand() * 2 - 1) * Math.max(0, slackX),
        z: lotZ + (rand() * 2 - 1) * Math.max(0, slackZ),
        hx: w / 2,
        hz: d / 2,
        height: 3.5 + rand() * 3.5,
        color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
      };
      const roll = rand();
      if (roll < 0.45) b.store = roll < 0.3 ? 'market' : 'hardware';
      buildings.push(b);
      lots.push({ lotX, lotZ, i, j });
    }
  }
  // Every town has somewhere to find food and water: make the biggest building a market if none is.
  if (!buildings.some((b) => b.store === 'market') && buildings.length > 0) {
    const biggest = buildings.reduce((a, b) => (b.hx * b.hz > a.hx * a.hz ? b : a));
    biggest.store = 'market';
  }

  for (let k = 0; k < buildings.length; k++) {
    const b = buildings[k];
    const { lotX, lotZ, i, j } = lots[k];
    const free = LOT - 2 * LOT_INSET;
    // A store's door faces the nearest street.
    let frontSide = -1; // 0: -Z, 1: +Z, 2: -X, 3: +X, as for the containers below
    if (b.store) {
      const gaps = [b.z - b.hz - roadsZ[j], roadsZ[j + 1] - (b.z + b.hz), b.x - b.hx - roadsX[i], roadsX[i + 1] - (b.x + b.hx)];
      frontSide = gaps.indexOf(Math.min(...gaps));
      b.front = [Math.PI, 0, -Math.PI / 2, Math.PI / 2][frontSide];
      placeShelves(b, containers);
    }

    const wanted = 1 + Math.floor(rand() * 3);
    for (let attempt = 0; attempt < 12 && containers.filter((c) => c.inside === undefined && nearBuilding(c, b)).length < wanted; attempt++) {
      const kind = OUTSIDE_KINDS[Math.floor(rand() * OUTSIDE_KINDS.length)];
      const def = CONTAINERS[kind];
      const side = Math.floor(rand() * 4);
      const along = rand() * 2 - 1;
      if (side === frontSide) continue; // keep the shop front and its door clear
      const gap = 0.7;
      let cx = b.x;
      let cz = b.z;
      let hx = def.hx;
      let hz = def.hz;
      if (side < 2) {
        // north or south wall, container runs along X
        cx = b.x + along * (b.hx - def.hx);
        cz = b.z + (side === 0 ? -1 : 1) * (b.hz + def.hz + gap);
      } else {
        // east or west wall: turn the container a quarter so its long side hugs the wall
        [hx, hz] = [def.hz, def.hx];
        cx = b.x + (side === 2 ? -1 : 1) * (b.hx + hx + gap);
        cz = b.z + along * (b.hz - hz);
      }
      const spawn: ContainerSpawn = { id: containers.length, kind, x: cx, z: cz, hx, hz, height: def.height };
      const inLot = Math.abs(cx - lotX) + hx <= free / 2 && Math.abs(cz - lotZ) + hz <= free / 2;
      const clash = containers.some((o) => boxesOverlap(o, spawn, 0.4));
      if (inLot && !clash) containers.push(spawn);
    }
  }

  const junkyard = generateJunkyard(rand, center.x, roadsZ[0] - ROAD / 2 - 2 - YARD.hz, containers);

  const solids: Solid[] = [];
  for (const b of buildings) {
    if (b.store) for (const w of storeWalls(b)) solids.push({ x: w.x, z: w.z, hx: w.hx, hz: w.hz, height: b.height });
    else solids.push({ x: b.x, z: b.z, hx: b.hx, hz: b.hz, height: b.height });
  }
  const cargoBox = pieceBox(junkyard.cargo);
  solids.push(...junkyard.fence, ...junkyard.wrecks, junkyard.shed, ...junkyard.tires, { x: cargoBox.x, z: cargoBox.z, hx: cargoBox.hx, hz: cargoBox.hz, height: cargoBox.height });

  return {
    center,
    roadsX,
    roadsZ,
    buildings,
    containers,
    junkyard,
    solids,
    carSpawn: { x: junkyard.gateX, z: junkyard.z + 1, yaw: 0 },
    playerSpawn: { x: junkyard.gateX + 6, z: roadsZ[0], yaw: Math.PI },
  };
}

/** Shelves along the back wall and both side walls of a store, the aisle down the middle left clear. */
function placeShelves(b: Building, containers: ContainerSpawn[]) {
  const kind: ContainerKind = b.store === 'market' ? 'market_shelf' : 'hardware_shelf';
  const def = CONTAINERS[kind];
  const yaw = b.front ?? 0;
  const [w, d] = storeHalves(b);
  const inner = w - STORE.wall;
  const back = -d + STORE.wall + def.hz + 0.1;
  const across = inner > 5.5 ? 3 : 2;
  const spots: [number, number, number, number][] = [];
  for (let k = 0; k < across; k++) spots.push([-inner + ((k + 0.5) * 2 * inner) / across, back, def.hx, def.hz]);
  for (const s of [-1, 1]) spots.push([s * (inner - def.hz - 0.1), -0.4, def.hz, def.hx]); // side walls, turned
  for (const [lx, lz, lhx, lhz] of spots) {
    containers.push({ id: containers.length, kind, ...localBox(b.x, b.z, yaw, lx, lz, lhx, lhz), height: def.height, inside: b.id });
  }
}

/** How far each part must be kept from other things, roughly half its length lying on the ground. */
const PART_RADIUS: Record<PartKind, number> = {
  engine: 0.6,
  battery: 0.3,
  hood: 1.0,
  tailgate: 1.0,
  front_bumper: 1.1,
  rear_bumper: 1.1,
  seat: 0.8,
  wheel: 0.45,
  dash: 0.9,
  steering_wheel: 0.3,
  windshield: 0.9,
  driver_door: 0.8,
  passenger_door: 0.8,
  grille: 0.95,
  headlights: 0.4,
};

function generateJunkyard(rand: () => number, x: number, z: number, containers: ContainerSpawn[]): Junkyard {
  const { hx, hz, fence: t, fenceHeight: h, gateHalf } = YARD;
  const gateX = x;
  const fence: Solid[] = [
    { x, z: z - hz + t / 2, hx, hz: t / 2, height: h },
    { x: x - hx + t / 2, z, hx: t / 2, hz, height: h },
    { x: x + hx - t / 2, z, hx: t / 2, hz, height: h },
  ];
  const leftEnd = gateX - gateHalf;
  const rightStart = gateX + gateHalf;
  fence.push({ x: (x - hx + leftEnd) / 2, z: z + hz - t / 2, hx: (leftEnd - (x - hx)) / 2, hz: t / 2, height: h });
  fence.push({ x: (rightStart + x + hx) / 2, z: z + hz - t / 2, hx: (x + hx - rightStart) / 2, hz: t / 2, height: h });

  const jitter = () => (rand() * 2 - 1) * 0.8;
  const wreck = (wx: number, wz: number, turned: boolean): Wreck => ({
    x: wx,
    z: wz,
    hx: turned ? 2.3 : 1.10,
    hz: turned ? 1.10 : 2.3,
    height: 1.4,
    turned,
    color: WRECK_COLORS[Math.floor(rand() * WRECK_COLORS.length)],
  });
  // Dead cars along the back and the sides, a shed in the corner by the gate, tyres piled in the corners.
  const wrecks = [
    wreck(x - 11 + jitter(), z - hz + 2.2, true),
    wreck(x - 4 + jitter(), z - hz + 2.2, true),
    wreck(x + 6 + jitter(), z - hz + 2.2, true),
    wreck(x - hx + 2.2, z + 1 + jitter(), false),
    wreck(x + hx - 2.2, z - 3 + jitter(), false),
  ];
  // Decorative vehicle silhouettes, including the roof rack and the taller pickup cabs.
  const wreckHeights = [1.60, 1.70, 1.50, 1.25, 1.70];
  wrecks.forEach((w, index) => { w.height = wreckHeights[index]; });
  const shed: Solid = { x: x + hx - 3, z: z + hz - 3.2, hx: 2, hz: 1.6, height: 2.7 };
  const tires: Solid[] = [
    { x: x - hx + 1.6, z: z - hz + 1.6, hx: 0.55, hz: 0.55, height: 0.9 },
    { x: x + hx - 1.6, z: z - hz + 1.6, hx: 0.55, hz: 0.55, height: 1.1 },
    { x: x - hx + 1.6, z: z + hz - 1.8, hx: 0.55, hz: 0.55, height: 0.7 },
  ];
  // The yard's toolbox, by the shed, always has a wrench: without one nothing can be bolted on.
  const toolbox: ContainerSpawn = {
    id: containers.length,
    kind: 'toolbox',
    x: shed.x - shed.hx - 0.6,
    z: shed.z + 0.4,
    hx: CONTAINERS.toolbox.hz,
    hz: CONTAINERS.toolbox.hx,
    height: CONTAINERS.toolbox.height,
    fixedLoot: [
      { id: 'wrench', count: 1 },
      { id: 'duct_tape', count: 1 },
    ],
  };
  containers.push(toolbox);

  // The parts, scattered round the yard: clear of everything, of each other, and of the way out to the gate.
  const car: Box2 = { x: gateX, z: z + 1, hx: 0.95 + 1.2, hz: 2.6 + 1.2 };
  const driveOut: Box2 = { x: gateX, z: (z + 1 + z + hz) / 2 + 1, hx: 2.2, hz: (hz - 1) / 2 + 1 };
  // The yard's shipping container stands along the right-hand fence between the wreck and the shed, long side along Z.
  // It sits on the build grid (cells of 1.2192 m), so it is rounded to the nearest cell, and kept clear of the fence.
  const cell = SHIPPING.cell;
  const cargo: PieceSpec = {
    kind: 'ft20',
    gx: Math.round((x + hx - 2.4) / cell - 1),
    gz: Math.round((z + 4.6) / cell - 2.5),
    level: 0,
    rot: 1,
    color: Math.floor(rand() * SHIPPING.colors.length),
  };
  const cargoBox = pieceBox(cargo);
  const keepOff: Box2[] = [car, driveOut, ...wrecks, shed, ...tires, toolbox, cargoBox];
  // The big rig tyre lies against the back fence in the gap between two wrecks.
  const rigTire = { x: x + 12, z: z - hz + 1.8, yaw: rand() * Math.PI * 2 };
  keepOff.push({ x: rigTire.x, z: rigTire.z, hx: 0.7, hz: 0.7 });
  const parts: PartSpawn[] = [];
  for (const kind of PART_KINDS) {
    // The four wheels are one stack of tyres, not four loose ones: they all go in the same spot, one on top of another.
    const stacked = kind === 'wheel';
    let stackAt: { x: number; z: number; yaw: number } | null = null;
    for (let n = 0; n < PARTS[kind].count; n++) {
      if (stackAt) {
        parts.push({ id: parts.length, kind, x: stackAt.x, z: stackAt.z, yaw: stackAt.yaw + (rand() - 0.5) * 0.5, level: n });
        continue;
      }
      const r = PART_RADIUS[kind];
      for (let attempt = 0; attempt < 400; attempt++) {
        const px = x + (rand() * 2 - 1) * (hx - r - 1);
        const pz = z + (rand() * 2 - 1) * (hz - r - 1);
        const spot: Box2 = { x: px, z: pz, hx: r, hz: r };
        if (keepOff.some((o) => boxesOverlap(o, spot, 0.7))) continue;
        if (parts.some((p) => Math.hypot(p.x - px, p.z - pz) < PART_RADIUS[p.kind] + r + 0.8)) continue;
        const spawn: PartSpawn = { id: parts.length, kind, x: px, z: pz, yaw: rand() * Math.PI * 2 };
        if (stacked) {
          spawn.level = 0;
          stackAt = spawn;
        }
        parts.push(spawn);
        break;
      }
    }
  }
  return { x, z, hx, hz, gateX, fence, wrecks, shed, tires, parts, rigTire, cargo };
}

function nearBuilding(c: Box2, b: Box2): boolean {
  return Math.abs(c.x - b.x) <= b.hx + 3.5 && Math.abs(c.z - b.z) <= b.hz + 3.5;
}

export function boxesOverlap(a: Box2, b: Box2, gap = 0): boolean {
  return Math.abs(a.x - b.x) < a.hx + b.hx + gap && Math.abs(a.z - b.z) < a.hz + b.hz + gap;
}
