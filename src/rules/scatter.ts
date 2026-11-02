// Seeded placement of placeholder props (trees, crates, rocks). Plain numbers, no rendering.

export type PropKind = 'tree' | 'crate' | 'rock';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  yaw: number; // radians
  scale: number;
}

/** Small, fast, seedable random number generator (mulberry32). Returns 0 to 1. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatters props across a square area centred on the origin.
 * Nothing lands within `clearRadius` of the origin, inside a clear zone, or within `edgeMargin` of the edge.
 */
export function scatterProps(
  seed: number,
  count: number,
  size: number,
  clearRadius: number,
  edgeMargin = 12,
  clearZones: { x: number; z: number; r: number }[] = [],
): Prop[] {
  const rand = makeRandom(seed);
  const half = size / 2 - edgeMargin;
  const props: Prop[] = [];
  while (props.length < count) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (Math.hypot(x, z) < clearRadius) continue;
    if (clearZones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r)) continue;
    const pick = rand();
    const kind: PropKind = pick < 0.6 ? 'tree' : pick < 0.85 ? 'crate' : 'rock';
    const scale = kind === 'tree' ? 0.8 + rand() * 0.8 : 0.7 + rand() * 0.7;
    props.push({ kind, x, z, yaw: rand() * Math.PI * 2, scale });
  }
  return props;
}

/** Half-sizes of the box each prop collides as, before scaling. Trees collide as their trunk only. */
export const PROP_COLLIDER: Record<PropKind, { hx: number; hy: number; hz: number }> = {
  tree: { hx: 0.25, hy: 2, hz: 0.25 },
  crate: { hx: 0.6, hy: 0.6, hz: 0.6 },
  rock: { hx: 0.9, hy: 0.6, hz: 0.9 },
};
