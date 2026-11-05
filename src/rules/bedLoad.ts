import { ITEMS } from '../data/items';
import type { Inventory } from './inventory';
import { CRATE_STACKS } from './bedCapacity';

export interface BedProp {
  look: 'tire' | 'rig_tire' | 'motor' | 'crate';
  count: number;
  rackIndex?: number;
  column?: number;
  level?: number;
}

/** Four mixed tire mounts at the cab; two cargo columns at the tailgate. */
export function bedLoad(inv: Inventory): BedProp[] {
  const props: BedProp[] = [];
  const goods = [];
  let rackIndex = 0, motors = 0;
  for (const slot of inv.slots) {
    if (!slot) continue;
    const look = ITEMS[slot.id].look;
    if (look === 'tire' || look === 'rig_tire') {
      for (let i = 0; i < slot.count; i++) props.push({ look, count: 1, rackIndex: rackIndex++ });
    } else if (look === 'motor') motors += slot.count;
    else goods.push(slot);
  }
  for (let i = 0; i < motors; i++) props.push({ look: 'motor', count: 1, column: i, level: 0 });
  for (let i = 0; i < goods.length; i += CRATE_STACKS) {
    const crate = i / CRATE_STACKS;
    const columns = Math.max(1, 2 - motors);
    props.push({ look: 'crate', count: goods.slice(i, i + CRATE_STACKS).reduce((n, slot) => n + slot.count, 0), column: motors + crate % columns, level: Math.floor(crate / columns) });
  }
  return props;
}
