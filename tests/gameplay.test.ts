import { describe, expect, it } from 'vitest';
import { CONTAINERS } from '../src/data/containers';
import { ITEMS } from '../src/data/items';
import { distanceToObb, pushCircleOutOfBox, pushCircleOutOfObb } from '../src/rules/geometry';
import { exitPosition, findTarget, REACH } from '../src/rules/interaction';
import {
  addItem,
  countItem,
  createInventory,
  describeInventory,
  removeItem,
  usedSlots,
} from '../src/rules/inventory';
import { newContainerState, openContainer, rollLoot } from '../src/rules/loot';
import { makeRandom } from '../src/rules/scatter';
import { boxesOverlap, generateTown, LOT, ROAD } from '../src/rules/town';
import { lookWalker, stepWalker, WALKER, type Walker } from '../src/rules/walker';

describe('data', () => {
  it('only references items that exist', () => {
    for (const def of Object.values(CONTAINERS)) {
      for (const e of def.loot) expect(ITEMS[e.item], `${def.kind} -> ${e.item}`).toBeDefined();
    }
  });
});

describe('inventory', () => {
  it('stacks items and reports what does not fit', () => {
    const inv = createInventory(2);
    expect(addItem(inv, 'canned_beans', 4)).toBe(0);
    expect(addItem(inv, 'canned_beans', 4)).toBe(0); // 6 + 2 across two slots
    expect(countItem(inv, 'canned_beans')).toBe(8);
    expect(usedSlots(inv)).toBe(2);
    expect(addItem(inv, 'canned_beans', 10)).toBe(6); // only 4 more fit (12 total), 6 left over
    expect(addItem(inv, 'wrench', 1)).toBe(1); // no slot left
  });

  it('removes items, and refuses when there are not enough', () => {
    const inv = createInventory();
    addItem(inv, 'scrap_metal', 5);
    expect(removeItem(inv, 'scrap_metal', 9)).toBe(false);
    expect(countItem(inv, 'scrap_metal')).toBe(5);
    expect(removeItem(inv, 'scrap_metal', 5)).toBe(true);
    expect(usedSlots(inv)).toBe(0);
  });

  it('describes what is carried', () => {
    const inv = createInventory();
    expect(describeInventory(inv)).toBe('nothing');
    addItem(inv, 'wrench', 1);
    addItem(inv, 'canned_beans', 3);
    expect(describeInventory(inv)).toBe('1 wrench, 3 canned beans');
  });

  it('rejects unknown items', () => {
    expect(() => addItem(createInventory(), 'unobtainium', 1)).toThrow();
  });
});

describe('loot', () => {
  it('rolls the same loot for the same seed', () => {
    const a = rollLoot(CONTAINERS.crate, makeRandom(9));
    const b = rollLoot(CONTAINERS.crate, makeRandom(9));
    expect(a).toEqual(b);
  });

  it('stays within the rolls and counts the table allows', () => {
    for (let s = 0; s < 200; s++) {
      const def = CONTAINERS.toolbox;
      const found = rollLoot(def, makeRandom(s));
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.length).toBeLessThanOrEqual(def.rolls[1]);
      for (const f of found) expect(def.loot.some((e) => e.item === f.id)).toBe(true);
    }
  });

  it('gives each kind a different feel: dumpsters are mostly scrap', () => {
    let scrap = 0;
    let total = 0;
    for (let s = 0; s < 300; s++) {
      for (const f of rollLoot(CONTAINERS.dumpster, makeRandom(s))) {
        total += f.count;
        if (f.id === 'scrap_metal') scrap += f.count;
      }
    }
    expect(scrap / total).toBeGreaterThan(0.6);
  });

  it('moves loot into the inventory, once', () => {
    const inv = createInventory();
    const state = newContainerState('crate');
    const first = openContainer(state, 1, 4, inv);
    expect(first.taken.length).toBeGreaterThan(0);
    expect(first.leftBehind).toBe(false);
    const carried = describeInventory(inv);
    const second = openContainer(state, 1, 4, inv);
    expect(second.wasEmpty).toBe(true);
    expect(describeInventory(inv)).toBe(carried); // nothing new appears
  });

  it('is the same loot for the same container id on every run', () => {
    const a = createInventory();
    const b = createInventory();
    openContainer(newContainerState('locker'), 3, 11, a);
    openContainer(newContainerState('locker'), 3, 11, b);
    expect(describeInventory(a)).toBe(describeInventory(b));
  });

  it('leaves what does not fit inside the container', () => {
    const inv = createInventory(1);
    addItem(inv, 'wrench', 1); // the only slot is taken
    const state = newContainerState('crate');
    const result = openContainer(state, 1, 2, inv);
    expect(result.taken).toEqual([]);
    expect(result.leftBehind).toBe(true);
    expect(state.contents.length).toBeGreaterThan(0);
    removeItem(inv, 'wrench', 1);
    const again = openContainer(state, 1, 2, inv);
    expect(again.taken.length).toBeGreaterThan(0);
  });
});

describe('town', () => {
  const town = generateTown(1);

  it('is reproducible', () => {
    expect(generateTown(1)).toEqual(town);
    expect(generateTown(2)).not.toEqual(town);
  });

  it('has several buildings and containers', () => {
    expect(town.buildings.length).toBeGreaterThanOrEqual(5);
    expect(town.containers.length).toBeGreaterThanOrEqual(town.buildings.length);
  });

  it('keeps buildings off the streets and clear of each other', () => {
    for (const b of town.buildings) {
      for (const rx of town.roadsX) expect(Math.abs(b.x - rx) - b.hx).toBeGreaterThan(ROAD / 2);
      for (const rz of town.roadsZ) expect(Math.abs(b.z - rz) - b.hz).toBeGreaterThan(ROAD / 2);
    }
    for (const a of town.buildings) {
      for (const b of town.buildings) if (a !== b) expect(boxesOverlap(a, b)).toBe(false);
    }
  });

  it('keeps containers off the streets, out of walls and apart', () => {
    for (const c of town.containers) {
      for (const b of town.buildings) expect(boxesOverlap(c, b)).toBe(false);
      for (const rx of town.roadsX) expect(Math.abs(c.x - rx) - c.hx).toBeGreaterThan(ROAD / 2 - 0.01);
      for (const rz of town.roadsZ) expect(Math.abs(c.z - rz) - c.hz).toBeGreaterThan(ROAD / 2 - 0.01);
    }
    for (const a of town.containers) {
      for (const b of town.containers) if (a !== b) expect(boxesOverlap(a, b)).toBe(false);
    }
  });

  it('parks the truck on a street, clear of buildings, with the player a short walk away', () => {
    const { carSpawn, playerSpawn } = town;
    expect(Math.abs(carSpawn.z - town.roadsZ[0])).toBeLessThan(1);
    for (const b of town.buildings) {
      expect(boxesOverlap({ x: carSpawn.x, z: carSpawn.z, hx: 2.4, hz: 2.4 }, b)).toBe(false);
    }
    const walk = Math.hypot(playerSpawn.x - carSpawn.x, playerSpawn.z - carSpawn.z);
    expect(walk).toBeGreaterThan(5);
    expect(walk).toBeLessThan(40);
    expect(LOT).toBe(28);
  });
});

describe('walking', () => {
  const start = (): Walker => ({ x: 0, z: 0, yaw: 0, pitch: 0 });
  const none: never[] = [];

  it('moves forward along the way it faces, and right toward -X when facing +Z', () => {
    const w = start();
    stepWalker(w, { forward: 1, right: 0, run: false }, 1, none, none);
    expect(w.z).toBeCloseTo(WALKER.walkSpeed);
    expect(w.x).toBeCloseTo(0);
    const r = start();
    stepWalker(r, { forward: 0, right: 1, run: false }, 1, none, none);
    expect(r.x).toBeCloseTo(-WALKER.walkSpeed);
  });

  it('turns with yaw: facing +X, forward goes to +X', () => {
    const w: Walker = { x: 0, z: 0, yaw: Math.PI / 2, pitch: 0 };
    stepWalker(w, { forward: 1, right: 0, run: false }, 1, none, none);
    expect(w.x).toBeCloseTo(WALKER.walkSpeed);
    expect(w.z).toBeCloseTo(0);
  });

  it('is not faster on a diagonal, and runs faster than it walks', () => {
    const d = start();
    stepWalker(d, { forward: 1, right: 1, run: false }, 1, none, none);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(WALKER.walkSpeed);
    const r = start();
    stepWalker(r, { forward: 1, right: 0, run: true }, 1, none, none);
    expect(r.z).toBeCloseTo(WALKER.runSpeed);
  });

  it('cannot walk through a wall but slides along it', () => {
    const wall = { x: 5, z: 0, hx: 0.5, hz: 20 };
    const w: Walker = { x: 0, z: 0, yaw: Math.PI / 4, pitch: 0 }; // heading up and to the right of the wall
    for (let i = 0; i < 120; i++) stepWalker(w, { forward: 1, right: 0, run: false }, 1 / 60, [wall], none);
    expect(w.x).toBeLessThanOrEqual(5 - 0.5 - WALKER.radius + 1e-6);
    expect(w.z).toBeGreaterThan(3); // kept moving along the wall
  });

  it('looks: mouse right turns right, mouse down looks down, and the pitch is limited', () => {
    const w = start();
    lookWalker(w, 100, 0, 0.01);
    expect(w.yaw).toBeLessThan(0);
    lookWalker(w, 0, 100, 0.01);
    expect(w.pitch).toBeLessThan(0);
    lookWalker(w, 0, -10000, 0.01);
    expect(w.pitch).toBe(WALKER.maxPitch);
  });

  it('is pushed out of boxes and out of a turned truck', () => {
    expect(pushCircleOutOfBox(0.2, 0, 0.4, { x: 0, z: 0, hx: 1, hz: 1 })[0]).toBeCloseTo(1.4);
    const truck = { x: 10, z: 10, hx: 0.95, hz: 2.4, yaw: Math.PI / 2 };
    // Turned a quarter, the long side lies along X: 2.4 m either side in X, 0.95 m in Z.
    const [x, z] = pushCircleOutOfObb(10, 10 + 0.5, 0.4, truck);
    expect(z).toBeCloseTo(10 + 0.95 + 0.4);
    expect(x).toBeCloseTo(10);
    expect(distanceToObb(10 + 2.4 + 1, 10, truck)).toBeCloseTo(1);
  });
});

describe('interaction', () => {
  const crate = { id: 3, x: 0, z: 5, hx: 0.6, hz: 0.6 };
  const none = { containers: [crate], truck: null };

  it('picks what is in reach and in view', () => {
    const w: Walker = { x: 0, z: 5 - 0.6 - 1.5, yaw: 0, pitch: 0 }; // 1.5 m in front of it, facing it
    expect(findTarget(w, none)).toEqual({ kind: 'container', id: 3 });
  });

  it('ignores things that are too far or behind you', () => {
    expect(findTarget({ x: 0, z: 0, yaw: 0, pitch: 0 }, none)).toBeNull(); // 4.4 m away
    expect(findTarget({ x: 0, z: 3.2, yaw: Math.PI, pitch: 0 }, none)).toBeNull(); // close but facing away
  });

  it('lets you use what you are touching even if looking elsewhere', () => {
    expect(findTarget({ x: 0, z: 5 - 0.6 - 0.3, yaw: Math.PI, pitch: 0 }, none)).toEqual({ kind: 'container', id: 3 });
  });

  it('prefers the nearer of two, and finds the truck', () => {
    const w: Walker = { x: 0, z: 3, yaw: 0, pitch: 0 };
    const truck = { x: 0, z: 7.4, hx: 0.95, hz: 2.4, yaw: 0 }; // its near end is 2 m away, the crate is 1.4 m
    const t = findTarget(w, { containers: [crate], truck });
    expect(t).toEqual({ kind: 'container', id: 3 });
    expect(findTarget({ x: 0, z: 0, yaw: 0, pitch: 0 }, { containers: [], truck: { ...truck, z: 3.5 } })).toEqual({ kind: 'truck' });
    expect(REACH).toBeGreaterThan(1);
  });

  it('steps out on the left of the truck, clear of it', () => {
    const north = exitPosition({ x: 0, z: 0, hx: 0.95, hz: 2.4, yaw: 0 });
    expect(north.x).toBeGreaterThan(1.5); // facing +Z, left is +X
    expect(north.z).toBeCloseTo(0);
    const east = exitPosition({ x: 0, z: 0, hx: 0.95, hz: 2.4, yaw: Math.PI / 2 }); // facing +X, left is -Z...
    expect(east.z).toBeLessThan(-1.5);
    expect(distanceToObb(east.x, east.z, { x: 0, z: 0, hx: 0.95, hz: 2.4, yaw: Math.PI / 2 })).toBeGreaterThan(WALKER.radius);
  });
});

describe('the town can be walked', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: every container can be reached on foot from where the player starts`, () => {
      const town = generateTown(seed);
      const solids = [...town.buildings, ...town.containers];
      const step = 0.5;
      const x0 = town.center.x - 70;
      const z0 = town.center.z - 80; // starts south of the town so the player spawn is inside
      const n = Math.round(140 / step);
      const blocked = (x: number, z: number) =>
        solids.some((s) => Math.abs(x - s.x) < s.hx + WALKER.radius && Math.abs(z - s.z) < s.hz + WALKER.radius);
      const seen = new Set<number>();
      const key = (i: number, j: number) => i * (n + 1) + j;
      const si = Math.round((town.playerSpawn.x - x0) / step);
      const sj = Math.round((town.playerSpawn.z - z0) / step);
      const queue: [number, number][] = [[si, sj]];
      seen.add(key(si, sj));
      while (queue.length) {
        const [i, j] = queue.pop()!;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a > n || b > n || seen.has(key(a, b))) continue;
          if (blocked(x0 + a * step, z0 + b * step)) continue;
          seen.add(key(a, b));
          queue.push([a, b]);
        }
      }
      const reachable = (x: number, z: number) => seen.has(key(Math.round((x - x0) / step), Math.round((z - z0) / step)));
      // Every container needs a walkable spot within reach of its surface.
      for (const c of town.containers) {
        let ok = false;
        for (let a = -8; a <= 8 && !ok; a++) {
          for (let b = -8; b <= 8 && !ok; b++) {
            const px = c.x + a * step;
            const pz = c.z + b * step;
            if (!reachable(px, pz)) continue;
            const w: Walker = { x: px, z: pz, yaw: Math.atan2(c.x - px, c.z - pz), pitch: 0 };
            if (findTarget(w, { containers: [c], truck: null })) ok = true;
          }
        }
        expect(ok, `container ${c.id} (${c.kind}) at ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`).toBe(true);
      }
      // And the truck's parking spot is reachable too.
      expect(reachable(town.carSpawn.x, town.carSpawn.z - 4)).toBe(true);
    });
  }
});
