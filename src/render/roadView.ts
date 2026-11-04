// Draws the road network: as ribbons draped on the land in 3D (bridge decks ride at deck height), and as
// lines on the top-down map. The network itself is plain numbers from src/rules/roads.ts.

import * as THREE from 'three';
import { groundHeight, type WorldMap } from '../rules/world';
import { ROAD_SPEC, type RoadClass, type RoadNetwork } from '../rules/roads';
import { worldMaterial } from './worldMaterials';

const ROAD_COLOUR = new THREE.Color(0x4a4a4e);
const SURFACE: Record<RoadClass, THREE.Color> = { highway: ROAD_COLOUR, road: ROAD_COLOUR, dirt: ROAD_COLOUR, trail: ROAD_COLOUR };
const DECK = new THREE.Color(0x707078);

/**
 * One mesh for every road: a ribbon per road, as wide as its class. Off bridges the ribbon hugs the ground
 * (or the road's own height where that is higher, so embankments show); on bridges it rides the deck.
 * The ground height defaults to the world's own; the game passes its levelled ground so the ribbon sits on it.
 */
export function createRoadMesh(map: WorldMap, network: RoadNetwork, ground: (x: number, z: number) => number = (x, z) => groundHeight(map, x, z)): THREE.Mesh {
  let pointCount = 0;
  for (const road of network.roads) pointCount += road.points.length;
  const positions = new Float32Array(pointCount * 2 * 3);
  const colours = new Float32Array(pointCount * 2 * 3);
  const index = new Uint32Array((pointCount - network.roads.length) * 6);
  let v = 0;
  let k = 0;
  const c = new THREE.Color();
  for (const road of network.roads) {
    const half = Math.max(ROAD_SPEC[road.class].width, 2) / 2;
    const base = v / 3;
    const pts = road.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const y = p.bridge ? p.y + 0.4 : Math.max(ground(p.x, p.z) + 0.25, p.y + 0.15);
      c.copy(p.bridge ? DECK : SURFACE[road.class]);
      for (const s of [-1, 1]) {
        positions[v] = p.x + -dz * half * s;
        positions[v + 1] = y;
        positions[v + 2] = p.z + dx * half * s;
        colours[v] = c.r;
        colours[v + 1] = c.g;
        colours[v + 2] = c.b;
        v += 3;
      }
      if (i > 0) {
        const a = base + (i - 1) * 2;
        const b = base + i * 2;
        index[k++] = a;
        index[k++] = a + 1;
        index[k++] = b;
        index[k++] = b;
        index[k++] = a + 1;
        index[k++] = b + 1;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = worldMaterial('asphalt', { vertexColors: true, roughness: 0.9 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  return new THREE.Mesh(geometry, material);
}

const MAP_COLOUR: Record<RoadClass, string> = {
  highway: '#2e2e33',
  road: '#6e6e73',
  dirt: '#8a6842',
  trail: '#c4ad7c',
};
const MAP_BRIDGE = '#e04830';
const MAP_WIDTH: Record<RoadClass, number> = { highway: 3, road: 2.2, dirt: 1.8, trail: 1.2 };

/** Draws the network on the map canvas. w is the canvas size in pixels; north is up (towards -Z). */
export function paintRoads(map: WorldMap, network: RoadNetwork, ctx: CanvasRenderingContext2D, w: number) {
  const px = (x: number) => (x / map.spec.size + 0.5) * w;
  const scale = Math.max(1, w / 500);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of network.roads) {
    ctx.strokeStyle = MAP_COLOUR[road.class];
    ctx.lineWidth = Math.max(1, MAP_WIDTH[road.class] * scale);
    ctx.beginPath();
    road.points.forEach((p, i) => (i === 0 ? ctx.moveTo(px(p.x), px(p.z)) : ctx.lineTo(px(p.x), px(p.z))));
    ctx.stroke();
  }
  // Bridges on top, each run of deck extended one point past its ends so it meets the banks.
  ctx.strokeStyle = MAP_BRIDGE;
  for (const road of network.roads) {
    ctx.lineWidth = Math.max(1.5, MAP_WIDTH[road.class] * scale * 1.3);
    let i = 0;
    while (i < road.points.length) {
      if (!road.points[i].bridge) {
        i++;
        continue;
      }
      let end = i;
      while (end + 1 < road.points.length && road.points[end + 1].bridge) end++;
      ctx.beginPath();
      for (let k = Math.max(0, i - 1); k <= Math.min(road.points.length - 1, end + 1); k++) {
        const p = road.points[k];
        if (k === Math.max(0, i - 1)) ctx.moveTo(px(p.x), px(p.z));
        else ctx.lineTo(px(p.x), px(p.z));
      }
      ctx.stroke();
      i = end + 1;
    }
  }
}
