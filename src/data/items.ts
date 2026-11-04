// Content as data: every item in the game is a row here. Adding an item never needs new code.

export type ItemKind = 'food' | 'drink' | 'material' | 'tool' | 'medical' | 'part';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** How many fit in one inventory slot. */
  stack: number;
  /** Eating or drinking this restores this much of the hunger or thirst bar (0 to 100 scale). */
  restores?: number;
  /** Big things are drawn as themselves when they lie in the truck bed. Everything else shows as small goods or in a supply crate. */
  look?: 'tire' | 'motor' | 'rig_tire';
}

export const ITEMS: Record<string, ItemDef> = {
  canned_beans: { id: 'canned_beans', name: 'canned beans', kind: 'food', stack: 6, restores: 35 },
  crackers: { id: 'crackers', name: 'crackers', kind: 'food', stack: 6, restores: 15 },
  water_bottle: { id: 'water_bottle', name: 'water bottle', kind: 'drink', stack: 4, restores: 40 },
  jerky: { id: 'jerky', name: 'jerky', kind: 'food', stack: 8, restores: 20 },
  soda: { id: 'soda', name: 'soda', kind: 'drink', stack: 6, restores: 25 },
  scrap_metal: { id: 'scrap_metal', name: 'scrap metal', kind: 'material', stack: 20 },
  duct_tape: { id: 'duct_tape', name: 'duct tape', kind: 'material', stack: 5 },
  rope: { id: 'rope', name: 'rope', kind: 'material', stack: 5 },
  batteries: { id: 'batteries', name: 'batteries', kind: 'material', stack: 8 },
  wrench: { id: 'wrench', name: 'wrench', kind: 'tool', stack: 1 },
  tire: { id: 'tire', name: 'tire', kind: 'part', stack: 4, look: 'tire' },
  rig_tire: { id: 'rig_tire', name: 'big rig tire', kind: 'part', stack: 1, look: 'rig_tire' },
  motor: { id: 'motor', name: 'motor', kind: 'part', stack: 1, look: 'motor' },
  bandage: { id: 'bandage', name: 'bandage', kind: 'medical', stack: 5 },
};
