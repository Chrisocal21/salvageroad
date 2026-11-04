import { ITEMS, type ItemKind } from '../data/items';
import type { Inventory } from './inventory';

// What the truck bed looks like for what is stored in it. Big things show as themselves (motors, tires).
// Small goods show as a few loose items; once there are enough different kinds they go into a supply crate.

export type BedLook = 'tire' | 'motor' | 'rig_tire' | 'crate' | ItemKind;

export interface BedProp {
  look: BedLook;
  /** Tires: how many are stacked. Crate and small goods: how many items it stands for. */
  count: number;
  /** How many places on the bed floor it takes. Only the big rig tire takes more than one. */
  spots?: number;
}

/** Places on the bed floor. Anything past this is stored but not drawn. */
export const BED_SPOTS = 6;
/** This many different small things or more are shown as one supply crate. */
export const CRATE_FROM = 4;
export const TIRES_PER_STACK = 3;

export function bedLoad(inv: Inventory): BedProp[] {
  let rigTires = 0;
  let motors = 0;
  let tires = 0;
  const small: { kind: ItemKind; count: number }[] = [];
  for (const slot of inv.slots) {
    if (!slot) continue;
    const def = ITEMS[slot.id];
    if (def.look === 'rig_tire') rigTires += slot.count;
    else if (def.look === 'motor') motors += slot.count;
    else if (def.look === 'tire') tires += slot.count;
    else small.push({ kind: def.kind, count: slot.count });
  }
  const props: BedProp[] = [];
  for (let i = 0; i < rigTires; i++) props.push({ look: 'rig_tire', count: 1, spots: 2 });
  for (let i = 0; i < motors; i++) props.push({ look: 'motor', count: 1 });
  for (let left = tires; left > 0; left -= TIRES_PER_STACK) props.push({ look: 'tire', count: Math.min(left, TIRES_PER_STACK) });
  if (small.length >= CRATE_FROM) props.push({ look: 'crate', count: small.reduce((s, x) => s + x.count, 0) });
  else for (const s of small) props.push({ look: s.kind, count: s.count });
  // Draw what fits: a big rig tire takes a whole row of two places.
  const shown: BedProp[] = [];
  let used = 0;
  for (const prop of props) {
    const span = prop.spots ?? 1;
    if (span === 2 && used % 2 === 1) used++; // a rig tire starts a new row
    if (used + span > BED_SPOTS) break;
    shown.push(prop);
    used += span;
  }
  return shown;
}
