// Scatters rocks, scrub, cacti and trees across the part of the world around the town, by biome.
// Plain numbers, no rendering. Same seed, same props.

import type { Ground } from './ground';
import { makeRandom, type Prop, type PropKind } from './scatter';
import { aridityAt, DESERT, waterLevel, type WorldMap } from './world';

/** Which kind of prop a spot grows, given how dry it is and a random number from 0 to 1. */
export function pickKind(aridity: number, roll: number): PropKind {
  if (aridity > DESERT) return roll < 0.45 ? 'rock' : roll < 0.8 ? 'shrub' : 'cactus';
  if (aridity > 0.45) return roll < 0.2 ? 'rock' : roll < 0.6 ? 'shrub' : 'tree';
  return roll < 0.7 ? 'tree' : roll < 0.85 ? 'rock' : 'shrub';
}

export function scatterWorldProps(
  map: WorldMap,
  ground: Ground,
  seed: number,
  count: number,
  radius: number,
): Prop[] {
  const rand = makeRandom(seed);
  const { town, spawn } = map.settlement;
  const clear = town.flatRadius + town.blendRadius; // the town and its level ground stay open
  const props: Prop[] = [];
  let attempts = 0;
  while (props.length < count && attempts < count * 30) {
    attempts++;
    // Uniform over a disc around the town.
    const r = radius * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const x = town.x + Math.cos(a) * r;
    const z = town.z + Math.sin(a) * r;
    if (r < clear) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 6) continue; // not on top of the player's starting point
    if (Math.abs(x) > map.half - 20 || Math.abs(z) > map.half - 20) continue;
    if (ground.roadDistance(x, z) < 12) continue; // not on a road
    const h = ground.height(x, z);
    if (h < 2 || waterLevel(map, x, z) !== null) continue; // dry land only
    const slope = Math.hypot(ground.height(x + 3, z) - ground.height(x - 3, z), ground.height(x, z + 3) - ground.height(x, z - 3)) / 6;
    if (slope > 0.5) continue; // not on steep ground
    const kind = pickKind(aridityAt(map, x, z), rand());
    const scale = kind === 'tree' ? 0.8 + rand() * 0.8 : 0.7 + rand() * 0.7;
    props.push({ kind, x, z, yaw: rand() * Math.PI * 2, scale });
  }
  return props;
}
