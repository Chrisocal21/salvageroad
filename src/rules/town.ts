import { CONTAINERS, type ContainerKind } from '../data/containers';
import type { Box2 } from './geometry';
import { makeRandom } from './scatter';

// A seeded little town: a 3 by 3 grid of lots between streets. Each lot may hold a building,
// and each building has a few lootable containers against its walls. Plain numbers, no rendering.

export const LOT = 28; // m from street centre to street centre
export const ROAD = 9; // m wide
const GRID = 3;
const LOT_INSET = ROAD / 2; // free space inside a lot starts this far from the lot edge

export interface Building extends Box2 {
  id: number;
  height: number;
  color: number;
}

export interface ContainerSpawn extends Box2 {
  id: number;
  kind: ContainerKind;
  height: number;
}

export interface Town {
  center: { x: number; z: number };
  /** Street centre lines. Vertical streets run along Z at these X values and vice versa. */
  roadsX: number[];
  roadsZ: number[];
  buildings: Building[];
  containers: ContainerSpawn[];
  /** Where the El Cajon is parked, along the nearest street. yaw 0 faces +Z. */
  carSpawn: { x: number; z: number; yaw: number };
  /** Where the player starts, a short walk from the truck, facing the town. */
  playerSpawn: { x: number; z: number; yaw: number };
}

const BUILDING_COLORS = [0xb8a98a, 0x9aa6a8, 0xa88a7a, 0x8f9b86, 0xc0b49c];

export function generateTown(seed: number, center = { x: 0, z: 100 }): Town {
  const rand = makeRandom(seed * 31 + 17);
  const x0 = center.x - (GRID * LOT) / 2;
  const z0 = center.z - (GRID * LOT) / 2;
  const roadsX = Array.from({ length: GRID + 1 }, (_, i) => x0 + i * LOT);
  const roadsZ = Array.from({ length: GRID + 1 }, (_, i) => z0 + i * LOT);

  const buildings: Building[] = [];
  const containers: ContainerSpawn[] = [];
  const kinds = Object.keys(CONTAINERS) as ContainerKind[];

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
      buildings.push(b);

      const wanted = 1 + Math.floor(rand() * 3);
      for (let attempt = 0; attempt < 12 && containers.filter((c) => nearBuilding(c, b)).length < wanted; attempt++) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        const def = CONTAINERS[kind];
        const side = Math.floor(rand() * 4);
        const along = rand() * 2 - 1;
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
        const inLot =
          Math.abs(cx - lotX) + hx <= free / 2 && Math.abs(cz - lotZ) + hz <= free / 2;
        const clash = containers.some((o) => boxesOverlap(o, spawn, 0.4));
        if (inLot && !clash) containers.push(spawn);
      }
    }
  }

  const streetZ = roadsZ[0];
  return {
    center,
    roadsX,
    roadsZ,
    buildings,
    containers,
    carSpawn: { x: center.x - 20, z: streetZ, yaw: Math.PI / 2 },
    playerSpawn: { x: center.x, z: streetZ - 22, yaw: 0 },
  };
}

function nearBuilding(c: Box2, b: Box2): boolean {
  return Math.abs(c.x - b.x) <= b.hx + 3.5 && Math.abs(c.z - b.z) <= b.hz + 3.5;
}

export function boxesOverlap(a: Box2, b: Box2, gap = 0): boolean {
  return Math.abs(a.x - b.x) < a.hx + b.hx + gap && Math.abs(a.z - b.z) < a.hz + b.hz + gap;
}
