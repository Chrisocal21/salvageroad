import type { Obb2 } from './geometry';

// Which part of the truck the player is standing at. Each part does something different:
// the hood opens, the doors get you in (the driver's door to drive, the other to ride), the bed opens the storage.

export type TruckZone = 'hood' | 'driver_door' | 'passenger_door' | 'bed';

// Along the truck, as a share of its half length (+ is the front). The El Cajon's hood runs from the
// windshield to the nose, the doors sit under the cab, the bed is behind the doors.
export const HOOD_FROM = 0.4;
export const BED_UNTIL = -0.15;

export function truckZone(truck: Obb2, x: number, z: number): TruckZone {
  const dx = x - truck.x;
  const dz = z - truck.z;
  const along = (dx * Math.sin(truck.yaw) + dz * Math.cos(truck.yaw)) / truck.hz; // + toward the front
  const left = dx * Math.cos(truck.yaw) - dz * Math.sin(truck.yaw); // + is the driver's side (left)
  if (along > HOOD_FROM) return 'hood';
  if (along < BED_UNTIL) return 'bed';
  return left >= 0 ? 'driver_door' : 'passenger_door';
}
