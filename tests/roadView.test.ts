import { describe, expect, it } from 'vitest';
import { createRoadMesh } from '../src/render/roadView';
import { createGround } from '../src/rules/ground';
import type { RoadNetwork } from '../src/rules/roads';
import { generateWorld } from '../src/rules/world';

const map = generateWorld({ seed: 1, size: 12000, cells: 128 });
const network: RoadNetwork = {
  roads: [{
    id: 0, class: 'road', from: 0, to: 1, length: 100, bridgeLength: 0,
    points: [
      { x: 1000, z: 500, y: 200, bridge: false },
      { x: 1100, z: 500, y: 206, bridge: false },
    ],
  }],
  connected: [0, 1],
};

describe('road pavement', () => {
  it('rests on the actual ground at both edges instead of floating at the planned height', () => {
    const height = (x: number, z: number) => 50 + x * 0.02 + z * 0.1;
    const mesh = createRoadMesh(map, network, height);
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBeCloseTo(height(positions.getX(i), positions.getZ(i)) + 0.25, 4);
    }
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('matches the road-levelled ground along a sloping ribbon', () => {
    const ground = createGround(map, network);
    const mesh = createRoadMesh(map, network, ground.height);
    const positions = mesh.geometry.getAttribute('position');
    expect(positions.getY(0)).toBeCloseTo(200.25, 4);
    expect(positions.getY(1)).toBeCloseTo(200.25, 4);
    expect(positions.getY(2)).toBeCloseTo(206.25, 4);
    expect(positions.getY(3)).toBeCloseTo(206.25, 4);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('keeps bridge decks above water independently of the natural ground', () => {
    const bridge: RoadNetwork = {
      ...network,
      roads: [{ ...network.roads[0], points: network.roads[0].points.map((p) => ({ ...p, bridge: true })) }],
    };
    const mesh = createRoadMesh(map, bridge, () => -20);
    const positions = mesh.geometry.getAttribute('position');
    expect(positions.getY(0)).toBeCloseTo(200.25, 4);
    expect(positions.getY(3)).toBeCloseTo(206.25, 4);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
