import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHorizonSea, createTerrainMesh, createWaterMesh, paintMap } from '../render/worldView';
import { generateWorld, groundHeight, kindAt, KIND, waterLevel, WORLD } from '../rules/world';

// World viewer. Open /world/ on the dev server. Fly over the land mass, the ocean, the rivers and the lakes.
// Click the page to look around (Esc to let go). W/A/S/D fly, Q/E down and up, Shift faster, mouse wheel changes speed.
// M opens the big map; click on it to fly there. N makes a new random world, [ and ] step the seed.
// Page options: ?seed=7  ?view=x,y,z,yaw,pitch  ?map=1

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? WORLD.seed) | 0;

const infoEl = document.getElementById('info')!;
const whereEl = document.getElementById('where')!;
const helpEl = document.getElementById('help')!;
const loadingEl = document.getElementById('loading')!;
const mapEl = document.getElementById('map') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view') as HTMLCanvasElement, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const SKY = 0xa9c3d8;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 5000, 26000);
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.environmentIntensity = 0.45;
room.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x6c7a5c, 1.3));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.1);
sun.position.set(-0.45, 0.7, 0.55).multiplyScalar(10000);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 60000);

// Make the world. Slow bits are timed so we know what they cost.
const t0 = performance.now();
const map = generateWorld({ ...WORLD, seed });
const t1 = performance.now();
const terrain = createTerrainMesh(map);
const water = createWaterMesh(map);
scene.add(terrain, water, createHorizonSea(map));
const baseMap = document.createElement('canvas');
paintMap(map, baseMap);
const t2 = performance.now();
loadingEl.hidden = true;

// Flying camera.
const view = { x: 0, y: 2600, z: 6600, yaw: 0, pitch: -0.38 };
const viewParam = params.get('view');
if (viewParam) {
  const [x, y, z, yaw, pitch] = viewParam.split(',').map(Number);
  Object.assign(view, { x, y, z, yaw, pitch });
}
let speed = 300; // metres per second
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyN') location.search = `?seed=${Math.floor(Math.random() * 100000)}`;
  if (e.code === 'BracketRight') location.search = `?seed=${seed + 1}`;
  if (e.code === 'BracketLeft') location.search = `?seed=${seed - 1}`;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('click', () => {
  if (!mapBig) void renderer.domElement.requestPointerLock();
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  view.yaw -= e.movementX * 0.0022;
  view.pitch = Math.min(1.5, Math.max(-1.5, view.pitch - e.movementY * 0.0022));
});
window.addEventListener(
  'wheel',
  (e) => {
    if (mapBig) return;
    speed = Math.min(4000, Math.max(8, speed * Math.exp(-e.deltaY * 0.0012)));
  },
  { passive: true },
);

// Map: a small one in the corner, a big one on M. Click the big one to fly there.
let mapBig = params.get('map') === '1';
function sizeMap() {
  mapEl.classList.toggle('big', mapBig);
  const px = Math.round(mapEl.clientWidth * Math.min(devicePixelRatio, 2));
  mapEl.width = px;
  mapEl.height = px;
}
function toggleMap() {
  mapBig = !mapBig;
  if (mapBig) document.exitPointerLock();
  sizeMap();
}
sizeMap();
mapEl.addEventListener('click', (e) => {
  if (!mapBig) {
    toggleMap();
    return;
  }
  const rect = mapEl.getBoundingClientRect();
  view.x = ((e.clientX - rect.left) / rect.width - 0.5) * map.spec.size;
  view.z = ((e.clientY - rect.top) / rect.height - 0.5) * map.spec.size;
  view.y = Math.max(groundHeight(map, view.x, view.z), 0) + 250;
  toggleMap();
});
function drawMap() {
  const ctx = mapEl.getContext('2d')!;
  const w = mapEl.width;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(baseMap, 0, 0, w, w);
  // The town (a square) and where the player starts (a ring), so they can be found on the map.
  const { town, spawn } = map.settlement;
  const tx = (town.x / map.spec.size + 0.5) * w;
  const ty = (town.z / map.spec.size + 0.5) * w;
  const sx = (spawn.x / map.spec.size + 0.5) * w;
  const sy = (spawn.z / map.spec.size + 0.5) * w;
  const mark = Math.max(4, w / 70);
  ctx.lineWidth = Math.max(2, w / 220);
  ctx.strokeStyle = '#ffd24a';
  ctx.strokeRect(tx - mark, ty - mark, mark * 2, mark * 2);
  ctx.beginPath();
  ctx.arc(sx, sy, mark * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  const px = (view.x / map.spec.size + 0.5) * w;
  const py = (view.z / map.spec.size + 0.5) * w;
  const len = w * 0.045;
  const dx = -Math.sin(view.yaw) * len;
  const dy = -Math.cos(view.yaw) * len;
  ctx.lineWidth = Math.max(2, w / 160);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ff4a3a';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + dx, py + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, Math.max(3, w / 90), 0, Math.PI * 2);
  ctx.fill();
  if (mapBig) {
    // A one kilometre scale bar.
    const bar = (1000 / map.spec.size) * w;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.03, w * 0.96, bar, Math.max(3, w / 200));
    ctx.font = `${Math.round(w / 45)}px system-ui, sans-serif`;
    ctx.fillText('1 km', w * 0.03 + bar + 8, w * 0.965);
    ctx.fillText('N', w * 0.5, w * 0.03);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  sizeMap();
});

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const s = map.stats;
infoEl.textContent =
  `world seed ${seed}   ${(map.spec.size / 1000).toFixed(0)} km square   grid ${map.spec.cells} (${map.spacing.toFixed(1)} m)\n` +
  `land ${pct(s.landFraction)} (desert ${pct(s.desertFraction)} of it)   ocean ${pct(s.oceanFraction)}   rivers reaching the sea ${s.riverMouths}   lakes ${s.lakes}\n` +
  `highest ${s.highest.toFixed(0)} m   deepest ${s.deepest.toFixed(0)} m\n` +
  `made in ${(t1 - t0).toFixed(0)} ms, drawn in ${(t2 - t1).toFixed(0)} ms`;
helpEl.textContent =
  'Click to look   W/A/S/D fly   Q/E down/up   Shift faster   Wheel speed   M map (click it to fly there; square = town, ring = start)   N new world   [ ] seed';

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const recent: number[] = [];
let last = performance.now();
let hudClock = 0;
renderer.setAnimationLoop((now) => {
  const frame = now - last;
  const dt = Math.min(frame / 1000, 0.1);
  last = now;
  recent.push(frame);
  if (recent.length > 60) recent.shift();

  euler.set(view.pitch, view.yaw, 0);
  camera.quaternion.setFromEuler(euler);
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1;
  const move = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const lift = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  view.x += (forward.x * move + right.x * strafe) * speed * fast * dt;
  view.y += (forward.y * move + right.y * strafe + lift) * speed * fast * dt;
  view.z += (forward.z * move + right.z * strafe) * speed * fast * dt;
  // Do not fly into the ground.
  view.y = Math.max(view.y, Math.max(groundHeight(map, view.x, view.z), 0) + 2);
  camera.position.set(view.x, view.y, view.z);

  renderer.render(scene, camera);
  drawMap();

  if (now - hudClock > 400) {
    hudClock = now;
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const ground = groundHeight(map, view.x, view.z);
    const wl = waterLevel(map, view.x, view.z);
    const here = ['land', 'ocean', 'river', 'lake'][kindAt(map, view.x, view.z)];
    const inside = Math.abs(view.x) <= map.half && Math.abs(view.z) <= map.half;
    whereEl.textContent =
      `${(1000 / avg).toFixed(0)} fps   ${(renderer.info.render.triangles / 1e6).toFixed(2)} M triangles\n` +
      `x ${view.x.toFixed(0)}  z ${view.z.toFixed(0)}  height ${view.y.toFixed(0)} m\n` +
      `${inside ? `over ${here}${wl !== null ? ` (water ${(wl - ground).toFixed(1)} m deep)` : `, ground ${ground.toFixed(0)} m`}` : 'beyond the map: open sea'}\n` +
      `speed ${speed.toFixed(0)} m/s`;
  }
});

(window as unknown as { __world: unknown }).__world = {
  map,
  KIND,
  ready: true,
  setView: (x: number, y: number, z: number, yaw: number, pitch: number) => Object.assign(view, { x, y, z, yaw, pitch }),
  groundHeight: (x: number, z: number) => groundHeight(map, x, z),
};
