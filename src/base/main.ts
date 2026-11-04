import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILD_ITEMS } from '../data/buildItems';
import { SHIPPING } from '../data/shippingContainers';
import { aimToSpec } from '../rules/baseAim';
import {
  addPiece,
  checkRemove,
  createLayout,
  planPlace,
  removePiece,
  scatterBase,
  type Piece,
  type PieceKind,
  type PieceSpec,
  type PlacePlan,
  type Rotation,
} from '../rules/baseBuild';
import { createBaseView } from '../render/baseView';

// Base builder prototype. Open /base/ on the dev server.
// Menu at the bottom (or keys 1, 2, 3): pick what to build.
// Mouse: left click place, right click remove. R rotate, C paint colour.
// Build level: PageUp / PageDown (or [ and ]). Aiming at empty ground builds at that level, and a
// container with nothing under it gets pillars added. Aiming at a container snaps to it instead.
// Camera: W/A/S/D pan (Shift faster), Q/E turn, Z/X tilt, mouse wheel zoom.
// Shift+1 / Shift+2 / Shift+3 add 100 / 500 / 2000 random containers, Shift+0 clears everything.
// Page options: ?demo=500 starts with that many random containers (not saved), ?cam=yaw,pitch,dist,x,z.

const STORAGE_KEY = 'salvageroad.base.v1';
const params = new URLSearchParams(location.search);

const stats = document.getElementById('stats')!;
const statusEl = document.getElementById('status')!;
const levelEl = document.getElementById('level')!;
const help = document.getElementById('help')!;
const menuEl = document.getElementById('menu')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.environmentIntensity = 0.55;
room.dispose();
pmrem.dispose();
scene.background = new THREE.Color(0xa9bccb);
scene.fog = new THREE.Fog(0xa9bccb, 260, 800);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667060, 1.2));
const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const S = 70;
sun.shadow.camera.left = sun.shadow.camera.bottom = -S;
sun.shadow.camera.right = sun.shadow.camera.top = S;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 1500);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshStandardMaterial({ color: 0x6f7a5a, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid lines of the build grid, kept under the camera target and snapped to whole cells.
const GRID_CELLS = 160;
const gridLines = new THREE.GridHelper(GRID_CELLS * SHIPPING.cell, GRID_CELLS, 0x2e3a2a, 0x4f5b44);
(gridLines.material as THREE.Material).transparent = true;
(gridLines.material as THREE.Material).opacity = 0.2;
gridLines.position.y = 0.02;
scene.add(gridLines);

// The layout, and loading and saving it. Saved in the browser so edits to the code do not lose your build.
const layout = createLayout();
const view = createBaseView();
scene.add(view.group);

const demoCount = Number(params.get('demo') ?? 0) | 0;
type Saved = PieceSpec & { id?: number; owner?: number };
function save() {
  if (demoCount) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...layout.pieces.values()]));
  } catch {
    /* storage may be blocked; the builder still works */
  }
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Saved[];
    // Lowest level first so everything finds its support. Saved ids are remapped to new ones.
    saved.sort((a, b) => a.level - b.level);
    const newId = new Map<number, number>();
    const owned: [Piece, number][] = [];
    for (const { id, owner, ...spec } of saved) {
      const piece = addPiece(layout, spec);
      if (!piece) continue;
      if (id !== undefined) newId.set(id, piece.id);
      if (owner !== undefined) owned.push([piece, owner]);
    }
    for (const [piece, oldOwner] of owned) {
      const owner = newId.get(oldOwner);
      if (owner !== undefined) piece.owner = owner;
    }
  } catch {
    /* ignore a damaged save */
  }
}
if (demoCount) scatterBase(layout, 11, demoCount);
else load();
view.sync(layout);

// What the player is placing, and at which level.
let itemIndex = 0;
let kind: PieceKind = BUILD_ITEMS[0].kind;
let rot: Rotation = 0;
let colorIndex = 0;
let buildLevel = 0;
let status = '';
let statusUntil = 0;
function say(text: string, ms = 2200) {
  status = text;
  statusUntil = performance.now() + ms;
}

// The build menu, made from src/data/buildItems.ts.
const menuButtons: HTMLButtonElement[] = [];
function selectItem(i: number) {
  itemIndex = i;
  kind = BUILD_ITEMS[i].kind;
  menuButtons.forEach((b, j) => b.classList.toggle('on', j === i));
  aimDirty = true;
}
{
  const categories = [...new Set(BUILD_ITEMS.map((b) => b.category))];
  for (const category of categories) {
    const group = document.createElement('div');
    group.className = 'group';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = category;
    const row = document.createElement('div');
    row.className = 'row';
    BUILD_ITEMS.forEach((item, i) => {
      if (item.category !== category) return;
      const button = document.createElement('button');
      button.innerHTML = `<kbd>${i + 1}</kbd>${item.name}`;
      button.addEventListener('click', () => selectItem(i));
      menuButtons[i] = button;
      row.append(button);
    });
    group.append(title, row);
    menuEl.append(group);
  }
}

// Camera orbit around a point on the ground.
const camState = { yaw: 0.6, pitch: 0.75, dist: 38, x: 6, z: 6 };
const camParam = params.get('cam');
if (camParam) {
  const [yaw, pitch, dist, x, z] = camParam.split(',').map(Number);
  Object.assign(camState, { yaw, pitch, dist, x, z });
}

const keys = new Set<string>();
const mouse = new THREE.Vector2(0, 0);
let mouseSeen = false;
let aimDirty = true;
const raycaster = new THREE.Raycaster();
let ghostSpec: PieceSpec | null = null;
let ghostPlan: PlacePlan | null = null;

function changeLayout() {
  view.sync(layout);
  save();
  aimDirty = true;
}

function place() {
  if (!ghostSpec || !ghostPlan) return;
  if (!ghostPlan.ok) {
    say(ghostPlan.reason ?? 'Cannot place here');
    return;
  }
  addPiece(layout, ghostSpec, true);
  changeLayout();
}

function removeUnderMouse() {
  raycaster.setFromCamera(mouse, camera);
  const hit = view.pick(raycaster);
  if (!hit) return;
  const check = checkRemove(layout, hit.piece.id);
  if (!check.ok) {
    say(check.reason ?? 'Cannot remove');
    return;
  }
  removePiece(layout, hit.piece.id);
  changeLayout();
}

function setBuildLevel(level: number) {
  buildLevel = Math.min(SHIPPING.maxLevel, Math.max(0, level));
  aimDirty = true;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouseSeen = true;
  aimDirty = true;
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) place();
  if (e.button === 2) removeUnderMouse();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camState.dist = Math.min(260, Math.max(6, camState.dist * Math.exp(e.deltaY * 0.0012)));
    aimDirty = true;
  },
  { passive: false },
);
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'PageUp' || e.code === 'PageDown') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyR') rot = rot === 0 ? 1 : 0;
  if (e.code === 'PageUp' || e.code === 'BracketRight') setBuildLevel(buildLevel + 1);
  if (e.code === 'PageDown' || e.code === 'BracketLeft') setBuildLevel(buildLevel - 1);
  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit && !e.shiftKey) {
    const n = Number(digit[1]) - 1;
    if (n >= 0 && n < BUILD_ITEMS.length) selectItem(n);
  }
  if (digit && e.shiftKey) {
    const bulk: Record<string, number> = { '1': 100, '2': 500, '3': 2000 };
    if (bulk[digit[1]]) {
      const t = performance.now();
      const n = scatterBase(layout, layout.nextId * 7 + 1, bulk[digit[1]]);
      changeLayout();
      say(`Added ${n} random containers (${(performance.now() - t).toFixed(0)} ms)`);
    }
    if (digit[1] === '0') {
      layout.pieces.clear();
      layout.cells.clear();
      changeLayout();
      say('Cleared');
    }
  }
  aimDirty = true;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  aimDirty = true;
});

const levelPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let aimMs = 0;
function updateAim() {
  const t = performance.now();
  raycaster.setFromCamera(mouse, camera);
  const hit = view.pick(raycaster);
  ghostSpec = null;
  if (hit) {
    ghostSpec = aimToSpec(kind, rot, colorIndex, hit.point, hit.normal, hit.piece, buildLevel);
  } else {
    levelPlane.constant = -buildLevel * SHIPPING.height; // the plane y = buildLevel * level height
    if (raycaster.ray.intersectPlane(levelPlane, hitPoint)) {
      ghostSpec = aimToSpec(kind, rot, colorIndex, hitPoint, null, null, buildLevel);
    }
  }
  ghostPlan = ghostSpec ? planPlace(layout, ghostSpec) : null;
  view.setGhost(mouseSeen ? ghostSpec : null, ghostPlan?.ok ?? false, ghostPlan?.pillars ?? []);
  aimMs = performance.now() - t;
}

const recent: number[] = [];
let last = performance.now();
let statsClock = last;
selectItem(0);
renderer.setAnimationLoop((now) => {
  const frameMs = now - last;
  const dt = Math.min(frameMs / 1000, 0.1);
  last = now;
  recent.push(frameMs);
  if (recent.length > 120) recent.shift();

  // Camera controls
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1) * camState.dist * 0.7;
  const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  if (fwd || side) {
    // Forward on the ground is away from the camera.
    const fx = -Math.sin(camState.yaw);
    const fz = -Math.cos(camState.yaw);
    camState.x += (fx * fwd + -fz * side) * speed * dt;
    camState.z += (fz * fwd + fx * side) * speed * dt;
    aimDirty = true;
  }
  const turn = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  const tilt = (keys.has('KeyZ') ? 1 : 0) - (keys.has('KeyX') ? 1 : 0);
  if (turn || tilt) {
    camState.yaw += turn * 1.4 * dt;
    camState.pitch = Math.min(1.45, Math.max(0.12, camState.pitch + tilt * 0.9 * dt));
    aimDirty = true;
  }
  const cp = Math.cos(camState.pitch);
  camera.position.set(
    camState.x + Math.sin(camState.yaw) * cp * camState.dist,
    Math.sin(camState.pitch) * camState.dist,
    camState.z + Math.cos(camState.yaw) * cp * camState.dist,
  );
  camera.lookAt(camState.x, 0, camState.z);
  camera.updateMatrixWorld();

  // Light and grid follow the view so shadows stay sharp where you are looking.
  sun.target.position.set(camState.x, 0, camState.z);
  sun.position.set(camState.x + 55, 90, camState.z + 35);
  gridLines.position.x = Math.round(camState.x / SHIPPING.cell) * SHIPPING.cell;
  gridLines.position.z = Math.round(camState.z / SHIPPING.cell) * SHIPPING.cell;

  if (aimDirty) {
    aimDirty = false;
    updateAim();
  }
  view.update(camera);
  renderer.render(scene, camera);

  if (now - statsClock > 500) {
    statsClock = now;
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const sorted = [...recent].sort((a, b) => b - a);
    const worst = sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0];
    stats.textContent =
      `${(1000 / avg).toFixed(0)} fps   1% low ${(1000 / worst).toFixed(0)}   draws ${renderer.info.render.calls}   tris ${renderer.info.render.triangles}\n` +
      `pieces ${view.drawnCount()} (${view.detailCount()} detailed)   aim ${aimMs.toFixed(2)} ms`;
    help.textContent =
      `Placing: ${BUILD_ITEMS[itemIndex].name}${kind === 'pillar' ? '' : rot === 0 ? ', along X' : ', along Z'}\n` +
      'Click place   Right-click remove   R rotate   PgUp/PgDn build level\n' +
      'W/A/S/D pan   Q/E turn   Z/X tilt   Wheel zoom   Shift+1/2/3 add 100/500/2000 random   Shift+0 clear';
    levelEl.innerHTML = `Build level<br><b>${buildLevel}</b>  <span style="opacity:.7">PgUp / PgDn</span>`;
  }
  if (performance.now() < statusUntil) {
    statusEl.textContent = status;
    statusEl.className = 'panel bad';
  } else if (mouseSeen && ghostSpec && ghostPlan) {
    const extra = ghostPlan.pillars.length > 0 ? `  +${ghostPlan.pillars.length} pillars` : '';
    statusEl.textContent = ghostPlan.ok
      ? `Level ${ghostSpec.level}${ghostPlan.support < 1 && ghostPlan.pillars.length === 0 ? `  (${Math.round(ghostPlan.support * 100)}% supported)` : ''}${extra}`
      : (ghostPlan.reason ?? '');
    statusEl.className = ghostPlan.ok ? 'panel good' : 'panel bad';
  } else {
    statusEl.textContent = '';
    statusEl.className = 'panel';
  }
  statusEl.style.display = statusEl.textContent ? '' : 'none';
});

// For tests and screenshots.
(window as unknown as { __base: unknown }).__base = { layout, camState, scatterBase, changeLayout, setBuildLevel };
