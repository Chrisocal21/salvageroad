// Content as data: the shipping containers the player builds a base from.
// (Not the same thing as src/data/containers.ts, which is lootable crates and lockers.)
// Real container sizes: 8 ft wide, 8.5 ft tall, 20 ft or 40 ft long. The build grid is 4 ft, so a
// container is 2 cells wide and 5 or 10 cells long, and half-width offsets are possible.

export type ShippingKind = 'ft10' | 'ft20' | 'ft40';

export interface ShippingKindDef {
  name: string;
  /** Cells along its length and across its width when rotation is 0 (long side along X). */
  long: number;
  wide: number;
  length: number;
}

export const SHIPPING = {
  /** Grid cell size in metres (4 ft). */
  cell: 1.2192,
  /** Height of one level in metres (8.5 ft). */
  height: 2.5908,
  /** Highest level that can be built on (0 is the ground). */
  maxLevel: 7,
  /** Grid limit in cells either side of the origin. */
  maxCell: 8192,
  /**
   * The support rule: a container above ground needs either
   *  - at least this share of its footprint sitting on something directly below, or
   *  - something directly below all four of its corners (corner posts).
   * 0.4 lets it overhang by up to 60 percent, so it can cantilever or bridge a gap, but it cannot
   * float. Placeholder: tune by feel.
   */
  minSupport: 0.4,
  kinds: {
    // The 10 ft box reserves three 4 ft cells, leaving a little clearance at its ends.
    ft10: { name: '10 ft', long: 3, wide: 2, length: 3.048 },
    ft20: { name: '20 ft', long: 5, wide: 2, length: 6.096 },
    ft40: { name: '40 ft', long: 10, wide: 2, length: 12.192 },
  } satisfies Record<ShippingKind, ShippingKindDef>,
  /** A support pillar fills one grid cell but is drawn as a slimmer post. Width in metres. */
  pillarWidth: 0.5,
  /** Paint colours the player can pick from (faded, weathered). */
  colors: [0x8c3b2a, 0x35566e, 0x3f5a46, 0xb08a2e, 0x7b8084, 0xc9c1aa],
} as const;
