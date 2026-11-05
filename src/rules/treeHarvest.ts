import { addItem, countItem, type Inventory } from './inventory';

export interface HarvestTree { x: number; z: number; hits: number; cut: boolean }
export const TREE_HITS = 3;
export const TREE_LOGS = 4;

export function chopTree(tree: HarvestTree, inventory: Inventory): { ok: boolean; felled: boolean; message: string } {
  if (tree.cut) return { ok: false, felled: false, message: 'This tree has already been chopped' };
  if (!countItem(inventory, 'axe')) return { ok: false, felled: false, message: 'Carry an axe to chop this tree' };
  if (tree.hits + 1 < TREE_HITS) {
    tree.hits++;
    return { ok: true, felled: false, message: `Chop ${tree.hits}/${TREE_HITS}` };
  }
  const trial: Inventory = { slots: inventory.slots.map(s => s ? { ...s } : null) };
  if (addItem(trial, 'log', TREE_LOGS)) return { ok: false, felled: false, message: 'Make room for 4 logs before felling this tree' };
  inventory.slots.splice(0, inventory.slots.length, ...trial.slots);
  tree.hits = TREE_HITS;
  tree.cut = true;
  return { ok: true, felled: true, message: 'Tree felled: collected 4 logs' };
}
