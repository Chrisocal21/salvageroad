import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Bench, formatReport, scriptedInput } from './bench';
import { CONTAINERS } from './data/containers';
import { createRapierSim } from './lab/rapierSim';
import { CAR, type CarSim, type DriveInput } from './lab/types';
import { createElCajon, type BodyPart } from './render/elCajon';
import { createBedView } from './render/bedLoad';
import { createBlocks, createPartModel, createRigTire, partSize } from './render/carParts';
import { checkFit, completeCarBuild, createCarBuild, describeMissing, fitPart, isComplete, PARTS, UNDER_HOOD, type CarBuild, type PartKind } from './rules/carParts';
import { createProps } from './render/props';
import { batchTownScenery, createTownView } from './render/town';
import { createHud } from './ui/hud';
import type { Box2, Obb2 } from './rules/geometry';
import { exitPosition, findTarget, type Target } from './rules/interaction';
import { createStorage, describeMove, moveStack } from './rules/vehicleStorage';
import { truckZone, type TruckZone } from './rules/vehicleZones';
import { addItem, createInventory } from './rules/inventory';
import { ITEMS } from './data/items';
import { consume, consumeSlot, createSurvival, isWeak, stepSurvival, SURVIVAL } from './rules/survival';
import { describeStacks, newContainerState, openContainer } from './rules/loot';
import { summarizeFrames } from './rules/perfStats';
import { PROP_COLLIDER } from './rules/scatter';
import { insideWorkshop, LOT, reachableContainers, settlementGrid } from './rules/town';
import { generateSettlements, settlementPlaces as getSettlementPlaces } from './rules/settlements';
import { generateDestinations, installDestinationGround } from './rules/destinations';
import { lookWalker, stepWalker, WALKER, type Walker } from './rules/walker';
import { TerrainTiles } from './render/terrainTiles';
import { createHorizonSea, createWaterMesh, paintMap } from './render/worldView';
import { createRoadMesh, paintRoads } from './render/roadView';
import { createPlaceMarkers } from './render/placeMarkers';
import { createGround } from './rules/ground';
import { generateWorld, waterLevel, WORLD } from './rules/world';
import { planPlaces } from './rules/places';
import { planRoads } from './rules/roads';
import { restoreMountains } from './rules/mountains';
import { createMapOverlay } from './ui/mapOverlay';
import { makeTrader } from './rules/trade';
import { scatterWorldProps } from './rules/worldProps';
import { SHIPPING, type ShippingKind } from './data/shippingContainers';
import { createBaseView } from './render/baseView';
import { aimToSpec } from './rules/baseAim';
import { addPiece, checkRemove, createLayout, planPlace, removePiece, type PieceSpec, type PlacePlan, type Rotation } from './rules/baseBuild';
import { GAME_BASE_STORAGE_KEY, loadLayout, serializeLayout } from './rules/baseSave';
import { layoutBoxes, siteProblem, walkingSolids } from './rules/baseWorld';

// You wake up in the desert. Over the dune is a town: food and water in its boxes and stores, and in its junkyard
// the El Cajon, stripped, its parts lying round the yard. Find the wrench, carry the parts over one at a time and
// bolt them on, and it is yours to drive.
// On foot: W/A/S/D walk, Shift run, E use (pick up, bolt on, put down, open), mouse look.
// Driving: W/S gas and brake, A/D steer, Space handbrake.
// Unloading containers: pull up and press U. You get out and the crosshair shows where the next container goes.
// Click puts it down, right-click picks one back up onto the truck, R rotates, the mouse wheel (or PageUp/PageDown)
// sets the height, 1-9 choose which container, U finishes.
// Fly mode, for testing and looking around: G turns it on and off. W/A/S/D fly, Q/E down and up, Shift faster, wheel changes speed,
// T lands you on foot where you are. Nothing collides, nothing gets hungry, the truck stays parked.
// Always: R reset (rotate, while unloading), B performance run, J jump to the town (testing: the street outside the junkyard).
// M opens the map (click it to travel there, testing); N makes a new random world, [ and ] step the seed.
// Page options: ?seed=7 makes a different world. ?objects=3000 changes the prop count (default 1500). ?cargo=ft20,ft40 puts test containers on the truck.
// ?fixed=1 starts with the El Cajon already put back together, for testing.

const STEP = 1 / 60; // physics always runs at a fixed 60 steps per second

const params = new URLSearchParams(location.search);
const propCount = Math.max(0, Number(params.get('objects') ?? 1500) | 0);

const hud = createHud(document.body);
const benchPanel = document.getElementById('bench') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const basePixelRatio = Math.min(window.devicePixelRatio, 2);
let renderScale = 1;
function applySize() {
  renderer.setPixelRatio(basePixelRatio * renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
}
applySize();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Reflected light lets the car's clearcoat and chrome show the body contours.
const environmentGenerator = new THREE.PMREMGenerator(renderer);
const environmentRoom = new RoomEnvironment();
const environment = environmentGenerator.fromScene(environmentRoom, 0.04);
scene.environment = environment.texture;
scene.environmentIntensity = 0.65;
environmentRoom.dispose();
environmentGenerator.dispose();
scene.background = new THREE.Color(0xa7bccb);
scene.fog = new THREE.Fog(0xb5c3cb, 500, 7500);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -22;
sun.shadow.camera.right = sun.shadow.camera.top = 22;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.normalBias = 0.015;
sun.shadow.bias = -0.0001;
scene.add(sun);
scene.add(sun.target);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 20000);

// The world: made from a seed (?seed=7 gives another). The land, sea, rivers and lakes come from src/rules/world.ts, and the
// ground you stand and drive on from src/rules/ground.ts. The town sits on level ground in a desert, and you start out in
// the desert, a walk from it. The places and the road network between them are planned from the same world
// (src/rules/places.ts, src/rules/roads.ts), and the ground is cut and filled along the roads so they are drivable.
const SEED = Number(params.get('seed') ?? 1) | 0;
const worldMap = generateWorld({ ...WORLD, seed: SEED });
const tPlan = performance.now();
const plan = planPlaces(worldMap);
const network = planRoads(worldMap, plan);
restoreMountains(worldMap, plan, network);
console.log(`places and roads planned in ${(performance.now() - tPlan).toFixed(0)} ms: ${plan.places.length} places, ${network.roads.length} roads`);
const settlementPlaces = getSettlementPlaces(worldMap, plan);
const ground = createGround(worldMap, network, settlementPlaces);
const { town: townSite, spawn: playerSpawn } = worldMap.settlement;
const settlements = generateSettlements(SEED, worldMap, plan, network);
const town = settlements[0];
const startingTrader = makeTrader(SEED, 0, 'tools-parts');
const destinations = generateDestinations(SEED, plan, network, settlements.reduce((n, s) => n + s.containers.length, 0), worldMap);
installDestinationGround(ground, destinations);
settlements.push(...destinations);
const displayPlaces = plan.places.map(p => {
  const site = destinations.find(s => s.placeId === p.id);
  return site ? { ...p, x: site.center.x, z: site.center.z, height: site.groundY! } : p;
});
const allContainers = settlements.flatMap(s => s.containers);
const containersById = new Map(allContainers.map(c => [c.id, c]));
const props = scatterWorldProps(worldMap, ground, 7, propCount, 1700).filter(p => !settlementPlaces.some(s => Math.max(Math.abs(p.x - s.x), Math.abs(p.z - s.z)) < settlementGrid(s.kind, s.urban) * LOT / 2 + 15) && ![...destinations, ...(network.neighborhoods ?? []).map(n => n.town)].some(s => Math.max(Math.abs(p.x - s.center.x), Math.abs(p.z - s.center.z)) < 60));
const terrainTiles = new TerrainTiles(worldMap, ground);
scene.add(terrainTiles.group, createWaterMesh(worldMap), createHorizonSea(worldMap));
scene.add(createRoadMesh(worldMap, network, ground.height));
scene.add(createPlaceMarkers(displayPlaces, ground.height));
// Build the ground round the start in one go, so nothing pops in on the first frame.
terrainTiles.update(new THREE.Vector3(playerSpawn.x, ground.height(playerSpawn.x, playerSpawn.z) + 2, playerSpawn.z), Infinity);
createProps(props, ground.height).forEach((o) => scene.add(o));
const townViews = settlements.map((s, i) => createTownView(s, s.groundY ?? (i === 0 ? townSite.height : settlementPlaces[i - 1].height), s.siteKind ? ground.height : undefined));
scene.add(batchTownScenery(townViews));
for (const townView of townViews) {
  townView.group.traverse(object => {
    if (object instanceof THREE.Mesh) object.receiveShadow = true;
  });
  scene.add(townView.group);
}

// The player's base: saved in the browser (the game's own save, not the /base/ test page's). It is built on the town's level ground.
const buildBaseY = townSite.height;
const baseLayout = createLayout();
try {
  loadLayout(baseLayout, localStorage.getItem(GAME_BASE_STORAGE_KEY));
} catch {
  /* storage may be blocked; the game still works */
}
const baseView = createBaseView();
baseView.group.position.y = buildBaseY;
scene.add(baseView.group);
baseView.sync(baseLayout);
// The shipping container standing in the junkyard: part of the world, drawn the same way as the base's containers,
// but kept apart from the base (not saved, not edited). Its walls are in town.solids, so you cannot walk or drive through it.
const cargoLayout = createLayout();
addPiece(cargoLayout, town.junkyard.cargo);
const cargoView = createBaseView(16);
cargoView.group.position.y = buildBaseY;
scene.add(cargoView.group);
cargoView.sync(cargoLayout);
/** The base's solid blocks, lifted to the height of the ground it stands on. */
const baseBoxes = () => layoutBoxes(baseLayout).map((box) => ({ ...box, y0: box.y0 + buildBaseY }));
const worldSpec = {
  ground: (x: number, z: number) => ground.surface(x, z), // what the truck drives on: roads and bridge decks included
  props,
  boxes: [
    ...settlements.flatMap(s => s.solids),
    ...allContainers,
  ],
  carSpawn: town.carSpawn,
  buildBoxes: baseBoxes(),
};

// Everything the player on foot cannot walk through. Props count as square for simplicity.
const walkSolids: Box2[] = [
  ...settlements.flatMap(s => s.solids),
  ...allContainers,
  ...props.map((p) => {
    const c = PROP_COLLIDER[p.kind];
    const r = Math.max(c.hx, c.hz) * p.scale;
    return { x: p.x, z: p.z, hx: r, hz: r };
  }),
];
// The player's own base blocks walking too. staticSolids is the world as it was found, and what new pieces must not overlap.
const staticSolids = walkSolids.slice();
function rebuildBuildSolids() {
  walkSolids.length = staticSolids.length;
  walkSolids.push(...walkingSolids(baseLayout));
}
rebuildBuildSolids();

const car = createElCajon();
scene.add(car.body);
// What is stored in the bed shows in the bed.
const bedView = createBedView();
car.body.add(bedView.group);
car.wheels.forEach((w) => scene.add(w));

// The El Cajon starts stripped in the junkyard: on blocks, its parts lying round the yard (src/rules/carParts.ts).
const startFixed = params.get('fixed') === '1';
const carBuild: CarBuild = startFixed ? completeCarBuild() : createCarBuild();
const wheelOn = car.wheels.map(() => startFixed); // which wheel hubs have a wheel on
const wheelBlocks = car.wheels.map(() => createBlocks());
wheelBlocks.forEach((b) => scene.add(b));
function showCarBuild() {
  for (const kind of Object.keys(car.parts) as BodyPart[]) car.parts[kind].visible = carBuild[kind] > 0;
  car.wheels.forEach((wheel, i) => {
    wheel.visible = wheelOn[i];
    wheelBlocks[i].visible = !wheelOn[i];
  });
}
showCarBuild();

interface LoosePart {
  id: number;
  kind: PartKind;
  x: number;
  z: number;
  /** 0 on the ground, 1 on top of that, and so on: how the tyres are stacked. */
  level: number;
  model: THREE.Group;
}
const looseParts: LoosePart[] = [];
let nextPartId = 0;
const PART_REACH_BOX = 0.45; // half size of the box you aim at to pick a part up
function layPart(kind: PartKind, x: number, z: number, yaw: number, level = 0) {
  const model = createPartModel(car, kind);
  const thickness = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
  model.position.set(x, ground.height(x, z) + level * thickness, z);
  model.rotation.y = yaw;
  scene.add(model);
  looseParts.push({ id: nextPartId++, kind, x, z, level, model });
}
if (!startFixed) for (const p of town.junkyard.parts) layPart(p.kind, p.x, p.z, p.yaw, p.level ?? 0);
/** Only the top of a stack can be taken. */
function onTop(p: LoosePart): boolean {
  return !looseParts.some((q) => q !== p && q.kind === p.kind && q.level > p.level && Math.abs(q.x - p.x) < 0.05 && Math.abs(q.z - p.z) < 0.05);
}

// Things that go straight into the pack when you take them, lying about the yard.
interface Pickup {
  id: number;
  item: string;
  x: number;
  z: number;
  model: THREE.Group;
}
const pickups: Pickup[] = [];
{
  const r = town.junkyard.rigTire;
  const model = createRigTire();
  model.position.set(r.x, ground.height(r.x, r.z), r.z);
  model.rotation.y = r.yaw;
  scene.add(model);
  pickups.push({ id: 0, item: 'rig_tire', x: r.x, z: r.z, model });
}
/** What the player is told when they pick something up that has no use yet. */
const KEEP_HINTS: Record<string, string> = {
  rig_tire: 'A big rig tire. Far too big for the El Cajon, but something bigger will need it. Keep it',
};

// What the player has in their hands, shown low in front of the camera.
let carrying: PartKind | null = null;
const held = new THREE.Group();
held.position.set(0.42, -0.5, -1.15);
held.rotation.set(0.35, -0.6, 0);
camera.add(held);
scene.add(camera);
function holdPart(kind: PartKind | null) {
  held.clear();
  carrying = kind;
  if (!kind) return;
  const model = createPartModel(car, kind);
  model.scale.setScalar(Math.min(1, 0.5 / partSize(model)));
  model.traverse((o) => (o.castShadow = false));
  held.add(model);
}

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (hud.isTradeOpen()) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function readInput(): DriveInput {
  const up = keys.has('KeyW') || keys.has('ArrowUp');
  const down = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  return {
    throttle: (up ? 1 : 0) - (down ? 1 : 0),
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    brake: keys.has('Space') ? 1 : 0, // handbrake
  };
}

function readWalkInput() {
  if (hud.isTradeOpen()) return { forward: 0, right: 0, run: false };
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  return { forward: f, right: r, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

// Game state: where you are, what you carry, which containers have been looted.
type Mode = 'walking' | 'driving';
let mode: Mode = 'walking';
// In the truck you sit in the driver's seat (you drive) or the passenger seat (you only ride).
let seat: 'driver' | 'passenger' = 'driver';
let hoodOpen = false;
let hoodAmount = 0; // 0 shut, 1 fully open: eases toward hoodOpen
// Doors swing open when you use them and shut again a moment later. The tailgate drops while you work at the bed.
const DOOR_HOLD = 1.6; // seconds a door stays open
// open: left open on purpose, for working on the truck. hold: seconds left of a door that opened by itself.
const doorState = { 1: { amount: 0, hold: 0, open: false }, [-1]: { amount: 0, hold: 0, open: false } };
function swingDoor(side: 1 | -1) {
  doorState[side].open = false;
  doorState[side].hold = DOOR_HOLD;
}
/** While the truck is being put together, a door can be opened and left open to reach the inside. */
function toggleDoor(side: 1 | -1) {
  const d = doorState[side];
  d.open = !d.open;
  d.hold = 0;
  say(`${d.open ? 'Opened' : 'Closed'} the ${side > 0 ? "driver's" : 'passenger'} door`);
}
const doorLabel = (side: 1 | -1) => (side > 0 ? "driver's" : 'passenger');
let tailgateOpen = false;
let tailgateAmount = 0;
function ease(value: number, goal: number, step: number): number {
  return value + Math.sign(goal - value) * Math.min(Math.abs(goal - value), step);
}
const walker: Walker = { x: playerSpawn.x, z: playerSpawn.z, yaw: playerSpawn.yaw, pitch: 0 };
const inventory = createInventory();
hud.setInventory(inventory);
// The El Cajon's bed: it holds items for as long as the game runs, and stays with the truck.
const bed = createStorage();
bedView.update(bed);
const survival = createSurvival();
// Clicking a food or drink in the pack eats or drinks it.
hud.setConsumeHandler((index) => {
  const slot = inventory.slots[index];
  const r = consumeSlot(survival, inventory, index);
  if (r.ok) {
    say(`${ITEMS[r.itemId].kind === 'food' ? 'Ate' : 'Drank'} ${ITEMS[r.itemId].name}`);
    hud.setInventory(inventory);
  } else if (r.reason === 'full' && slot) {
    say(ITEMS[slot.id].kind === 'food' ? 'Not hungry' : 'Not thirsty');
  } else if (r.reason === 'inedible') {
    say('That is not food or drink');
  }
});
const containerStates = new Map(allContainers.map((c) => [c.id, newContainerState(c.kind, c.fixedLoot)]));
function say(text: string) {
  hud.toast(text);
}
const PARKED: DriveInput = { throttle: 0, steer: 0, brake: 1 }; // handbrake on while you are out of the truck

let sim: CarSim = await createRapierSim(worldSpec);
let resetting = false;
/** 'town' puts you and the truck back at the town. 'lab' puts the truck on the open test field for the performance run. */
async function reset(kind: 'town' | 'lab' = 'town') {
  if (resetting) return;
  resetting = true;
  sim = await createRapierSim(kind === 'town' ? worldSpec : { ...worldSpec, carSpawn: { x: townSite.x + 100, z: townSite.z, yaw: 0 }, buildBoxes: [] });
  prev = curr = takeSnapshot();
  camReady = false;
  if (kind === 'town') {
    mode = 'walking';
    Object.assign(walker, { x: playerSpawn.x, z: playerSpawn.z, yaw: playerSpawn.yaw, pitch: 0 });
  } else {
    mode = 'driving';
    seat = 'driver';
  }
  resetting = false;
}

// Fly mode (G): a free camera for testing and looking around. G again goes back to where you were.
let flying = false;
const fly = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
let flySpeed = 40; // metres per second
const flyForward = new THREE.Vector3();
const flyRight = new THREE.Vector3();
const flyEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function toggleFly(landHere = false) {
  if (bench.active) return;
  if (!flying) {
    flying = true;
    unloading = false;
    fly.x = camera.position.x;
    fly.y = camera.position.y;
    fly.z = camera.position.z;
    flyEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    fly.yaw = flyEuler.y;
    fly.pitch = flyEuler.x;
    say('Fly mode: W/A/S/D fly, Q/E down and up, Shift faster, T land here, G back');
    return;
  }
  flying = false;
  camReady = false;
  if (landHere) {
    Object.assign(walker, { x: fly.x, z: fly.z, pitch: 0 });
    mode = 'walking';
    say('Landed');
  } else {
    say('Fly mode off');
  }
}

function stepFly(dt: number) {
  flyEuler.set(fly.pitch, fly.yaw, 0);
  camera.quaternion.setFromEuler(flyEuler);
  flyForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  flyRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 1;
  const move = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const lift = (keys.has('KeyE') || keys.has('Space') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  const v = flySpeed * fast * dt;
  fly.x += (flyForward.x * move + flyRight.x * strafe) * v;
  fly.y += (flyForward.y * move + flyRight.y * strafe + lift) * v;
  fly.z += (flyForward.z * move + flyRight.z * strafe) * v;
  fly.y = Math.max(fly.y, ground.height(fly.x, fly.z) + 1); // do not fly into the ground
  camera.position.set(fly.x, fly.y, fly.z);
}
window.addEventListener(
  'wheel',
  (e) => {
    if (flying) flySpeed = Math.min(2000, Math.max(3, flySpeed * Math.exp(-e.deltaY * 0.0012)));
  },
  { passive: true },
);

// The map (M): the island with every road and place, a small one always in the corner and a big one on M.
// The picture is baked once; each redraw only adds the place markers and where you are. Clicking the big
// map travels there, for testing. N makes a new random world, [ and ] step the seed, like the /world/ viewer.
const mapBase = (() => {
  const terrain = document.createElement('canvas');
  paintMap(worldMap, terrain);
  const w = terrain.width * 2; // twice the grid, so the roads stay crisp on the big map
  const baked = document.createElement('canvas');
  baked.width = w;
  baked.height = w;
  const ctx = baked.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terrain, 0, 0, w, w);
  paintRoads(worldMap, network, ctx, w);
  return baked;
})();
const mapOverlay = createMapOverlay(document.body, {
  base: mapBase,
  worldSize: WORLD.size,
  places: displayPlaces,
  districts: network.neighborhoods?.map(n => n.town.center),
  onJump: (x, z) => {
    mapOverlay.close();
    if (flying) {
      Object.assign(fly, { x, z, y: Math.max(ground.surface(x, z), 0) + 200 });
      say('Flew there (testing)');
      return;
    }
    mode = 'walking';
    camReady = false;
    Object.assign(walker, { x, z, pitch: 0 });
    say('Travelled there (testing)');
  },
});

// Mouse look: click the page to capture the mouse, Esc to release it.
const UP = new THREE.Vector3(0, 1, 0);
const CAM_DISTANCE = 9;
const DEFAULT_PITCH = 0.3; // radians above the horizon
const LOOK_SENSITIVITY = 0.0025; // radians per pixel
const LOOK_RECENTER_AFTER_MS = 2500;
let lookYaw = 0; // radians around the car, 0 is straight behind
let lookPitch = DEFAULT_PITCH;
let lastLook = 0;

renderer.domElement.addEventListener('click', () => {
  if (hud.isTradeOpen()) return;
  void renderer.domElement.requestPointerLock();
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (flying) {
    fly.yaw -= e.movementX * LOOK_SENSITIVITY;
    fly.pitch = Math.min(1.5, Math.max(-1.5, fly.pitch - e.movementY * LOOK_SENSITIVITY));
    return;
  }
  if (mode === 'walking') {
    lookWalker(walker, e.movementX, e.movementY, LOOK_SENSITIVITY);
    return;
  }
  lookYaw -= e.movementX * LOOK_SENSITIVITY;
  lookPitch = Math.min(1.3, Math.max(0.05, lookPitch + e.movementY * LOOK_SENSITIVITY));
  lastLook = performance.now();
});

// Physics runs at a fixed 60 steps a second but the screen may draw 144 frames a second.
// Each frame we draw the car at a blend between the last two physics states, otherwise the
// car only moves on some frames and the whole world looks like it is shaking at high speed.
interface Snapshot {
  chassisPos: THREE.Vector3;
  chassisQuat: THREE.Quaternion;
  wheelPos: THREE.Vector3[];
  wheelQuat: THREE.Quaternion[];
}
function takeSnapshot(): Snapshot {
  const c = sim.chassis();
  const w = sim.wheels();
  return {
    chassisPos: new THREE.Vector3(...c.position),
    chassisQuat: new THREE.Quaternion(...c.quaternion),
    wheelPos: w.map((x) => new THREE.Vector3(...x.position)),
    wheelQuat: w.map((x) => new THREE.Quaternion(...x.quaternion)),
  };
}
let prev = takeSnapshot();
let curr = prev;

// Performance run (B key) and live frame statistics.
function gpuName(): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown (browser hides it)';
}
function truckObb(): Obb2 {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(car.body.quaternion);
  return {
    x: car.body.position.x,
    z: car.body.position.z,
    hx: CAR.halfExtents[0],
    hz: CAR.halfExtents[2],
    yaw: Math.atan2(f.x, f.z),
  };
}

let currentTarget: Target | null = null;

/** fromOutside: opened at the bed, so the tailgate drops. Opened from a seat (Tab), the tailgate stays up. */
function openBed(fromOutside = true) {
  tailgateOpen = fromOutside;
  document.exitPointerLock(); // the mouse is needed to click items across
  hud.openStorage('El Cajon bed', bed, inventory, (from, index) => {
    const src = from === 'store' ? bed : inventory;
    const dst = from === 'store' ? inventory : bed;
    const what = describeMove(src, index);
    const r = moveStack(src, index, dst);
    if (r.moved === 0) say(r.reason === 'full' ? (from === 'store' ? 'Your pack is full' : 'The bed is full') : 'Nothing there');
    else say(`${from === 'store' ? 'Took' : 'Put in the bed:'} ${what}`);
    hud.setInventory(inventory);
    bedView.update(bed);
    hud.refreshStorage();
  });
}
function closeBed() {
  tailgateOpen = false;
  hud.closeStorage();
}

function switchSeat() {
  if (mode !== 'driving' || bench.active) return;
  if (seat === 'passenger') {
    seat = 'driver';
    say("Switched to the driver's seat");
  } else if (Math.abs(sim.speed()) > 3) {
    say('Slow down to switch seats');
  } else {
    seat = 'passenger';
    say('Switched to the passenger seat');
  }
}

/** Tab in the truck: your pack and the truck's storage together. Out of the truck it is just your pack. */
function toggleCarStorage() {
  if (hud.isStorageOpen()) closeBed();
  else openBed(false);
}

function interact() {
  if (hud.isTradeOpen()) {
    hud.closeTrade();
    return;
  }
  if (hud.isStorageOpen()) {
    closeBed();
    return;
  }
  if (bench.active || unloading) return;
  if (mode === 'driving') {
    if (Math.abs(sim.speed()) > 3) {
      say('Slow down to get out');
      return;
    }
    getOutOfTruck();
    return;
  }
  const target = currentTarget;
  if (!target) {
    if (carrying) dropPart();
    return;
  }
  if (target.kind === 'trader') {
    if (carrying) {
      say('Put down the part before trading');
      return;
    }
    closeBed();
    mapOverlay.close();
    keys.clear();
    document.exitPointerLock();
    hud.openTrade(startingTrader, inventory);
    return;
  }
  if (target.kind === 'pickup') {
    const pick = pickups.find((p) => p.id === target.id);
    if (!pick) return;
    if (addItem(inventory, pick.item, 1) > 0) {
      say('Your pack is full');
      return;
    }
    scene.remove(pick.model);
    pickups.splice(pickups.indexOf(pick), 1);
    hud.setInventory(inventory);
    say(KEEP_HINTS[pick.item] ?? `Took the ${ITEMS[pick.item].name}`);
    return;
  }
  if (target.kind === 'part') {
    const part = looseParts.find((p) => p.id === target.id);
    if (!part) return;
    if (carrying) {
      say(`Your hands are full: put the ${PARTS[carrying].name} down first`);
      return;
    }
    scene.remove(part.model);
    looseParts.splice(looseParts.indexOf(part), 1);
    holdPart(part.kind);
    say(`Picked up the ${PARTS[part.kind].name}. Take it to the El Cajon`);
    return;
  }
  if (target.kind === 'truck') {
    const zone = truckZone(truckObb(), walker.x, walker.z);
    if (carrying) {
      // The engine and battery go in under the hood: with the hood on and shut, E opens it first.
      if (zone === 'hood' && needsHoodOpen(carrying)) {
        hoodOpen = true;
        say('Opened the hood');
        return;
      }
      fitCarried();
      return;
    }
    const action = truckAction(zone);
    if (action.kind === 'hood') {
      hoodOpen = !hoodOpen;
      say(hoodOpen ? 'Opened the hood' : 'Closed the hood');
      return;
    }
    if (action.kind === 'door') {
      toggleDoor(action.side);
      return;
    }
    if (action.kind === 'bed') {
      openBed();
      return;
    }
    if (action.kind === 'look') {
      say(`It won't go anywhere like this. Missing: ${describeMissing(carBuild)}`);
      return;
    }
    mode = 'driving';
    seat = action.seat;
    swingDoor(seat === 'driver' ? 1 : -1);
    hoodOpen = false; // shut the hood before going anywhere
    if (seat === 'passenger') say("Passenger seat: you can't drive from here. Press C to switch to the driver's seat");
    camReady = false;
    lookYaw = 0;
    lookPitch = DEFAULT_PITCH;
    return;
  }
  const state = containerStates.get(target.id);
  if (!state) return;
  const result = openContainer(state, SEED, target.id, inventory);
  if (result.taken.length > 0) {
    say(`Took ${describeStacks(result.taken)}${result.leftBehind ? ' (inventory full, some left)' : ''}`);
  } else if (result.leftBehind) {
    say('Inventory full');
  } else {
    say('Empty');
  }
  hud.setInventory(inventory);
  if (!result.leftBehind) for (const view of townViews) view.markOpened(target.id);
}

/** Does this part go in under the hood, with the hood on and shut? */
function needsHoodOpen(kind: PartKind): boolean {
  return UNDER_HOOD.includes(kind) && carBuild.hood > 0 && !hoodOpen && carBuild[kind] < PARTS[kind].count;
}

/** What E does at each part of the truck when your hands are empty. The hood and doors work once they are on. */
type TruckAction = { kind: 'hood' } | { kind: 'door'; side: 1 | -1 } | { kind: 'bed' } | { kind: 'enter'; seat: 'driver' | 'passenger' } | { kind: 'look' };
function truckAction(zone: TruckZone): TruckAction {
  const complete = isComplete(carBuild);
  if (zone === 'hood') return carBuild.hood > 0 ? { kind: 'hood' } : { kind: 'look' };
  if (zone === 'bed') return complete ? { kind: 'bed' } : { kind: 'look' };
  const side = zone === 'driver_door' ? 1 : -1;
  if (complete) return { kind: 'enter', seat: side > 0 ? 'driver' : 'passenger' };
  return carBuild[side > 0 ? 'driver_door' : 'passenger_door'] > 0 ? { kind: 'door', side } : { kind: 'look' };
}

/** Bolts the part in your hands onto the El Cajon, if it can go on. */
function fitCarried() {
  if (!carrying) return;
  const kind = carrying;
  const result = fitPart(carBuild, kind, inventory, hoodOpen);
  if (!result.ok) {
    say(result.reason);
    return;
  }
  if (kind === 'wheel') {
    // The wheel goes on the bare hub nearest to you.
    let best = -1;
    let bestDist = Infinity;
    car.wheels.forEach((wheel, i) => {
      const d = Math.hypot(wheel.position.x - walker.x, wheel.position.z - walker.z);
      if (!wheelOn[i] && d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    if (best >= 0) wheelOn[best] = true;
  }
  holdPart(null);
  showCarBuild();
  const name = PARTS[kind].name;
  say(isComplete(carBuild) ? `Bolted on the ${name}. The El Cajon is whole again: E to get in` : `Bolted on the ${name}. Still missing: ${describeMissing(carBuild)}`);
}

/** Puts what you are carrying down on the ground in front of you. */
function dropPart() {
  if (!carrying) return;
  const x = walker.x + Math.sin(walker.yaw) * 1.3;
  const z = walker.z + Math.cos(walker.yaw) * 1.3;
  layPart(carrying, x, z, walker.yaw);
  say(`Put the ${PARTS[carrying].name} down`);
  holdPart(null);
}

// Unloading containers. The truck carries containers; pull up, press U, get out, and put them down where you want
// them. The crosshair shows exactly where the next one will land, in green if it can go there and red if not,
// with the reason. Right-click picks a container back up onto the truck, so a mistake costs nothing.
// Same snapping and support rules as the /base/ page (src/rules/baseBuild.ts), plus: flat ground only, and not
// through buildings, the truck or yourself (src/rules/baseWorld.ts).
// The truck starts empty and so does the base, like the story: containers come from the docks, later, loaded onto the
// big rig. For testing only, ?cargo=ft20,ft40,ft20 puts those containers on the truck.
const cargo: ShippingKind[] = (params.get('cargo') ?? '')
  .split(',')
  .filter((k): k is ShippingKind => k === 'ft20' || k === 'ft40');
let unloading = false;
let cargoIndex = 0; // which container on the truck is next
let buildRot: Rotation = 0;
let buildLevel = 0;
let buildSpec: PieceSpec | null = null;
let buildPlan: PlacePlan | null = null;
let buildProblem: string | null = null;
const UNLOAD_NEAR = 7; // metres from the truck to start unloading
const UNLOAD_FAR = 45; // metres from the truck beyond which unloading ends by itself
const BUILD_REACH = 28; // metres the crosshair reaches
const buildRay = new THREE.Raycaster();
buildRay.far = BUILD_REACH;
const buildPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const buildPoint = new THREE.Vector3();
const screenCentre = new THREE.Vector2(0, 0);
const cargoName = (kind: ShippingKind) => `${SHIPPING.kinds[kind].name} container`;

function truckDistance(): number {
  return Math.hypot(walker.x - car.body.position.x, walker.z - car.body.position.z);
}

function canStartUnload(): boolean {
  if (bench.active || cargo.length === 0) return false;
  if (mode === 'driving') return seat === 'driver' && Math.abs(sim.speed()) <= 3;
  return truckDistance() <= UNLOAD_NEAR;
}

function getOutOfTruck() {
  swingDoor(seat === 'passenger' ? -1 : 1);
  const out = exitPosition(truckObb(), seat === 'passenger' ? -1 : 1);
  Object.assign(walker, { x: out.x, z: out.z, yaw: out.yaw, pitch: 0 });
  mode = 'walking';
}

function applyBuildChange() {
  baseView.sync(baseLayout);
  rebuildBuildSolids();
  worldSpec.buildBoxes = baseBoxes();
  sim.setBuildBoxes?.(worldSpec.buildBoxes);
  try {
    localStorage.setItem(GAME_BASE_STORAGE_KEY, serializeLayout(baseLayout));
  } catch {
    /* storage may be blocked; the base just will not be remembered */
  }
}

function changeBuildLevel(delta: number) {
  buildLevel = Math.min(SHIPPING.maxLevel, Math.max(0, buildLevel + delta));
}

function buildKeys(e: KeyboardEvent) {
  if (flying) return;
  if (e.code === 'KeyU') {
    if (unloading) {
      unloading = false;
      say('Finished unloading');
    } else if (!bench.active && cargo.length === 0) {
      say('There is nothing on the truck to unload');
    } else if (!canStartUnload()) {
      if (!bench.active) say(mode === 'driving' ? 'Slow down to unload' : 'Get closer to the truck to unload');
    } else {
      if (mode === 'driving') getOutOfTruck();
      unloading = true;
      cargoIndex = 0;
      say('Unloading: click to put the container down');
    }
    return;
  }
  if (!unloading) return;
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && Number(digit[1]) <= cargo.length) cargoIndex = Number(digit[1]) - 1;
  if (e.code === 'PageUp') changeBuildLevel(1);
  if (e.code === 'PageDown') changeBuildLevel(-1);
}

function updateBuild() {
  if (unloading && mode !== 'walking') unloading = false; // got into the truck, or the performance run started
  if (unloading && truckDistance() > UNLOAD_FAR) {
    unloading = false;
    say('Too far from the truck');
  }
  if (!unloading || bench.active) {
    buildSpec = null;
    buildPlan = null;
    baseView.setGhost(null, false);
    hud.setBuild(null);
    return;
  }
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  cargoIndex = Math.min(cargoIndex, cargo.length - 1);
  const kind = cargo[cargoIndex];
  const hit = baseView.pick(buildRay);
  buildSpec = null;
  if (hit) {
    buildSpec = aimToSpec(kind, buildRot, 0, { x: hit.point.x, y: hit.point.y - buildBaseY, z: hit.point.z }, hit.normal, hit.piece, buildLevel);
  } else {
    buildPlane.constant = -(buildBaseY + buildLevel * SHIPPING.height); // the plane at the height of that level
    if (buildRay.ray.intersectPlane(buildPlane, buildPoint) && buildPoint.distanceTo(buildRay.ray.origin) <= BUILD_REACH) {
      buildSpec = aimToSpec(kind, buildRot, 0, buildPoint, null, null, buildLevel);
    }
  }
  buildPlan = buildSpec ? planPlace(baseLayout, buildSpec) : null;
  buildProblem = null;
  if (buildSpec && buildPlan?.ok) {
    buildProblem = siteProblem([buildSpec, ...buildPlan.pillars], {
      groundHeight: (x, z) => ground.height(x, z) - buildBaseY, // the base is measured from the town's level ground
      solids: staticSolids,
      player: { x: walker.x, z: walker.z },
      truck: { x: car.body.position.x, z: car.body.position.z },
    });
  }
  const ok = !!buildPlan?.ok && buildProblem === null;
  baseView.setGhost(buildSpec, ok, buildPlan?.pillars ?? []);
  let status = 'Aim at the ground, or at a container to stack beside or on top of it';
  if (buildSpec && buildPlan) {
    const pillars = buildPlan.pillars.length > 0 ? `  +${buildPlan.pillars.length} pillars` : '';
    status = buildProblem ?? (buildPlan.ok ? `Click to put it down: level ${buildSpec.level}${pillars}` : (buildPlan.reason ?? ''));
  }
  hud.setBuild({
    title: `On the truck: ${cargo.length}`,
    items: cargo.map((k, i) => ({ name: cargoName(k), selected: i === cargoIndex })),
    level: buildLevel,
    status,
    ok: ok || !buildSpec,
  });
}

function buildPlace() {
  if (!buildSpec || !buildPlan) return;
  if (!buildPlan.ok) return say(buildPlan.reason ?? 'Cannot put it down here');
  if (buildProblem) return say(buildProblem);
  addPiece(baseLayout, buildSpec, true);
  cargo.splice(cargoIndex, 1);
  cargoIndex = Math.max(0, Math.min(cargoIndex, cargo.length - 1));
  applyBuildChange();
  if (cargo.length === 0) {
    unloading = false;
    say('The truck is unloaded');
  } else {
    say(`Put down. ${cargo.length} left on the truck`);
  }
}

function buildRemove() {
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  const hit = baseView.pick(buildRay);
  if (!hit) return;
  const check = checkRemove(baseLayout, hit.piece.id);
  if (!check.ok) return say(check.reason ?? 'Cannot pick that up');
  const kind = hit.piece.kind;
  removePiece(baseLayout, hit.piece.id);
  if (kind !== 'pillar') {
    cargo.push(kind);
    say(`Picked the ${cargoName(kind)} back up onto the truck`);
  }
  applyBuildChange();
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!unloading || mode !== 'walking' || bench.active) return;
  if (document.pointerLockElement !== renderer.domElement) return; // the first click only captures the mouse
  if (e.button === 0) buildPlace();
  if (e.button === 2) buildRemove();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    if (!unloading) return;
    e.preventDefault();
    changeBuildLevel(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);
// For tests and screenshots.
(window as unknown as { __game: unknown }).__game = {
  baseLayout,
  cargo,
  walker,
  unload: () => buildKeys({ code: 'KeyU' } as KeyboardEvent),
  place: buildPlace,
  remove: buildRemove,
  changeBuildLevel,
  isUnloading: () => unloading,
  toggleFly,
  isFlying: () => flying,
  world: () => ({ spawn: playerSpawn, town: townSite, stats: worldMap.stats, tiles: terrainTiles.built, drawn: terrainTiles.drawn, props: props.length }),
  network, // the road network, for tests and screenshots
  places: displayPlaces,
  ground: ground.height,
  setFly: (x: number, y: number, z: number, yaw: number, pitch: number) => Object.assign(fly, { x, y, z, yaw, pitch }),
  truck: () => ({ x: car.body.position.x, z: car.body.position.z }),
  town,
  startingTrader,
  settlements,
  settlementPlaces,
  inventory,
  bed,
  openBed,
  storageOpen: () => hud.isStorageOpen(),
  seat: () => seat,
  hoodOpen: () => hoodOpen,
  hoodAmount: () => hoodAmount,
  doorAmount: (side: 1 | -1) => doorState[side].amount,
  doorLatched: (side: 1 | -1) => doorState[side].open,
  tailgateAmount: () => tailgateAmount,
  refreshBed: () => bedView.update(bed),
  holdDoor: (side: 1 | -1, seconds: number) => {
    doorState[side].hold = seconds;
  },
  switchSeat,
  yardCargo: () => town.junkyard.cargo,
  carModel: car,
  carBuild,
  interact: () => interact(),
  target: () => currentTarget,
  carrying: () => carrying,
  looseParts: () => looseParts.map(({ id, kind, x, z, level }) => ({ id, kind, x, z, level })),
  pickups: () => pickups.map(({ id, item, x, z }) => ({ id, item, x, z })),
  wheelOn,
  mode: () => mode,
};

/** For testing: J puts you on foot on the street outside the junkyard gate, facing the yard. */
function jumpToTown() {
  if (bench.active) return;
  flying = false;
  unloading = false;
  mode = 'walking';
  camReady = false;
  Object.assign(walker, { x: town.junkyard.gateX, z: town.playerSpawn.z, yaw: Math.PI, pitch: 0 });
  say('Jumped to the town (testing)');
}

const bench = new Bench(
  {
    gpu: gpuName(),
    screen: `${window.innerWidth}x${window.innerHeight}`,
    props: props.length,
    terrain: `${WORLD.size / 1000} km world, drawn as tiles`,
    basePixelRatio,
  },
  (scale) => {
    renderScale = scale;
    applySize();
  },
  () => `${renderer.domElement.width}x${renderer.domElement.height}`,
);
window.addEventListener('keydown', (e) => {
  if (hud.isTradeOpen()) {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') hud.closeTrade();
    return;
  }
  if (e.code === 'Tab') e.preventDefault(); // Tab would otherwise move the page focus
  if (e.repeat) return;
  if (e.code === 'Tab' || e.code === 'KeyI') {
    if (mode === 'driving' && !bench.active && !flying) toggleCarStorage();
    else {
      hud.toggleInventory();
      if (hud.isInventoryOpen()) document.exitPointerLock(); // the mouse is needed to click food and drink
    }
  }
  if (e.code === 'KeyC') switchSeat();
  if (e.code === 'KeyV' && mode === 'driving' && !flying && sim.flipUpright) {
    sim.flipUpright();
    say('Flipped the truck back onto its wheels');
  }
  buildKeys(e);
  if (e.code === 'KeyR') {
    if (unloading) buildRot = buildRot === 0 ? 1 : 0;
    else void reset('town');
  }
  if (e.code === 'Escape') {
    closeBed();
    mapOverlay.close();
    if (hud.isInventoryOpen()) hud.toggleInventory();
  }
  if (e.code === 'KeyM') {
    mapOverlay.toggle();
    if (mapOverlay.isOpen()) document.exitPointerLock(); // the mouse is needed to click the map
  }
  if (e.code === 'KeyN') location.search = `?seed=${Math.floor(Math.random() * 100000)}`;
  if (e.code === 'BracketRight') location.search = `?seed=${SEED + 1}`;
  if (e.code === 'BracketLeft') location.search = `?seed=${SEED - 1}`;
  if (e.code === 'KeyG') toggleFly();
  if (e.code === 'KeyJ') jumpToTown();
  if (e.code === 'KeyT' && flying) toggleFly(true);
  if (e.code === 'KeyE' && !flying) interact();
  if (!flying && (e.code === 'KeyF' || e.code === 'KeyQ')) {
    const kind = e.code === 'KeyF' ? 'food' : 'drink';
    const r = consume(survival, inventory, kind);
    if (r.ok) {
      say(`${kind === 'food' ? 'Ate' : 'Drank'} ${ITEMS[r.itemId].name}`);
      hud.setInventory(inventory);
    } else {
      say(r.reason === 'full' ? (kind === 'food' ? 'Not hungry' : 'Not thirsty') : kind === 'food' ? 'Nothing to eat' : 'Nothing to drink');
    }
  }
  if (e.code === 'KeyX') benchPanel.style.display = 'none';
  if (e.code === 'KeyB') {
    if (bench.active) {
      bench.cancel();
    } else {
      benchPanel.style.display = 'none';
      void reset('lab').then(() => bench.start(performance.now()));
    }
  }
});

const recent: number[] = []; // last 5 seconds of frame times, for the live readout
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const back = new THREE.Vector3();
const CAM_HEADING_RATE = 6; // per second: how quickly the camera swings round behind the car
const CAM_HEIGHT_RATE = 8; // per second: smooths out small bumps in the car's height
let camHeading = 0;
let camY = 0;
let camReady = false;
let last = performance.now();
let accumulator = 0;
let fpsClock = last;
let liveText = '';

renderer.setAnimationLoop((now) => {
  const frameStart = performance.now();
  const frameMs = now - last;
  const dt = Math.min(frameMs / 1000, 0.1);
  accumulator += dt;
  last = now;

  recent.push(frameMs);
  while (recent.length > 300 || (recent.length > 30 && recent.reduce((s, v) => s + v, 0) > 5000)) recent.shift();

  if (bench.active) {
    mode = 'driving';
    seat = 'driver';
  }
  const input: DriveInput = bench.active ? scriptedInput(sim.speed()) : mode === 'driving' && seat === 'driver' && !flying ? readInput() : PARKED;
  const physicsStart = performance.now();
  while (accumulator >= STEP) {
    sim.step(STEP, input);
    prev = curr;
    curr = takeSnapshot();
    accumulator -= STEP;
  }
  sim.setFocus?.(curr.chassisPos.x, curr.chassisPos.z); // keep ground built under the truck as it travels
  const physicsMs = performance.now() - physicsStart;
  if (curr.chassisPos.y < -20) void reset(); // fell off the world

  const alpha = accumulator / STEP;
  car.body.position.lerpVectors(prev.chassisPos, curr.chassisPos, alpha);
  car.body.quaternion.slerpQuaternions(prev.chassisQuat, curr.chassisQuat, alpha);
  const sunX = flying ? fly.x : mode === 'walking' ? walker.x : car.body.position.x;
  const sunY = flying ? ground.height(fly.x, fly.z) : mode === 'walking' ? ground.height(walker.x, walker.z) : car.body.position.y;
  const sunZ = flying ? fly.z : mode === 'walking' ? walker.z : car.body.position.z;
  sun.target.position.set(sunX, sunY, sunZ);
  sun.position.set(sunX + 20, sunY + 32, sunZ + 14);
  car.wheels.forEach((wheel, i) => {
    wheel.position.lerpVectors(prev.wheelPos[i], curr.wheelPos[i], alpha);
    wheel.quaternion.slerpQuaternions(prev.wheelQuat[i], curr.wheelQuat[i], alpha);
    if (!wheelOn[i]) wheelBlocks[i].position.set(wheel.position.x, ground.height(wheel.position.x, wheel.position.z), wheel.position.z);
  });

  if (!bench.active && !flying) stepSurvival(survival, dt);
  hud.setNeeds(survival);
  const hoodGoal = hoodOpen ? 1 : 0;
  if (hoodAmount !== hoodGoal) {
    hoodAmount = ease(hoodAmount, hoodGoal, dt * 1.6);
    car.setHoodOpen(hoodAmount);
  }
  for (const side of [1, -1] as const) {
    const d = doorState[side];
    d.hold = Math.max(0, d.hold - dt);
    const goal = d.hold > 0 || d.open ? 1 : 0;
    if (d.amount !== goal) {
      d.amount = ease(d.amount, goal, dt * 2.5);
      car.setDoorOpen(side, d.amount);
    }
  }
  const gateGoal = tailgateOpen ? 1 : 0;
  if (tailgateAmount !== gateGoal) {
    tailgateAmount = ease(tailgateAmount, gateGoal, dt * 2);
    car.setTailgateOpen(tailgateAmount);
  }

  if (flying) {
    currentTarget = null;
    stepFly(dt);
  } else if (mode === 'walking') {
    // First person: walk, then look through the player's eyes.
    const stepFromX = walker.x;
    const stepFromZ = walker.z;
    stepWalker(walker, { ...readWalkInput(), speedScale: isWeak(survival) ? SURVIVAL.weakSpeedScale : 1 }, dt, walkSolids, [truckObb()]);
    const level = waterLevel(worldMap, walker.x, walker.z);
    if (level !== null && level - ground.surface(walker.x, walker.z) > 1.1) {
      walker.x = stepFromX; // too deep to wade: the water stops you (on a bridge deck you stay dry)
      walker.z = stepFromZ;
    }
    currentTarget = findTarget(walker, {
      containers: settlements.flatMap(s => reachableContainers(s, walker.x, walker.z)),
      truck: truckObb(),
      parts: looseParts.filter(onTop).map((p) => ({ id: p.id, x: p.x, z: p.z, hx: PART_REACH_BOX, hz: PART_REACH_BOX })),
      pickups: pickups.map((p) => ({ id: p.id, x: p.x, z: p.z, hx: 0.55, hz: 0.55 })),
      traders: town.junkyard.trader && insideWorkshop(town.junkyard, walker.x, walker.z) ? [{ ...town.junkyard.trader.counter, id: 0 }] : [],
    });
    const groundY = ground.surface(walker.x, walker.z);
    camera.position.set(walker.x, groundY + WALKER.eyeHeight, walker.z);
    camera.rotation.set(walker.pitch, walker.yaw + Math.PI, 0, 'YXZ'); // the camera looks down -Z, so turn it half way round
  } else {
    currentTarget = null;
    // Chase camera: rigidly behind the car, so it never lags or stretches at speed. Only the
    // heading and the height are smoothed. The mouse looks around the car. With no mouse
    // movement for a moment, the view drifts back to straight behind the car.
    if (now - lastLook > LOOK_RECENTER_AFTER_MS) {
      const k = 1 - Math.exp(-2 * dt);
      lookYaw -= lookYaw * k;
      lookPitch += (DEFAULT_PITCH - lookPitch) * k;
    }
    back.set(0, 0, 1).applyQuaternion(car.body.quaternion);
    const carHeading = Math.atan2(back.x, back.z);
    if (!camReady) {
      camHeading = carHeading;
      camY = car.body.position.y;
      camReady = true;
    }
    let diff = carHeading - camHeading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    camHeading += diff * (1 - Math.exp(-CAM_HEADING_RATE * dt));
    camY += (car.body.position.y - camY) * (1 - Math.exp(-CAM_HEIGHT_RATE * dt));

    back.set(-Math.sin(camHeading), 0, -Math.cos(camHeading)).applyAxisAngle(UP, lookYaw);
    camTarget.set(car.body.position.x, camY + 1, car.body.position.z);
    camPos
      .copy(camTarget)
      .addScaledVector(back, Math.cos(lookPitch) * CAM_DISTANCE)
      .setY(camTarget.y + Math.sin(lookPitch) * CAM_DISTANCE);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  terrainTiles.update(camera.position);
  baseView.group.visible = !bench.active;
  cargoView.group.visible = !bench.active;
  cargoView.update(camera);
  updateBuild();
  baseView.update(camera);
  renderer.render(scene, camera);
  const cpuMs = performance.now() - frameStart; // JavaScript time this frame; GPU time is not included

  if (bench.active) {
    bench.frame(now, frameMs, cpuMs, physicsMs, renderer.info.render.calls, renderer.info.render.triangles);
    if (!bench.active && bench.report) {
      benchPanel.textContent = formatReport(bench.report);
      benchPanel.style.display = 'block';
      console.log(formatReport(bench.report));
    }
  }

  if (now - fpsClock >= 500) {
    fpsClock = now;
    const s = summarizeFrames(recent);
    liveText = `${s.avgFps.toFixed(0)} fps   1% low ${s.onePercentLowFps.toFixed(0)}   cpu ${cpuMs.toFixed(1)} ms   draws ${renderer.info.render.calls}`;
    // The map follows where you are. yaw here is the map convention: 0 faces +Z, down the map.
    const mapX = flying ? fly.x : mode === 'walking' ? walker.x : car.body.position.x;
    const mapZ = flying ? fly.z : mode === 'walking' ? walker.z : car.body.position.z;
    let mapYaw = walker.yaw;
    if (flying) mapYaw = fly.yaw + Math.PI; // the fly camera's 0 faces -Z
    else if (mode === 'driving') {
      back.set(0, 0, 1).applyQuaternion(car.body.quaternion);
      mapYaw = Math.atan2(back.x, back.z);
    }
    mapOverlay.redraw(mapX, mapZ, mapYaw);
  }
  if (hud.isStorageOpen() && (flying || (mode === 'walking' && currentTarget?.kind !== 'truck'))) closeBed();
  if (hud.isTradeOpen() && (flying || mode !== 'walking' || currentTarget?.kind !== 'trader')) hud.closeTrade();
  hud.setMode(flying ? 'walking' : mode);
  hud.setSpeed(Math.abs(sim.speed()) * 3.6);
  if (bench.active) {
    hud.setPrompt(null);
    hud.setHint('');
    hud.setDebug(`${liveText}\nPERFORMANCE RUN: ${bench.phaseName()}, ${bench.remaining(now).toFixed(0)} s left (B cancels)`);
  } else {
    let prompt: { key: string; text: string } | null = null;
    if (hud.isStorageOpen() || hud.isTradeOpen()) {
      prompt = null;
    } else if (mode === 'walking' && currentTarget && !unloading) {
      if (currentTarget.kind === 'truck') {
        const zone = truckZone(truckObb(), walker.x, walker.z);
        if (carrying) {
          const check = checkFit(carBuild, carrying, inventory, hoodOpen);
          prompt =
            zone === 'hood' && needsHoodOpen(carrying)
              ? { key: 'E', text: `Open the hood (to fit the ${PARTS[carrying].name})` }
              : { key: 'E', text: check.ok ? `Bolt on the ${PARTS[carrying].name}` : check.reason };
        } else {
          const action = truckAction(zone);
          prompt = {
            key: 'E',
            text:
              action.kind === 'hood'
                ? hoodOpen
                  ? 'Close the hood'
                  : 'Open the hood'
                : action.kind === 'door'
                ? `${doorState[action.side].open ? 'Close' : 'Open'} the ${doorLabel(action.side)} door`
                : action.kind === 'bed'
                ? 'Open the bed'
                : action.kind === 'enter'
                ? action.seat === 'driver'
                  ? 'Get in the El Cajon (driver)'
                  : 'Get in the El Cajon (passenger seat)'
                : 'Look over the El Cajon',
          };
        }
      } else if (currentTarget.kind === 'trader') {
        prompt = { key: 'E', text: `Barter with ${startingTrader.name}` };
      } else if (currentTarget.kind === 'pickup') {
        const id = currentTarget.id;
        const pick = pickups.find((p) => p.id === id);
        const name = pick ? ITEMS[pick.item].name : 'thing';
        prompt = { key: 'E', text: pick?.item === 'rig_tire' ? `Take the ${name}   (too big for the El Cajon, but you'll want it later)` : `Take the ${name}` };
      } else if (currentTarget.kind === 'part') {
        const id = currentTarget.id;
        const part = looseParts.find((p) => p.id === id);
        const name = part ? PARTS[part.kind].name : 'part';
        prompt = { key: 'E', text: carrying ? `Hands full: carrying the ${PARTS[carrying].name}` : `Pick up the ${name}` };
      } else {
        const state = containerStates.get(currentTarget.id);
        const def = CONTAINERS[containersById.get(currentTarget.id)!.kind];
        const shelf = def.kind === 'market_shelf' || def.kind === 'hardware_shelf';
        prompt = { key: 'E', text: state?.opened ? `Take the rest from the ${def.name}` : shelf ? 'Search the shelf' : `Open the ${def.name}` };
      }
    } else if (mode === 'walking' && carrying && !unloading) {
      prompt = { key: 'E', text: `Put the ${PARTS[carrying].name} down` };
    } else if (mode === 'walking' && !unloading && canStartUnload()) {
      prompt = { key: 'U', text: 'Unload containers' };
    } else if (mode === 'driving' && seat === 'passenger') {
      prompt = { key: 'C', text: "Switch to the driver's seat   (you can't drive from here)" };
    } else if (mode === 'driving' && Math.abs(sim.speed()) <= 3) {
      prompt = cargo.length > 0 ? { key: 'U', text: 'Unload containers   (E: get out)' } : { key: 'E', text: 'Get out' };
    }
    hud.setPrompt(flying ? null : prompt);
    hud.setHint(
      flying
        ? 'FLY MODE (testing)   W/A/S/D fly   Q/E down and up   Shift faster   Wheel speed   T land here on foot   M map   G back'
        : unloading
        ? 'Click put down   Right-click pick up   R rotate   Wheel height   1-9 choose   W/A/S/D walk   U finish'
        : mode === 'walking'
        ? 'W/A/S/D walk   Shift run   E use   F eat   Q drink   Tab carrying   M map   U unload   R reset   J jump to town   G fly   B performance run   Click the page to look around, Esc to release'
        : seat === 'passenger'
        ? 'Passenger seat   C switch to driver   E get out   Tab storage   F eat   Q drink'
        : 'W gas   S brake/reverse   A/D steer   Space handbrake   V flip upright   E get out   C passenger seat   U unload   F eat   Q drink   Tab storage   M map   R reset   B performance run',
    );
    hud.setDebug(flying ? `${liveText}\nx ${fly.x.toFixed(0)}  z ${fly.z.toFixed(0)}  height ${fly.y.toFixed(0)} m  speed ${flySpeed.toFixed(0)} m/s` : liveText);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applySize();
});
