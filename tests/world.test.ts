import { describe, expect, it } from 'vitest';
import { aridityAt, DESERT, generateWorld, groundHeight, KIND, kindAt, NO_WATER, SEA_LEVEL, SIGHT, waterLevel, WORLD, type WorldMap, type WorldSpec } from '../src/rules/world';

// A smaller world keeps these tests fast. Same code, fewer cells.
const small = (seed: number): WorldSpec => ({ seed, size: 12000, cells: 256 });
const hash = (a: Float32Array) => {
  let h = 0;
  for (let i = 0; i < a.length; i += 97) h = (Math.imul(h, 31) + Math.round(a[i] * 100)) | 0;
  return h;
};

describe('world shape', () => {
  it('is the same every time for the same seed, and different for another', () => {
    const a = generateWorld(small(1));
    const b = generateWorld(small(1));
    const c = generateWorld(small(2));
    expect(hash(a.ground)).toBe(hash(b.ground));
    expect(hash(a.ground)).not.toBe(hash(c.ground));
    expect(a.stats).toEqual(b.stats);
  });

  it('has open ocean all the way around the edge', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = generateWorld(small(seed));
      for (let k = 0; k < w.n; k++) {
        for (const i of [k, (w.n - 1) * w.n + k, k * w.n, k * w.n + w.n - 1]) {
          expect(w.ground[i]).toBeLessThan(0);
          expect(w.water[i]).toBe(SEA_LEVEL);
        }
      }
    }
  });

  it('has a sensible mix of land and sea for many seeds', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { stats } = generateWorld(small(seed));
      expect(stats.landFraction).toBeGreaterThan(0.2);
      expect(stats.landFraction).toBeLessThan(0.65);
      expect(stats.highest).toBeGreaterThan(100); // broad highlands on the road-accessible 12 km island
      expect(stats.deepest).toBeLessThan(-40); // real deep water
    }
  });

  it('has rivers, and they all reach the sea or a lake', () => {
    for (const seed of [1, 2, 3]) {
      const w = generateWorld(small(seed));
      expect(w.stats.riverCells).toBeGreaterThan(50);
      expect(w.stats.riverMouths).toBeGreaterThan(0);
      // Follow every river cell downhill: it must end at the sea, never loop and never climb.
      for (let i = 0; i < w.kind.length; i += 7) {
        if (w.kind[i] !== KIND.river) continue;
        let cur = i;
        let steps = 0;
        while (w.flowTo[cur] >= 0 && w.kind[cur] !== KIND.ocean) {
          const next = w.flowTo[cur];
          expect(next).not.toBe(cur);
          cur = next;
          if (++steps > w.n * 4) throw new Error('a river loops');
        }
        expect(w.kind[cur] === KIND.ocean || w.ground[cur] <= SEA_LEVEL + 1).toBe(true);
      }
    }
  });

  it('has river water that never runs uphill', () => {
    const w = generateWorld(small(1));
    let checked = 0;
    for (let i = 0; i < w.kind.length; i++) {
      if (w.kind[i] !== KIND.river) continue;
      const next = w.flowTo[i];
      if (next < 0 || w.water[next] === NO_WATER) continue;
      expect(w.water[next]).toBeLessThanOrEqual(w.water[i] + 0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('has lakes with flat water that sits above the lake bed', () => {
    let lakes = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const w = generateWorld(small(seed));
      lakes += w.stats.lakes;
      for (let i = 0; i < w.kind.length; i++) {
        if (w.kind[i] === KIND.lake) expect(w.water[i]).toBeGreaterThan(w.ground[i]);
      }
    }
    expect(lakes).toBeGreaterThan(0);
  });

  it('never has water on a high mountain or dry ground under the sea', () => {
    const w = generateWorld(small(1));
    for (let i = 0; i < w.kind.length; i++) {
      if (w.kind[i] === KIND.ocean) expect(w.ground[i]).toBeLessThanOrEqual(SEA_LEVEL);
      if (w.water[i] !== NO_WATER) expect(w.water[i]).toBeGreaterThanOrEqual(w.ground[i] - 0.05);
    }
  });
});

describe('asking the world', () => {
  const w: WorldMap = generateWorld(small(1));

  it('gives the grid height at a grid point and a blend between points', () => {
    const i = 100 * w.n + 80;
    const x = -w.half + 80 * w.spacing;
    const z = -w.half + 100 * w.n * 0 + 100 * w.spacing;
    expect(groundHeight(w, x, z)).toBeCloseTo(w.ground[i], 3);
    const mid = groundHeight(w, x + w.spacing / 2, z);
    const lo = Math.min(w.ground[i], w.ground[i + 1]);
    const hi = Math.max(w.ground[i], w.ground[i + 1]);
    expect(mid).toBeGreaterThanOrEqual(lo - 1e-3);
    expect(mid).toBeLessThanOrEqual(hi + 1e-3);
  });

  it('knows the open sea is ocean, water at sea level, and dry land has none', () => {
    expect(kindAt(w, -w.half + 5, -w.half + 5)).toBe(KIND.ocean);
    expect(waterLevel(w, -w.half + 5, -w.half + 5)).toBe(SEA_LEVEL);
    // The highest point is dry.
    let top = 0;
    for (let i = 1; i < w.ground.length; i++) if (w.ground[i] > w.ground[top]) top = i;
    const x = -w.half + (top % w.n) * w.spacing;
    const z = -w.half + Math.floor(top / w.n) * w.spacing;
    expect(waterLevel(w, x, z)).toBeNull();
    expect(kindAt(w, x, z)).toBe(KIND.land);
  });

  it('works outside the map by holding the edge value', () => {
    expect(Number.isFinite(groundHeight(w, 1e6, -1e6))).toBe(true);
  });
});

describe('the full size world', () => {
  it('builds in a reasonable time', () => {
    const t = performance.now();
    const full = generateWorld(WORLD);
    const ms = performance.now() - t;
    expect(full.n).toBe(WORLD.cells + 1);
    expect(full.stats.landFraction).toBeGreaterThan(0.2);
    expect(ms).toBeLessThan(4000);
  });
});

describe('the desert, the town site and where the player starts', () => {
  const seeds = [1, 2, 3, 4, 5, 6];

  it('levels the ground under the town and keeps it dry', () => {
    for (const seed of seeds) {
      const w = generateWorld(small(seed));
      const { town } = w.settlement;
      expect(town.height).toBeGreaterThan(5);
      expect(Math.abs(town.x)).toBeLessThan(w.half);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        for (const r of [0, 60, 120]) {
          const x = town.x + Math.cos(a) * r;
          const z = town.z + Math.sin(a) * r;
          expect(Math.abs(groundHeight(w, x, z) - town.height)).toBeLessThan(0.01);
        }
        for (const r of [0, 100, 200, 300]) {
          expect(waterLevel(w, town.x + Math.cos(a) * r, town.z + Math.sin(a) * r)).toBeNull();
        }
      }
    }
  });

  it('puts the town in the desert, and the desert is a sensible share of the land', () => {
    for (const seed of seeds) {
      const w = generateWorld(small(seed));
      const { town, spawn } = w.settlement;
      expect(aridityAt(w, town.x, town.z)).toBeGreaterThan(DESERT);
      expect(aridityAt(w, spawn.x, spawn.z)).toBeGreaterThan(DESERT);
      expect(w.stats.desertFraction).toBeGreaterThan(0.04);
      expect(w.stats.desertFraction).toBeLessThan(0.7);
    }
  });

  it('starts the player out in the desert a walk from the town, facing it, on a dry way in', () => {
    for (const seed of seeds) {
      const w = generateWorld(small(seed));
      const { town, spawn } = w.settlement;
      const dist = Math.hypot(town.x - spawn.x, town.z - spawn.z);
      expect(dist).toBeGreaterThan(400);
      expect(dist).toBeLessThan(500);
      // yaw 0 faces +Z and positive turns toward +X, so the forward direction is (sin yaw, cos yaw).
      const dx = (town.x - spawn.x) / dist;
      const dz = (town.z - spawn.z) / dist;
      expect(Math.sin(spawn.yaw) * dx + Math.cos(spawn.yaw) * dz).toBeGreaterThan(0.999);
      expect(waterLevel(w, spawn.x, spawn.z)).toBeNull();
      expect(groundHeight(w, spawn.x, spawn.z)).toBeGreaterThan(1);
      // The way in has no water and no cliffs.
      let prev = groundHeight(w, spawn.x, spawn.z);
      for (let d = 10; d <= dist; d += 10) {
        const x = spawn.x + dx * d;
        const z = spawn.z + dz * d;
        expect(waterLevel(w, x, z)).toBeNull();
        const h = groundHeight(w, x, z);
        expect(Math.abs(h - prev) / 10).toBeLessThan(0.6);
        prev = h;
      }
    }
  });

  it('hides the town from the start behind a dune, but not from the top of it', () => {
    for (const seed of seeds) {
      const w = generateWorld(small(seed));
      const { town, spawn } = w.settlement;
      const eyeAt = (x: number, z: number) => ({ x, z, y: groundHeight(w, x, z) + SIGHT.eye });
      /** True if the ground blocks the straight line from the eye to the roofs at (tx, tz). */
      const blocked = (eye: { x: number; y: number; z: number }, tx: number, tz: number) => {
        const top = town.height + SIGHT.townTop;
        const d = Math.hypot(tx - eye.x, tz - eye.z);
        for (let s = 5; s < d - 120; s += 5) {
          const t = s / d;
          if (groundHeight(w, eye.x + (tx - eye.x) * t, eye.z + (tz - eye.z) * t) > eye.y + (top - eye.y) * t) return true;
        }
        return false;
      };
      // The roofs at the middle and at both sides of the town, as seen from the start.
      const dist = Math.hypot(town.x - spawn.x, town.z - spawn.z);
      const sx = -(town.z - spawn.z) / dist;
      const sz = (town.x - spawn.x) / dist;
      const start = eyeAt(spawn.x, spawn.z);
      for (const side of [-45, 0, 45]) expect(blocked(start, town.x + sx * side, town.z + sz * side)).toBe(true);
      // Somewhere on the way in, the town comes into view.
      let seenOnTheWay = false;
      for (let d = 20; d <= 250 && !seenOnTheWay; d += 10) {
        const t = d / dist;
        const eye = eyeAt(spawn.x + (town.x - spawn.x) * t, spawn.z + (town.z - spawn.z) * t);
        if (!blocked(eye, town.x, town.z)) seenOnTheWay = true;
      }
      expect(seenOnTheWay).toBe(true);
    }
  });

  it('is the same every time for the same seed', () => {
    const a = generateWorld(small(3)).settlement;
    const b = generateWorld(small(3)).settlement;
    expect(a).toEqual(b);
  });
});
