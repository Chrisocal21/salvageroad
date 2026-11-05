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
  placeable?: 'basicbench' | 'workbench';
}

export const ITEMS: Record<string, ItemDef> = {
  canned_beans: { id: 'canned_beans', name: 'canned beans', kind: 'food', stack: 6, restores: 35 },
  crackers: { id: 'crackers', name: 'crackers', kind: 'food', stack: 6, restores: 15 },
  water_bottle: { id: 'water_bottle', name: 'water bottle', kind: 'drink', stack: 4, restores: 40 },
  jerky: { id: 'jerky', name: 'jerky', kind: 'food', stack: 8, restores: 20 },
  soda: { id: 'soda', name: 'soda', kind: 'drink', stack: 6, restores: 25 },
  scrap_metal: { id: 'scrap_metal', name: 'scrap metal', kind: 'material', stack: 20 },
  wood: { id: 'wood', name: 'wood planks', kind: 'material', stack: 40 },
  log: { id: 'log', name: 'log', kind: 'material', stack: 20 },
  axe: { id: 'axe', name: 'axe', kind: 'tool', stack: 1 },
  planer: { id: 'planer', name: 'planer', kind: 'tool', stack: 1, placeable: 'workbench' },
  basic_bench: { id: 'basic_bench', name: 'portable toolbox bench', kind: 'tool', stack: 1, placeable: 'basicbench' },
  build_hammer: { id: 'build_hammer', name: 'build hammer', kind: 'tool', stack: 1 },
  duct_tape: { id: 'duct_tape', name: 'duct tape', kind: 'material', stack: 5 },
  rope: { id: 'rope', name: 'rope', kind: 'material', stack: 5 },
  batteries: { id: 'batteries', name: 'batteries', kind: 'material', stack: 8 },
  wrench: { id: 'wrench', name: 'wrench', kind: 'tool', stack: 1 },
  tire: { id: 'tire', name: 'tire', kind: 'part', stack: 4, look: 'tire' },
  rig_tire: { id: 'rig_tire', name: 'big rig tire', kind: 'part', stack: 1, look: 'rig_tire' },
  rig_engine: { id: 'rig_engine', name: 'big rig diesel engine', kind: 'part', stack: 1, look: 'motor' },
  rig_transmission: { id: 'rig_transmission', name: 'big rig transmission', kind: 'part', stack: 1, look: 'motor' },
  rig_battery: { id: 'rig_battery', name: 'big rig starter battery', kind: 'part', stack: 1 },
  rig_fuel_tank: { id: 'rig_fuel_tank', name: 'big rig fuel tank', kind: 'part', stack: 1 },
  rig_steering: { id: 'rig_steering', name: 'big rig steering assembly', kind: 'part', stack: 1 },
  truck_radiator: { id: 'truck_radiator', name: 'truck radiator', kind: 'part', stack: 1 },
  truck_brakes: { id: 'truck_brakes', name: 'truck brake assembly', kind: 'part', stack: 1 },
  truck_exhaust: { id: 'truck_exhaust', name: 'truck exhaust', kind: 'part', stack: 1 },
  truck_dash: { id: 'truck_dash', name: 'truck dashboard', kind: 'part', stack: 1 },
  truck_seat: { id: 'truck_seat', name: 'truck seat', kind: 'part', stack: 1 },
  truck_windshield: { id: 'truck_windshield', name: 'truck windshield', kind: 'part', stack: 1 },
  truck_driver_door: { id: 'truck_driver_door', name: 'truck driver door', kind: 'part', stack: 1 },
  truck_passenger_door: { id: 'truck_passenger_door', name: 'truck passenger door', kind: 'part', stack: 1 },
  truck_hood: { id: 'truck_hood', name: 'truck hood', kind: 'part', stack: 1 },
  truck_grille: { id: 'truck_grille', name: 'truck grille', kind: 'part', stack: 1 },
  truck_headlight: { id: 'truck_headlight', name: 'truck headlight', kind: 'part', stack: 1 },
  truck_front_bumper: { id: 'truck_front_bumper', name: 'truck front bumper', kind: 'part', stack: 1 },
  truck_rear_bumper: { id: 'truck_rear_bumper', name: 'truck rear bumper', kind: 'part', stack: 1 },
  truck_box_floor: { id: 'truck_box_floor', name: 'cargo box floor', kind: 'part', stack: 1 },
  truck_box_panel: { id: 'truck_box_panel', name: 'cargo box wall panel', kind: 'part', stack: 1 },
  truck_box_roof: { id: 'truck_box_roof', name: 'cargo box roof', kind: 'part', stack: 1 },
  truck_box_door: { id: 'truck_box_door', name: 'cargo box rear door', kind: 'part', stack: 1 },
  motor: { id: 'motor', name: 'motor', kind: 'part', stack: 1, look: 'motor' },
  bandage: { id: 'bandage', name: 'bandage', kind: 'medical', stack: 5 },
};
