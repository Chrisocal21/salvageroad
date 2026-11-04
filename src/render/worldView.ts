import * as THREE from 'three';
import { noise } from '../rules/terrain';
import { aridityAt, KIND, NO_WATER, type WorldMap } from '../rules/world';

// Draws the world's land and water from a WorldMap, and paints a top-down map of it.
// The whole world is one coarse mesh for now (one vertex per grid point). Closer detail, trees and so on come later.

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Blend from a to b by t (0 to 1) into out. Safe when out is also a or b. */
function mix(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  const k = Math.min(1, Math.max(0, t));
  const r = a.r + (b.r - a.r) * k;
  const g = a.g + (b.g - a.g) * k;
  const bl = a.b + (b.b - a.b) * k;
  return out.setRGB(r, g, bl);
}

// Muted colours: nature taking the land back.
const SAND = new THREE.Color(0xb7a676);
const SEABED = new THREE.Color(0x35525a);
const MEADOW = new THREE.Color(0x9aa66c);
const GRASS = new THREE.Color(0x768f50);
const FOREST = new THREE.Color(0x4a6840);
const ROCK = new THREE.Color(0x7c7a72);
const HIGH_ROCK = new THREE.Color(0x98948c);
const SNOW = new THREE.Color(0xe9edf0);
const MUD = new THREE.Color(0x726a4d);
// The desert: warm sand and dust, red rock, dry scrub.
const DESERT_SAND = new THREE.Color(0xbf9a69);
const DESERT_DUST = new THREE.Color(0xa67f50);
const DESERT_SCRUB = new THREE.Color(0x8b8553);
const DESERT_ROCK = new THREE.Color(0x8a5a3b);

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

/**
 * The colour of the ground at a world position. h is the ground height, slope is rise over run, and wet is true
 * on the banks of a river or lake. The same function paints the 3D terrain tiles and the map.
 */
export function groundColourAt(map: WorldMap, x: number, z: number, h: number, slope: number, wet: boolean, out: THREE.Color): THREE.Color {
  if (h < 0) {
    // Under the sea: sand in the shallows, darker with depth.
    return mix(SAND, SEABED, smooth(0, 14, -h), out).multiplyScalar(0.8);
  }
  const patch = noise(7, x / 160, z / 160) * 0.5 + 0.5; // 0 to 1, large patches of different growth
  const fine = noise(9, x / 24, z / 24) * 0.5 + 0.5;
  const dry = smooth(0.45, 0.72, aridityAt(map, x, z)); // 0 lush, 1 desert

  // Green country: meadow and grass at the bottom, forest higher up.
  mix(MEADOW, GRASS, patch, tmpA);
  mix(tmpA, FOREST, smooth(120, 300, h + (patch - 0.5) * 140), tmpA);
  // Desert country: sand and dust in patches, with dry scrub where it is a little greener.
  mix(DESERT_SAND, DESERT_DUST, patch, tmpB);
  mix(tmpB, DESERT_SCRUB, smooth(0.55, 0.95, fine) * 0.4, tmpB);
  mix(tmpA, tmpB, dry, tmpA);
  // Beach.
  mix(SAND, tmpA, smooth(1.5, 5 + patch * 4, h), tmpA);
  // Bare rock where it is steep or high (red in the desert), snow on the tops.
  mix(ROCK, DESERT_ROCK, dry, tmpB);
  mix(tmpA, tmpB, smooth(0.35, 0.75, slope) + smooth(380, 560, h) * 0.8, tmpA);
  mix(tmpA, HIGH_ROCK, smooth(460, 620, h), tmpA);
  mix(tmpA, SNOW, smooth(560, 640, h + (patch - 0.5) * 80) * (1 - smooth(0.5, 0.9, slope)), tmpA);
  // River and lake banks are muddy.
  if (wet) mix(tmpA, MUD, 0.7, tmpA);
  return out.copy(tmpA).multiplyScalar(0.92 + fine * 0.16);
}

/** The colour of the ground at a grid point. */
function groundColour(map: WorldMap, row: number, col: number, out: THREE.Color): THREE.Color {
  const n = map.n;
  const i = row * n + col;
  const hl = map.ground[row * n + Math.max(0, col - 1)];
  const hr = map.ground[row * n + Math.min(n - 1, col + 1)];
  const hu = map.ground[Math.max(0, row - 1) * n + col];
  const hd = map.ground[Math.min(n - 1, row + 1) * n + col];
  const slope = Math.hypot(hr - hl, hd - hu) / (2 * map.spacing);
  return groundColourAt(map, -map.half + col * map.spacing, -map.half + row * map.spacing, map.ground[i], slope, map.water[i] !== NO_WATER && map.water[i] > 0.5, out);
}

export function createTerrainMesh(map: WorldMap): THREE.Mesh {
  const n = map.n;
  const positions = new Float32Array(n * n * 3);
  const colours = new Float32Array(n * n * 3);
  const c = new THREE.Color();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      positions[i * 3] = -map.half + col * map.spacing;
      positions[i * 3 + 1] = map.ground[i];
      positions[i * 3 + 2] = -map.half + row * map.spacing;
      groundColour(map, row, col, c);
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
  }
  const cells = n - 1;
  const index = new Uint32Array(cells * cells * 6);
  let k = 0;
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const a = row * n + col;
      const b = a + 1;
      const d = a + n;
      const e = d + 1;
      // Counter-clockwise seen from above, so the faces point up.
      index[k++] = a;
      index[k++] = d;
      index[k++] = b;
      index[k++] = b;
      index[k++] = d;
      index[k++] = e;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
}

const SHALLOW = new THREE.Color(0x5fb3b0);
const DEEP = new THREE.Color(0x0b2f4a);
const RIVER = new THREE.Color(0x4f9aa0);

/** The water: one surface made of the grid squares that are wet, clearer where it is shallow. */
export function createWaterMesh(map: WorldMap): THREE.Mesh {
  const n = map.n;
  const wet = new Int32Array((n - 1) * (n - 1)).fill(-1);
  let quads = 0;
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const i = row * n + col;
      if (map.water[i] !== NO_WATER || map.water[i + 1] !== NO_WATER || map.water[i + n] !== NO_WATER || map.water[i + n + 1] !== NO_WATER) {
        wet[row * (n - 1) + col] = quads++;
      }
    }
  }
  const positions = new Float32Array(quads * 4 * 3);
  const colours = new Float32Array(quads * 4 * 4);
  const index = new Uint32Array(quads * 6);
  const c = new THREE.Color();
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const q = wet[row * (n - 1) + col];
      if (q < 0) continue;
      const corners = [row * n + col, row * n + col + 1, (row + 1) * n + col, (row + 1) * n + col + 1];
      // Each corner keeps its own water level, so a river slopes smoothly downhill. A dry corner takes the
      // lowest level of the wet ones: that puts it under the bank, so the shoreline is where the ground meets
      // the water and there are no slivers of water sticking up.
      let level = Infinity;
      for (const i of corners) if (map.water[i] !== NO_WATER) level = Math.min(level, map.water[i]);
      corners.forEach((i, v) => {
        const o = (q * 4 + v) * 3;
        const own = map.water[i] !== NO_WATER ? map.water[i] : level;
        positions[o] = -map.half + (col + (v & 1)) * map.spacing;
        positions[o + 1] = own;
        positions[o + 2] = -map.half + (row + (v >> 1)) * map.spacing;
        const depth = Math.max(0, own - map.ground[i]);
        const river = map.kind[i] === KIND.river || map.kind[i] === KIND.lake;
        mix(river ? RIVER : SHALLOW, DEEP, smooth(0, river ? 6 : 45, depth), c);
        const k = (q * 4 + v) * 4;
        colours[k] = c.r;
        colours[k + 1] = c.g;
        colours[k + 2] = c.b;
        colours[k + 3] = 0.25 + 0.7 * smooth(0, 8, depth); // see-through at the shore
      });
      const b = q * 4;
      index.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], q * 6);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 4));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    roughness: 0.18,
    metalness: 0.05,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

/** Flat deep-water plane that carries the sea out to the horizon beyond the edge of the map. */
export function createHorizonSea(map: WorldMap): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(map.spec.size * 12, map.spec.size * 12).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: DEEP, roughness: 0.25, metalness: 0.05 }),
  );
  mesh.position.y = -0.2;
  return mesh;
}

/** Paints a top-down picture of the world: land by height with shading, water in blue. North is up (towards -Z). */
export function paintMap(map: WorldMap, canvas: HTMLCanvasElement) {
  const n = map.n;
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const c = new THREE.Color();
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const h = map.ground[i];
      // Light from the north-west: slopes facing it are bright.
      const hl = map.ground[row * n + Math.max(0, col - 1)];
      const hr = map.ground[row * n + Math.min(n - 1, col + 1)];
      const hu = map.ground[Math.max(0, row - 1) * n + col];
      const hd = map.ground[Math.min(n - 1, row + 1) * n + col];
      const shade = Math.min(1.35, Math.max(0.65, 1 + ((hl - hr) + (hu - hd)) * 0.012));
      if (map.water[i] !== NO_WATER) {
        const depth = Math.max(0, map.water[i] - h);
        const river = map.kind[i] === KIND.river || map.kind[i] === KIND.lake;
        mix(river ? RIVER : SHALLOW, DEEP, smooth(0, river ? 6 : 60, depth), c);
      } else {
        groundColour(map, row, col, c).multiplyScalar(shade);
      }
      c.convertLinearToSRGB(); // the canvas wants screen colours, not the 3D scene's linear ones
      const o = i * 4;
      img.data[o] = Math.min(255, c.r * 255);
      img.data[o + 1] = Math.min(255, c.g * 255);
      img.data[o + 2] = Math.min(255, c.b * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
