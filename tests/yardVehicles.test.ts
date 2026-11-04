import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createYardVehicle } from '../src/render/yardVehicles';
import { createYardTire } from '../src/render/yardTire';
import { generateTown } from '../src/rules/town';

describe('stationary salvage models', () => {
  it('keeps all five silhouettes inside their collision envelopes with finite geometry', () => {
    const wrecks = generateTown(1).junkyard.wrecks;
    const names = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const car = createYardVehicle(i);
      const wreck = wrecks[i];
      const halfWidth = wreck.turned ? wreck.hz : wreck.hx;
      const halfLength = wreck.turned ? wreck.hx : wreck.hz;
      names.add(car.name);
      const bounds = new THREE.Box3().setFromObject(car, true);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-halfWidth);
      expect(bounds.max.x).toBeLessThanOrEqual(halfWidth);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-halfLength);
      expect(bounds.max.z).toBeLessThanOrEqual(halfLength);
      expect(bounds.max.y).toBeLessThanOrEqual(wreck.height);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.03);
      expect(car.children.length).toBeLessThan(20); // Batched body detail, not hundreds of draws per wreck.
      car.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const attribute of ['position', 'normal']) {
          expect(Array.from(object.geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
        }
      });
    }
    expect(names.size).toBe(5);
  });

  it('makes tire piles with an open bead and correct outside diameter', () => {
    const tire = createYardTire(0.48, 0.23);
    const positions = tire.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getZ(i));
      expect(radius).toBeGreaterThan(0.27);
      expect(radius).toBeLessThan(0.481);
    }
  });
});

