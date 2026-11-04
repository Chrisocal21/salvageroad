import { countItem, type Inventory } from './inventory';

// The El Cajon is found stripped in the junkyard: the shell sits on blocks and its parts lie around the yard.
// The player carries the parts to it one at a time and bolts them on. When every part is on, it can be driven.
// Plain rules, no rendering.

export type PartKind =
  | 'engine'
  | 'battery'
  | 'hood'
  | 'tailgate'
  | 'front_bumper'
  | 'rear_bumper'
  | 'seat'
  | 'wheel'
  | 'dash'
  | 'steering_wheel'
  | 'windshield'
  | 'driver_door'
  | 'passenger_door'
  | 'grille'
  | 'headlights';

export interface PartDef {
  kind: PartKind;
  name: string;
  /** How many of this part the truck takes. */
  count: number;
  /** Parts that must already be on before this one goes on. */
  after: PartKind[];
}

/** In the order a mechanic would think of them. */
export const PARTS: Record<PartKind, PartDef> = {
  engine: { kind: 'engine', name: 'engine', count: 1, after: [] },
  battery: { kind: 'battery', name: 'battery', count: 1, after: ['engine'] },
  hood: { kind: 'hood', name: 'hood', count: 1, after: [] }, // it can go on first: it opens, so the engine can still go in
  wheel: { kind: 'wheel', name: 'wheel', count: 4, after: [] },
  seat: { kind: 'seat', name: 'bench seat', count: 1, after: [] },
  front_bumper: { kind: 'front_bumper', name: 'front bumper', count: 1, after: [] },
  rear_bumper: { kind: 'rear_bumper', name: 'rear bumper', count: 1, after: [] },
  tailgate: { kind: 'tailgate', name: 'tailgate', count: 1, after: [] },
  // The inside goes in before the glass and the doors.
  dash: { kind: 'dash', name: 'dashboard', count: 1, after: [] },
  steering_wheel: { kind: 'steering_wheel', name: 'steering wheel', count: 1, after: ['dash'] },
  windshield: { kind: 'windshield', name: 'windshield', count: 1, after: ['dash'] },
  driver_door: { kind: 'driver_door', name: "driver's door", count: 1, after: ['dash', 'seat'] },
  passenger_door: { kind: 'passenger_door', name: 'passenger door', count: 1, after: ['dash', 'seat'] },
  grille: { kind: 'grille', name: 'grille', count: 1, after: ['engine'] },
  headlights: { kind: 'headlights', name: 'headlights', count: 1, after: ['grille'] },
};
export const PART_KINDS = Object.keys(PARTS) as PartKind[];

/** These sit under the hood, so with the hood on it has to be open to get at them. */
export const UNDER_HOOD: PartKind[] = ['engine', 'battery'];

/** Bolting a part on needs this tool in the inventory. */
export const FIT_TOOL = 'wrench';

/** How many of each part are on the truck. */
export type CarBuild = Record<PartKind, number>;

export function createCarBuild(fitted: Partial<CarBuild> = {}): CarBuild {
  const build = {} as CarBuild;
  for (const kind of PART_KINDS) build[kind] = fitted[kind] ?? 0;
  return build;
}

/** A truck with every part on. */
export function completeCarBuild(): CarBuild {
  const build = {} as CarBuild;
  for (const kind of PART_KINDS) build[kind] = PARTS[kind].count;
  return build;
}

export function isComplete(build: CarBuild): boolean {
  return PART_KINDS.every((k) => build[k] >= PARTS[k].count);
}

/** What is still missing, such as "engine, battery, 3 wheels". Empty when complete. */
export function describeMissing(build: CarBuild): string {
  return PART_KINDS.filter((k) => build[k] < PARTS[k].count)
    .map((k) => {
      const left = PARTS[k].count - build[k];
      return left > 1 ? `${left} ${PARTS[k].name}s` : PARTS[k].name;
    })
    .join(', ');
}

export type FitCheck = { ok: true } | { ok: false; reason: string };

/** Can this part go on now? Needs the tool, room for the part, and the parts it goes after. */
export function checkFit(build: CarBuild, kind: PartKind, inventory: Inventory, hoodOpen = true): FitCheck {
  const def = PARTS[kind];
  if (build[kind] >= def.count) return { ok: false, reason: `The El Cajon already has its ${def.name}${def.count > 1 ? 's' : ''}` };
  const before = def.after.filter((k) => build[k] < PARTS[k].count);
  if (before.length > 0) return { ok: false, reason: `The ${before.map((k) => PARTS[k].name).join(' and ')} must go in before the ${def.name}` };
  if (UNDER_HOOD.includes(kind) && build.hood > 0 && !hoodOpen) return { ok: false, reason: `Open the hood first to get at the ${def.name}` };
  if (countItem(inventory, FIT_TOOL) < 1) return { ok: false, reason: `You need a ${FIT_TOOL} to bolt the ${def.name} on` };
  return { ok: true };
}

/** Bolts a part on if it can go on. Returns the check, so a refusal can be shown to the player. */
export function fitPart(build: CarBuild, kind: PartKind, inventory: Inventory, hoodOpen = true): FitCheck {
  const check = checkFit(build, kind, inventory, hoodOpen);
  if (check.ok) build[kind]++;
  return check;
}
