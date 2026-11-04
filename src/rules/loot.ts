import { CONTAINERS, type ContainerDef, type ContainerKind } from '../data/containers';
import { ITEMS } from '../data/items';
import { addItem, type Inventory, type ItemStack } from './inventory';
import { makeRandom } from './scatter';

/** Rolls what a container holds. The same seed and container give the same contents every time. */
export function rollLoot(def: ContainerDef, rand: () => number): ItemStack[] {
  const [minRolls, maxRolls] = def.rolls;
  const rolls = minRolls + Math.floor(rand() * (maxRolls - minRolls + 1));
  const totalWeight = def.loot.reduce((s, e) => s + e.weight, 0);
  const found: ItemStack[] = [];
  for (let i = 0; i < rolls; i++) {
    let pick = rand() * totalWeight;
    const entry = def.loot.find((e) => (pick -= e.weight) < 0) ?? def.loot[def.loot.length - 1];
    const count = entry.min + Math.floor(rand() * (entry.max - entry.min + 1));
    const existing = found.find((f) => f.id === entry.item);
    if (existing) existing.count += count;
    else found.push({ id: entry.item, count });
  }
  return found;
}

export interface ContainerState {
  kind: ContainerKind;
  opened: boolean;
  contents: ItemStack[];
  /** Contents set by the world rather than rolled, such as the junkyard's wrench. */
  fixed?: ItemStack[];
}

export function newContainerState(kind: ContainerKind, fixed?: ItemStack[]): ContainerState {
  return { kind, opened: false, contents: [], fixed };
}

export interface OpenResult {
  /** What went into the inventory. */
  taken: ItemStack[];
  /** True if something is still inside because the inventory was full. */
  leftBehind: boolean;
  /** True if the container was empty to begin with. */
  wasEmpty: boolean;
}

/** Opens a container, rolling its loot the first time, and moves what fits into the inventory. */
export function openContainer(state: ContainerState, seed: number, containerId: number, inv: Inventory): OpenResult {
  if (!state.opened) {
    state.opened = true;
    state.contents = state.fixed
      ? state.fixed.map((s) => ({ ...s }))
      : rollLoot(CONTAINERS[state.kind], makeRandom(Math.imul(seed, 7919) ^ Math.imul(containerId + 1, 104729)));
  }
  const wasEmpty = state.contents.length === 0;
  const taken: ItemStack[] = [];
  const remaining: ItemStack[] = [];
  for (const stack of state.contents) {
    const notFit = addItem(inv, stack.id, stack.count);
    const took = stack.count - notFit;
    if (took > 0) taken.push({ id: stack.id, count: took });
    if (notFit > 0) remaining.push({ id: stack.id, count: notFit });
  }
  state.contents = remaining;
  return { taken, leftBehind: remaining.length > 0, wasEmpty };
}

export function describeStacks(stacks: ItemStack[]): string {
  return stacks.map((s) => `${s.count} ${ITEMS[s.id].name}`).join(', ');
}
