// The ground you stand and drive on: the world's smooth height, plus fine bumps so it does not look sanded.
// Everything that needs the ground height (the drawn terrain tiles, walking, driving physics, props) asks this
// one function, so they always agree. Plain numbers, no rendering.

import { fbm } from './terrain';
import { groundHeight, type WorldMap } from './world';

export interface Ground {
  /** Ground height in metres at a world position. */
  height(x: number, z: number): number;
  /** The level of the town's flat ground. */
  townHeight: number;
}

/** Metres of fine bumpiness, either way. */
export const DETAIL_AMPLITUDE = 0.55;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createGround(map: WorldMap): Ground {
  const { town } = map.settlement;
  const seed = map.spec.seed;
  const calm = town.flatRadius + town.blendRadius * 0.5; // no bumps inside this, so the town stays level
  const full = town.flatRadius + town.blendRadius;
  return {
    townHeight: town.height,
    height(x, z) {
      const base = groundHeight(map, x, z);
      const land = smoothstep(1.5, 6, base); // no bumps in the sea or on the beach
      if (land === 0) return base;
      const away = smoothstep(calm, full, Math.hypot(x - town.x, z - town.z));
      if (away === 0) return base;
      const bumps = fbm(seed + 41, x / 24, z / 24) * 0.8 + fbm(seed + 43, x / 6, z / 6) * 0.25;
      return base + bumps * DETAIL_AMPLITUDE * land * away;
    },
  };
}
