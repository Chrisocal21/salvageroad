// Content as data: the kinds of lootable container, their size, and what they can hold.

export type ContainerKind = 'crate' | 'locker' | 'dumpster' | 'toolbox';

export interface LootEntry {
  item: string;
  /** Relative chance. An entry with weight 4 comes up twice as often as one with weight 2. */
  weight: number;
  min: number;
  max: number;
}

export interface ContainerDef {
  kind: ContainerKind;
  name: string;
  /** Half-size on the ground and full height, in metres. */
  hx: number;
  hz: number;
  height: number;
  color: number;
  /** How many separate finds a container gives, from min to max. */
  rolls: [number, number];
  loot: LootEntry[];
}

export const CONTAINERS: Record<ContainerKind, ContainerDef> = {
  crate: {
    kind: 'crate',
    name: 'crate',
    hx: 0.6,
    hz: 0.6,
    height: 1.2,
    color: 0x9a7b4f,
    rolls: [1, 3],
    loot: [
      { item: 'canned_beans', weight: 4, min: 1, max: 3 },
      { item: 'crackers', weight: 3, min: 1, max: 2 },
      { item: 'water_bottle', weight: 3, min: 1, max: 2 },
      { item: 'rope', weight: 2, min: 1, max: 1 },
      { item: 'scrap_metal', weight: 2, min: 1, max: 4 },
    ],
  },
  locker: {
    kind: 'locker',
    name: 'locker',
    hx: 0.5,
    hz: 0.4,
    height: 2,
    color: 0x5d6b78,
    rolls: [1, 2],
    loot: [
      { item: 'bandage', weight: 3, min: 1, max: 2 },
      { item: 'batteries', weight: 3, min: 1, max: 3 },
      { item: 'water_bottle', weight: 2, min: 1, max: 1 },
      { item: 'wrench', weight: 1, min: 1, max: 1 },
    ],
  },
  dumpster: {
    kind: 'dumpster',
    name: 'dumpster',
    hx: 1.2,
    hz: 0.8,
    height: 1.4,
    color: 0x3f5a3f,
    rolls: [1, 3],
    loot: [
      { item: 'scrap_metal', weight: 6, min: 1, max: 5 },
      { item: 'duct_tape', weight: 2, min: 1, max: 1 },
      { item: 'crackers', weight: 1, min: 1, max: 1 },
      { item: 'rope', weight: 1, min: 1, max: 1 },
    ],
  },
  toolbox: {
    kind: 'toolbox',
    name: 'toolbox',
    hx: 0.4,
    hz: 0.25,
    height: 0.6,
    color: 0xb33a2e,
    rolls: [1, 2],
    loot: [
      { item: 'wrench', weight: 2, min: 1, max: 1 },
      { item: 'duct_tape', weight: 3, min: 1, max: 2 },
      { item: 'scrap_metal', weight: 3, min: 1, max: 3 },
      { item: 'batteries', weight: 2, min: 1, max: 2 },
    ],
  },
};
