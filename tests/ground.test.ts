import { describe, expect, it } from 'vitest';
import { createGround, DETAIL_AMPLITUDE } from '../src/rules/ground';
import { ROAD_SPEC, type RoadNetwork, type RoadPoint } from '../src/rules/roads';
import { generateWorld, groundHeight } from '../src/rules/world';

// A small real world (fast to make) and a hand-written road across it: straight east-west line at z = ROAD_Z,
// a constant height a little above the natural ground, and a 200 m bridge in the middle with a higher deck.
const map = generateWorld({ seed: 1, size: 12000, cells: 256 });
const ROAD_Z = 500;
const ROAD_Y = groundHeight(map, 1000, ROAD_Z) + 3;
const DECK_Y = ROAD_Y + 10;
const HALF = ROAD_SPEC.road.width / 2; // 4.5 m

const points: RoadPoint[] = [];
for (let x = -2000; x <= 2000; x += 50) {
  const bridge = Math.abs(x) <= 100;
  points.push({ x, z: ROAD_Z, y: bridge ? DECK_Y : ROAD_Y, bridge });
}
const network: RoadNetwork = {
  roads: [{ id: 0, class: 'road', from: 0, to: 1, points, length: 4000, bridgeLength: 200 }],
  connected: [0, 1],
};

const ground = createGround(map, network);
const plain = createGround(map); // no roads: what the world was before the network

describe('ground along roads', () => {
  it('follows the road height on the road, with no bumps', () => {
    expect(ground.height(1000, ROAD_Z)).toBeCloseTo(ROAD_Y, 5);
    expect(ground.height(-1500, ROAD_Z)).toBeCloseTo(ROAD_Y, 5);
  });

  it('leaves the world untouched far from any road', () => {
    expect(ground.height(1000, ROAD_Z + 4000)).toBe(plain.height(1000, ROAD_Z + 4000));
    expect(ground.height(-4000, ROAD_Z - 3000)).toBe(plain.height(-4000, ROAD_Z - 3000));
  });

  it('blends back to natural ground across the margin, and is fully natural beyond it', () => {
    const halfwayZ = ROAD_Z + HALF + 4.5;
    const naturalThere = plain.height(1000, halfwayZ);
    const halfway = ground.height(1000, halfwayZ);
    expect(Math.abs(halfway - ROAD_Y)).toBeGreaterThan(0.05);
    expect(Math.abs(halfway - naturalThere)).toBeGreaterThan(0.05);
    const beyondZ = ROAD_Z + HALF + 9 + 2;
    expect(ground.height(1000, beyondZ)).toBe(plain.height(1000, beyondZ));
  });

  it('keeps the ground natural under a bridge, and puts the deck only in the surface', () => {
    expect(ground.height(0, ROAD_Z)).toBe(plain.height(0, ROAD_Z));
    expect(ground.surface(0, ROAD_Z)).toBeCloseTo(DECK_Y, 5);
    // Off the bridge, the surface is the ground.
    expect(ground.surface(1000, ROAD_Z)).toBe(ground.height(1000, ROAD_Z));
    // Off the side of the deck, no lift.
    expect(ground.surface(0, ROAD_Z + HALF + 3)).toBe(ground.height(0, ROAD_Z + HALF + 3));
  });

  it('tells how far the nearest road is', () => {
    expect(ground.roadDistance(1000, ROAD_Z)).toBeLessThanOrEqual(3);
    expect(ground.roadDistance(1000, ROAD_Z + 4000)).toBe(Infinity);
    expect(plain.roadDistance(1000, ROAD_Z)).toBe(Infinity);
  });

  it('without a network the surface is the ground', () => {
    expect(plain.surface(1000, ROAD_Z)).toBe(plain.height(1000, ROAD_Z));
  });

  it('calms the bumps on the road but keeps them away from it', () => {
    // Somewhere with real bumps, well off the road: the two grounds agree, bumps and all.
    let bumpy: { x: number; z: number } | null = null;
    for (let x = -3000; x <= 3000 && !bumpy; x += 137) {
      for (let z = 2500; z <= 5500; z += 141) {
        if (Math.abs(plain.height(x, z) - groundHeight(map, x, z)) > DETAIL_AMPLITUDE * 0.3) {
          bumpy = { x, z };
          break;
        }
      }
    }
    expect(bumpy).not.toBeNull();
    expect(ground.height(bumpy!.x, bumpy!.z)).toBe(plain.height(bumpy!.x, bumpy!.z));
  });
});
