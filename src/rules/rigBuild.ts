import { countItem, removeItem, type Inventory } from './inventory';
import { localBox, type Town } from './town';

export function rigSpawns(towns: Town[]) {
  return towns.flatMap(town => {
    if (!town.salvage) return [];
    const { yard, yaw } = town.salvage;
    return yard.wrecks.filter(w => w.model === 'big-rig').map(w => ({
      ...localBox(town.center.x, town.center.z, yaw, w.x, w.z, w.hx, w.hz),
      yaw: yaw + (w.turned ? Math.PI / 2 : 0),
    }));
  }).map((spawn, i) => ({ ...spawn, kind: (i === 1 ? 'box-truck' : 'tractor') as RigKind }));
}

export const RIG_PARTS = { rig_engine: 1, rig_transmission: 1, rig_battery: 1, rig_fuel_tank: 1, rig_steering: 1, rig_tire: 10 } as const;
export const BOX_REPAIR_PARTS = {
  truck_radiator: 1, truck_brakes: 4, truck_exhaust: 1,
  truck_dash: 1, truck_seat: 2, truck_windshield: 1,
  truck_driver_door: 1, truck_passenger_door: 1, truck_hood: 1,
  truck_grille: 1, truck_headlight: 2, truck_front_bumper: 1, truck_rear_bumper: 1,
  truck_box_floor: 1, truck_box_panel: 4, truck_box_roof: 1, truck_box_door: 2,
} as const;
export const BOX_TRUCK = { frontAxle: 3.05, rearAxle: -2, wheelRadius: .49, wheelX: 1.04, offset: 2.1 } as const;
export type RigKind = 'tractor' | 'box-truck';
export type RigPart = keyof typeof RIG_PARTS | keyof typeof BOX_REPAIR_PARTS;
export type RigBuild = Record<RigPart, number>;
export const rigParts = Object.keys(RIG_PARTS) as (keyof typeof RIG_PARTS)[];
export const boxRepairParts = Object.keys(BOX_REPAIR_PARTS) as (keyof typeof BOX_REPAIR_PARTS)[];
export const rigRequirements = (kind: RigKind): Partial<Record<RigPart, number>> =>
  kind === 'box-truck' ? { ...RIG_PARTS, rig_tire: 6, ...BOX_REPAIR_PARTS } : RIG_PARTS;
export const partsForRig = (kind: RigKind): RigPart[] => kind === 'box-truck' ? [...rigParts, ...boxRepairParts] : rigParts;
export const rigLabel = (kind: RigKind) => kind === 'box-truck' ? 'box truck' : 'big rig';
export const createRigBuild = (): RigBuild => Object.fromEntries([...rigParts, ...boxRepairParts].map(id => [id, 0])) as RigBuild;
export const rigComplete = (build: RigBuild, kind: RigKind = 'tractor') =>
  partsForRig(kind).every(id => build[id] >= (rigRequirements(kind)[id] ?? 0));
const BOX_AFTER: Partial<Record<RigPart, RigPart[]>> = {
  rig_battery: ['rig_engine'], rig_steering: ['truck_dash'],
  truck_radiator: ['rig_engine'], truck_windshield: ['truck_dash'],
  truck_driver_door: ['truck_dash', 'truck_seat'], truck_passenger_door: ['truck_dash', 'truck_seat'],
  truck_grille: ['rig_engine', 'truck_radiator'], truck_headlight: ['truck_grille'],
  truck_box_panel: ['truck_box_floor'], truck_box_roof: ['truck_box_panel'], truck_box_door: ['truck_box_panel'],
};

/** Consumes actual cargo, only with a wrench. Nearby vehicle storage may supply parts. */
export function fitRigPart(build: RigBuild, id: RigPart, pack: Inventory, cargo?: Inventory, kind: RigKind = 'tractor'): { ok: boolean; message: string } {
  const requirements = rigRequirements(kind), required = requirements[id];
  if (!required) return { ok: false, message: 'This part does not fit this vehicle.' };
  if (!countItem(pack, 'wrench')) return { ok: false, message: 'Carry a wrench to fit parts.' };
  if (build[id] >= required) return { ok: false, message: 'Already fully installed.' };
  if (kind === 'box-truck') {
    const missing = (BOX_AFTER[id] ?? []).filter(part => build[part] < (requirements[part] ?? 0));
    if (missing.length) return { ok: false, message: `Fit these first: ${missing.map(part => part.replace(/^truck_|^rig_/, '').replaceAll('_', ' ')).join(', ')}.` };
  }
  const source = countItem(pack, id) ? pack : cargo && countItem(cargo, id) ? cargo : null;
  if (!source) return { ok: false, message: 'Bring this part in your pack or park the El Cajon within 8 m.' };
  removeItem(source, id, 1); build[id]++;
  return { ok: true, message: rigComplete(build, kind) ? 'Restoration complete. Ready to drive.' : 'Part installed.' };
}

/** Guaranteed full build, spread across outside containers in different settlements. */
export function distributeRigParts(towns: Town[]) {
  const start = towns[0].center;
  const sites = towns.slice(1).filter(t => t.containers.some(c => ['crate','toolbox','locker'].includes(c.kind)))
    .filter(t => Math.hypot(t.center.x - start.x, t.center.z - start.z) > 150)
    .sort((a,b) => Math.atan2(a.center.z-start.z,a.center.x-start.x) - Math.atan2(b.center.z-start.z,b.center.x-start.x));
  const available = sites.length ? sites : towns.filter(t => t.containers.length);
  const hints: { item: RigPart; x: number; z: number }[] = [];
  const vehicles: RigKind[] = rigSpawns(towns).map(spawn => spawn.kind);
  if (!vehicles.length) vehicles.push('tractor');
  const parts = vehicles.flatMap(kind => partsForRig(kind).flatMap(id =>
    Array.from({ length: rigRequirements(kind)[id] ?? 0 }, () => id)));
  parts.forEach((id, i) => {
    const site = available[Math.floor(i * available.length / parts.length) % available.length];
    if (!site) return;
    const options = site.containers.filter(c => ['crate','toolbox','locker'].includes(c.kind));
    const container = (options.length ? options : site.containers)[i % (options.length || site.containers.length)];
    container.fixedLoot = [...(container.fixedLoot ?? [{ id: 'scrap_metal', count: 3 }]), { id, count: 1 }];
    hints.push({ item: id, x: container.x, z: container.z });
  });
  return hints;
}
