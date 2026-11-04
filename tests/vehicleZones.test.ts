import { describe, expect, it } from 'vitest';
import { exitPosition } from '../src/rules/interaction';
import { truckZone } from '../src/rules/vehicleZones';

const truck = { x: 10, z: 20, hx: 0.95, hz: 2.6, yaw: 0 }; // facing +Z, so its left (driver) side is +X

describe('truck zones', () => {
  it('names the front, doors and back of a truck facing +Z', () => {
    expect(truckZone(truck, 10, 24)).toBe('hood');
    expect(truckZone(truck, 12, 22.5)).toBe('hood'); // beside the front fender
    expect(truckZone(truck, 11.8, 20.3)).toBe('driver_door');
    expect(truckZone(truck, 8.2, 20.3)).toBe('passenger_door');
    expect(truckZone(truck, 10, 16)).toBe('bed');
    expect(truckZone(truck, 8.3, 18)).toBe('bed');
  });

  it('follows the truck round when it is turned', () => {
    const turned = { ...truck, yaw: Math.PI }; // facing -Z: left is now -X
    expect(truckZone(turned, 10, 16)).toBe('hood');
    expect(truckZone(turned, 8.2, 19.7)).toBe('driver_door');
    expect(truckZone(turned, 11.8, 19.7)).toBe('passenger_door');
    expect(truckZone(turned, 10, 24)).toBe('bed');
    const east = { ...truck, yaw: Math.PI / 2 }; // facing +X: left is -Z
    expect(truckZone(east, 14, 20)).toBe('hood');
    expect(truckZone(east, 10.2, 18.2)).toBe('driver_door');
    expect(truckZone(east, 10.2, 21.8)).toBe('passenger_door');
  });

  it('lets you step out on the side you got in from', () => {
    const left = exitPosition(truck);
    const right = exitPosition(truck, -1);
    expect(left.x).toBeGreaterThan(truck.x);
    expect(right.x).toBeLessThan(truck.x);
    expect(truckZone(truck, left.x, left.z)).toBe('driver_door');
    expect(truckZone(truck, right.x, right.z)).toBe('passenger_door');
  });
});
