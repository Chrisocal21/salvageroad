import { worldMaterial } from './worldMaterials';
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
 * how muddy the bank of a river or lake is (0 dry to 1 soaked). The same function paints the 3D terrain tiles and the map.
 */
export function groundColourAt(map: WorldMap, x: number, z: number, h: number, slope: number, wet: number, out: THREE.Color): THREE.Color {
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
  if (wet > 0) mix(tmpA, MUD, 0.7 * wet, tmpA);
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
  return groundColourAt(map, -map.half + col * map.spacing, -map.half + row * map.spacing, map.ground[i], slope, map.water[i] !== NO_WATER && map.water[i] > 0.5 ? 1 : 0, out);
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
  return new THREE.Mesh(geometry, worldMaterial('terrain', { vertexColors: true, roughness: 0.95, metalness: 0 }));
}

const SHALLOW = new THREE.Color(0x5fb3b0);
const DEEP = new THREE.Color(0x0b2f4a);
const RIVER = new THREE.Color(0x4f9aa0);

/** Rings of grid squares the water surface reaches past the last wet point, so the shore is cut by the ground, not by the mesh. */
const WATER_MARGIN = 3;

/**
 * The water: one surface over every wet grid square and a few squares beyond. Each point carries a water level
 * (spread outward from the wet points, so beyond the shore it lies under the bank). The shader looks up the real
 * ground height under every pixel: where the ground is above the water the pixel is dropped, and the depth
 * decides the colour and clarity. So the shoreline is the smooth line where the ground meets the water, however
 * coarse the mesh, and nothing flickers with the view.
 */
export function createWaterMesh(map: WorldMap): THREE.Mesh {
  const n = map.n;
  const level = Float32Array.from(map.water);
  const river = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) river[i] = map.kind[i] === KIND.river || map.kind[i] === KIND.lake ? 1 : 0;
  for (let ring = 0; ring < WATER_MARGIN; ring++) {
    const before = Float32Array.from(level);
    const beforeRiver = Float32Array.from(river);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const i = row * n + col;
        if (before[i] !== NO_WATER) continue;
        let low = Infinity;
        let rv = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || c < 0 || r >= n || c >= n) continue;
            const j = r * n + c;
            if (before[j] !== NO_WATER && before[j] < low) {
              low = before[j];
              rv = beforeRiver[j];
            }
          }
        }
        if (low !== Infinity) {
          level[i] = low;
          river[i] = rv;
        }
      }
    }
  }
  const used = new Int32Array(n * n).fill(-1);
  let vertices = 0;
  const quads: number[] = [];
  for (let row = 0; row < n - 1; row++) {
    for (let col = 0; col < n - 1; col++) {
      const i = row * n + col;
      if (level[i] === NO_WATER || level[i + 1] === NO_WATER || level[i + n] === NO_WATER || level[i + n + 1] === NO_WATER) continue;
      for (const k of [i, i + 1, i + n, i + n + 1]) if (used[k] < 0) used[k] = vertices++;
      quads.push(used[i], used[i + n], used[i + 1], used[i + 1], used[i + n], used[i + n + 1]);
    }
  }
  const positions = new Float32Array(vertices * 3);
  const rivers = new Float32Array(vertices);
  for (let i = 0; i < n * n; i++) {
    const v = used[i];
    if (v < 0) continue;
    positions[v * 3] = -map.half + (i % n) * map.spacing;
    positions[v * 3 + 1] = level[i];
    positions[v * 3 + 2] = -map.half + Math.floor(i / n) * map.spacing;
    rivers[v] = river[i];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRiver', new THREE.BufferAttribute(rivers, 1));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(quads), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const heights = new THREE.DataTexture(map.ground, n, n, THREE.RedFormat, THREE.FloatType);
  heights.minFilter = heights.magFilter = THREE.NearestFilter;
  heights.generateMipmaps = false;
  heights.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    roughness: 0.18,
    metalness: 0.05,
    depthWrite: false,
    polygonOffset: true, // pulled a hair toward the camera, so water over a seabed never flickers against it
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGround = { value: heights };
    shader.uniforms.uGrid = { value: new THREE.Vector3(n, map.half, map.spacing) };
    shader.uniforms.uShallow = { value: SHALLOW };
    shader.uniforms.uRiver = { value: RIVER };
    shader.uniforms.uDeep = { value: DEEP };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRiver;\nvarying float vRiver;\nvarying vec3 vWaterPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRiver = aRiver;\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vRiver;
varying vec3 vWaterPos;
uniform sampler2D uGround;
uniform vec3 uGrid;
uniform vec3 uShallow;
uniform vec3 uRiver;
uniform vec3 uDeep;
float groundAt(vec2 xz) {
  float fx = clamp((xz.x + uGrid.y) / uGrid.z, 0.0, uGrid.x - 1.001);
  float fz = clamp((xz.y + uGrid.y) / uGrid.z, 0.0, uGrid.x - 1.001);
  ivec2 c = ivec2(int(floor(fx)), int(floor(fz)));
  vec2 t = vec2(fx - floor(fx), fz - floor(fz));
  float a = texelFetch(uGround, c, 0).r;
  float b = texelFetch(uGround, c + ivec2(1, 0), 0).r;
  float d = texelFetch(uGround, c + ivec2(0, 1), 0).r;
  float e = texelFetch(uGround, c + ivec2(1, 1), 0).r;
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float waterDepth = vWaterPos.y - groundAt(vWaterPos.xz);
if (waterDepth <= 0.0) discard;
bool isRiver = vRiver > 0.5;
vec3 waterColour = mix(isRiver ? uRiver : uShallow, uDeep, smoothstep(0.0, isRiver ? 6.0 : 45.0, waterDepth));
float clarity = isRiver ? 0.25 + 0.7 * smoothstep(0.0, 8.0, waterDepth) : mix(0.45, 1.0, smoothstep(0.0, 14.0, waterDepth));
diffuseColor = vec4(waterColour, clarity * smoothstep(0.0, 0.5, waterDepth));`,
      );
  };
  material.customProgramCacheKey = () => 'water-by-ground-depth-v1';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * The sea beyond the map: a flat deep-water ring round the map's edge, out to the horizon. Inside the map the
 * water mesh and the seabed are drawn, so the ring has a hole there (a little overlap, so there is no crack).
 */
export function createHorizonSea(map: WorldMap): THREE.Mesh {
  const outer = map.spec.size * 6;
  const inner = map.half - 12;
  const shape = new THREE.Shape([new THREE.Vector2(-outer, -outer), new THREE.Vector2(outer, -outer), new THREE.Vector2(outer, outer), new THREE.Vector2(-outer, outer)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-inner, -inner), new THREE.Vector2(-inner, inner), new THREE.Vector2(inner, inner), new THREE.Vector2(inner, -inner)]));
  const geometry = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: DEEP, roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide }));
  mesh.position.y = 0;
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
