import { createRigRuntime } from './render/rigRuntime';
import { createFlatbed } from './render/flatbed';
import { containerLength, loadTrailerContainer, TRAILER, trailerSpawn } from './rules/trailer';
import { createRigWorkshop } from './ui/rigWorkshop';
import { distributeRigParts, rigSpawns } from './rules/rigBuild';
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
import { PROP_COLLIDER, type Prop } from './rules/scatter';
import { insideWorkshop, LOT, reachableContainers, salvageYardStops, settlementGrid } from './rules/town';
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
import { layoutBoxes, pieceBox, siteProblem, walkingSolids } from './rules/baseWorld';
import { aimWood, checkWood, containerShells, createWoodLayout, isBench, isOpening, loadWood, pickupBasicBench, placeWood, removeWood, woodBounds, woodBoxes, woodSurface, woodMaterials, WOOD_PARTS, type WoodKind, type WoodSpec } from './rules/woodBuild';
import { createWoodView } from './render/woodView';
import { createWoodBuildMenu } from './ui/woodBuildMenu';
import { createRemovalDialog } from './ui/removalDialog';
import { finishLoading, isLoading, setLoadingMessage } from './ui/loadingScreen';
import { craftBuildHammer } from './rules/buildHammer';
import { countItem } from './rules/inventory';
import { craftWoodTool, planeLog } from './rules/woodCraft';
import { chopTree, type HarvestTree } from './rules/treeHarvest';
import { hotbarIndex } from './rules/hotbar';

let woodMenu: ReturnType<typeof createWoodBuildMenu> | undefined;
let removalDialog: ReturnType<typeof createRemovalDialog> | undefined;
let woodBuilding = false;
let selectedWood: WoodKind = 'floor';
let woodTurn = 0;
let woodSpec: WoodSpec | null = null;
let woodProblem: string | null = null;
let walkingHeight: number | null = null;
let activeHotbar: number | null = null;
let activeHotbarItem: string | null = null;

// You wake up in the desert. Over the dune is a town: food and water in its boxes and stores, and in its junkyard
// the El Cajon, stripped, its parts lying round the yard. Find the wrench, carry the parts over one at a time and
// bolt them on, and it is yours to drive.
// On foot: W/A/S/D walk, Shift run, E use (pick up, bolt on, put down, open), mouse look.
// Driving: W/S gas and brake, A/D steer, Space handbrake.
// Unloading containers: pull up and press U. You get out and the crosshair shows where the next container goes.
// Click puts it down, right-click picks one back up onto the truck, R rotates, the mouse wheel (or PageUp/PageDown)
// sets the height, K chooses hauled containers, U finishes. 1-0 equip items from the ten-slot hotbar.
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
let rigDriving = false;
let rigWorkshop: ReturnType<typeof createRigWorkshop> | undefined;
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
setLoadingMessage('Building the island and salvage yards...');
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
const rigSources = distributeRigParts(settlements);
const remoteRigSpawns = rigSpawns(settlements);
const freightSources = destinations.filter(s => s.siteKind === 'dock').map(site => {
  const layout = createLayout();
  const fixtures = site.fixtures!.filter(f => f.height < 6).slice(0, 2);
  fixtures.forEach((fixture, i) => {
    const kind = i === 0 ? 'ft20' : 'ft10';
    const def = SHIPPING.kinds[kind];
    const piece = addPiece(layout, { kind, gx: Math.round(fixture.x / SHIPPING.cell - def.wide / 2),
      gz: Math.round(fixture.z / SHIPPING.cell - def.long / 2), level: 0, rot: 1, color: i });
    if (!piece) throw new Error(`Could not place dock container at ${fixture.x},${fixture.z}`);
  });
  site.fixtures = site.fixtures!.filter(f => !fixtures.includes(f));
  site.solids = site.solids.filter(s => !fixtures.some(f => f === s));
  return { layout, y: site.groundY!, view: createBaseView(16) };
});
for (const source of freightSources) {
  source.view.group.position.y = source.y;
  source.view.sync(source.layout);
  scene.add(source.view.group);
}
const flatbedSpawn = trailerSpawn(settlements);
const flatbed = createFlatbed(flatbedSpawn, ground.surface(flatbedSpawn.x, flatbedSpawn.z));
scene.add(flatbed.model);
let towingRig: typeof rigs[number] | null = null;
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
const propViews = createProps(props, ground.height);
propViews.forEach((o) => scene.add(o));
const townViews = settlements.map((s, i) => createTownView(s, s.groundY ?? (i === 0 ? townSite.height : settlementPlaces[i - 1].height), s.siteKind ? ground.height : undefined));
const harvestTrees: (HarvestTree & { prop?: Prop; townIndex?: number })[] = [
  ...props.filter(p => p.kind === 'tree').map(prop => ({ x: prop.x, z: prop.z, hits: 0, cut: false, prop })),
  ...settlements.flatMap((s, townIndex) => (s.trees ?? []).map(tree => ({ x: tree.x, z: tree.z, hits: 0, cut: false, townIndex }))),
];
scene.add(batchTownScenery(townViews));
for (const townView of townViews) {
  townView.group.traverse(object => {
    if (object instanceof THREE.Mesh) object.receiveShadow = true;
  });
  scene.add(townView.group);
}

// The player's base: saved in the browser (the game's own save, not the /base/ test page's). It is built on the town's level ground.
let buildBaseY = townSite.height;
const baseLayout = createLayout();
const woodLayout = createWoodLayout();
const WOOD_SAVE_KEY = `${GAME_BASE_STORAGE_KEY}.wood.v1`;
const containerSaveIds = new Map<number, number>();
try {
  loadLayout(baseLayout, localStorage.getItem(GAME_BASE_STORAGE_KEY), containerSaveIds);
  const savedHeight = localStorage.getItem(`${GAME_BASE_STORAGE_KEY}.height`);
  if (savedHeight !== null && Number.isFinite(Number(savedHeight))) buildBaseY = Number(savedHeight);
} catch {
  /* storage may be blocked; the game still works */
}
const baseView = createBaseView();
baseView.group.position.y = buildBaseY;
scene.add(baseView.group);
try {
  loadWood(woodLayout, baseLayout, localStorage.getItem(WOOD_SAVE_KEY), containerSaveIds);
} catch (error) {
  console.error('Could not restore wood buildings', error);
}
const woodView = createWoodView();
woodView.group.position.y = buildBaseY;
scene.add(woodView.group);
const modifiedContainers = () => new Set(woodLayout.pieces.flatMap(p => p.containerId === undefined ? [] : [p.containerId]));
baseView.sync(baseLayout, modifiedContainers());
woodView.sync(woodLayout, baseLayout);
// The shipping container standing in the junkyard: part of the world, drawn the same way as the base's containers,
// but kept apart from the base (not saved, not edited). Its walls are in town.solids, so you cannot walk or drive through it.
const cargoLayout = createLayout();
addPiece(cargoLayout, town.junkyard.cargo);
const cargoView = createBaseView(16);
cargoView.group.position.y = buildBaseY;
scene.add(cargoView.group);
cargoView.sync(cargoLayout);
/** The base's solid blocks, lifted to the height of the ground it stands on. */
const baseBoxes = () => [
  ...[...containerShells(baseLayout, woodLayout), ...woodBoxes(woodLayout)].map((box) => ({ ...box, y0: box.y0 + buildBaseY })),
  ...freightSources.flatMap(source => layoutBoxes(source.layout).map(box => ({ ...box, y0: box.y0 + source.y }))),
];
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
  walkSolids.splice(0, walkSolids.length, ...staticSolids);
  walkSolids.push(...freightSources.flatMap(source => walkingSolids(source.layout)));
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
  rig_tire: 'A big rig tire. Keep it for a stripped tractor at a remote salvage yard',
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
  if (isLoading() || hud.isTradeOpen() || hud.isPaused() || rigWorkshop?.isOpen() || woodMenu?.isOpen() || removalDialog?.isOpen()) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Equal' && !e.repeat) {
    autoRun = !autoRun;
    say(autoRun ? 'Auto run on (= or S to stop)' : 'Auto run off');
  }
  if (autoRun && (e.code === 'KeyS' || e.code === 'ArrowDown')) autoRun = false;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// The = key holds "forward" for you: running on foot, full throttle in the truck.
let autoRun = false;

function readInput(): DriveInput {
  const up = autoRun || keys.has('KeyW') || keys.has('ArrowUp');
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
  if (hud.isTradeOpen() || hud.isStorageOpen() || hud.isInventoryOpen()) return { forward: 0, right: 0, run: false };
  const f = (autoRun || keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  return { forward: f, right: r, run: autoRun || keys.has('ShiftLeft') || keys.has('ShiftRight') };
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
function useInventorySlot(index: number) {
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
}
hud.setConsumeHandler(useInventorySlot);
hud.setHotbarHandler(activateHotbar);
hud.setStorageCloseHandler(closeBed);
const containerStates = new Map(allContainers.map((c) => [c.id, newContainerState(c.kind, c.fixedLoot)]));
function say(text: string) {
  hud.toast(text);
}
const PARKED: DriveInput = { throttle: 0, steer: 0, brake: 1 }; // handbrake on while you are out of the truck

// Build the truck's physics world and the rig's at the same time instead of one after the other.
setLoadingMessage('Preparing vehicles and world physics...');
const [simInit, rigs] = await Promise.all([
  createRapierSim(worldSpec),
  Promise.all(remoteRigSpawns.map(spawn => createRigRuntime(worldSpec, spawn))),
]);
let sim: CarSim = simInit;
if (!rigs.length) throw new Error('No remote salvage-yard rigs were generated');
let rig = rigs[0];
const rigWorkshops = rigs.map(vehicle => {
  scene.add(vehicle.model);
  return createRigWorkshop({ build: vehicle.build, kind: vehicle.kind, pack: inventory, sources:rigSources,
  cargo: () => Math.hypot(car.body.position.x-vehicle.model.position.x, car.body.position.z-vehicle.model.position.z) <= 8 ? bed : undefined,
  changed: () => { vehicle.sync(); hud.setInventory(inventory); bedView.update(bed); },
  drive: () => { if (!vehicle.complete()) return; rig=vehicle; rigDriving=true; mode='driving'; seat='driver'; keys.clear(); autoRun=false; camReady=false; lookYaw=0; lookPitch=DEFAULT_PITCH; say(`${vehicle.name}: W/S drive, A/D steer, Space brake, E exit${vehicle.storage ? ', Tab cargo storage' : ''}`); },
  storage: vehicle.storage ? () => openBoxStorage(vehicle) : undefined,
  });
});

let resetting = false;
/** 'town' puts you and the truck back at the town. 'lab' puts the truck on the open test field for the performance run. */
async function reset(kind: 'town' | 'lab' = 'town') {
  if (resetting) return;
  rigDriving = false;
  rigWorkshop?.close();
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
  if (rigDriving) getOutOfTruck();
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
    if (flying && !hud.isPaused()) flySpeed = Math.min(2000, Math.max(3, flySpeed * Math.exp(-e.deltaY * 0.0012)));
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
    rigDriving = false;
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
  if (hud.isTradeOpen() || hud.isPaused() || rigWorkshop?.isOpen()) return;
  void renderer.domElement.requestPointerLock();
});
window.addEventListener('mousemove', (e) => {
  if (hud.isPaused() || document.pointerLockElement !== renderer.domElement) return;
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
let storageVehicle: typeof rigs[number] | null = null;

function openBoxStorage(vehicle: typeof rigs[number]) {
  if (!vehicle.storage || !vehicle.complete()) return say('Finish restoring the box truck before using its cargo storage');
  if (Math.abs(vehicle.physics.speed()) >= .7) return say('Stop before opening the cargo box');
  keys.clear(); autoRun = false;
  storageVehicle = vehicle;
  vehicle.setCargoOpen(true);
  document.exitPointerLock();
  const storage = vehicle.storage;
  hud.openStorage('Box truck cargo - 96 slots', storage, inventory, (from, index) => {
    const src = from === 'store' ? storage : inventory, dst = from === 'store' ? inventory : storage;
    const what = describeMove(src, index), result = moveStack(src, index, dst);
    if (!result.moved) say(result.reason === 'full' ? (from === 'store' ? 'Your pack is full' : 'The cargo box is full') : 'Nothing there');
    else say(`${from === 'store' ? 'Took' : 'Stored'} ${result.moved} ${what.replace(/^\d+ /, '')}`);
    hud.setInventory(inventory); hud.refreshStorage();
  });
}

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
    else say(`${from === 'store' ? 'Took' : 'Put in the bed:'} ${r.moved} ${what.replace(/^\d+ /, '')}${src.slots[index] ? ' (remainder did not fit)' : ''}`);
    hud.setInventory(inventory);
    bedView.update(bed);
    hud.refreshStorage();
  });
}
function closeBed() {
  storageVehicle?.setCargoOpen(false);
  storageVehicle = null;
  tailgateOpen = false;
  hud.closeStorage();
}

function switchSeat() {
  if (rigDriving) { say(`The ${rig.name} has one driving seat`); return; }
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
    if (Math.abs((rigDriving ? rig.physics : sim).speed()) > 3) {
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
  if (target.kind === 'rig') {
    if (carrying) { say('Put down the El Cajon part first'); return; }
    rig = rigs[target.id];
    rigWorkshop = rigWorkshops[target.id];
    autoRun = false;
    keys.clear(); document.exitPointerLock(); rigWorkshop.open(); return;
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
  .filter((k): k is ShippingKind => k === 'ft10' || k === 'ft20' || k === 'ft40');
const cargoColors: number[] = cargo.map(() => 0);
syncTrailerCargo();
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

const hammer = new THREE.Group();
const hammerMaterial = new THREE.MeshStandardMaterial({ color: 0x9b744c, roughness: .9 });
const hammerHandle = new THREE.Mesh(new THREE.BoxGeometry(.045, .38, .045), hammerMaterial);
const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(.2, .11, .11), hammerMaterial);
hammerHead.position.y = .19;
hammer.add(hammerHandle, hammerHead);
hammer.position.set(.35, -.3, -.65);
hammer.rotation.z = -.35;
hammer.visible = false;
camera.add(hammer);
removalDialog = createRemovalDialog();

woodMenu = createWoodBuildMenu({
  available: id => [inventory, ...nearBuildStorage()].reduce((n, source) => n + countItem(source, id), 0),
  canCraftTools: () => nearBench('basicbench') !== undefined,
  packBench() {
    const piece = nearBench('basicbench');
    if (!piece) return say('Stand beside your toolbox bench first');
    const result = pickupBasicBench(woodLayout, baseLayout, piece.id, inventory);
    say(result.message);
    if (result.ok) { applyBuildChange(); hud.setInventory(inventory); bedView.update(bed); }
    woodMenu?.refresh(inventory);
  },
  craftTool(id) {
    if (!nearBench('basicbench')) return say('Deploy a toolbox bench and stand beside it to craft tools');
    say(craftWoodTool(inventory, id).message);
    hud.setInventory(inventory);
    woodMenu?.refresh(inventory);
  },
  plane() {
    if (!nearPlanerBench()) return say('Stand beside your placed planer bench');
    say(planeLog(inventory).message);
    hud.setInventory(inventory);
    woodMenu?.refresh(inventory);
  },
  canPlane: () => nearPlanerBench(),
  cargo: () => ({
    items: cargo.map((kind, index) => ({ index, name: cargoName(kind) })),
    ready: canStartUnload(),
    reason: !towingRig ? 'Collect containers with the tractor and flatbed first' : 'Stop and stand near the hooked flatbed to place containers',
  }),
  selectContainer(index) {
    if (!canStartUnload()) return say('Stop and get closer to the hooked flatbed');
    woodBuilding = false;
    if (!unloading) buildKeys({ code: 'KeyU' } as KeyboardEvent);
    cargoIndex = index;
  },
  select: beginWoodBuild,
  craft() {
    const result = craftBuildHammer(inventory);
    say(result.message);
    hud.setInventory(inventory);
    woodMenu?.refresh(inventory);
  },
  stop() { woodBuilding = false; hammer.visible = false; },
  closed() { keys.clear(); autoRun = false; hud.setInventory(inventory); },
});

function beginWoodBuild(kind: WoodKind) {
  if (kind !== 'basicbench' && !countItem(inventory, 'build_hammer')) return say('Craft a build hammer first');
  selectedWood = kind;
  woodBuilding = true;
  unloading = false;
  autoRun = false;
  keys.clear();
  if (!baseLayout.pieces.size && !woodLayout.pieces.length) {
    buildBaseY = ground.surface(walker.x, walker.z);
    baseView.group.position.y = buildBaseY;
    woodView.group.position.y = buildBaseY;
  }
  say(`${WOOD_PARTS[kind].name}: aim at flat ground, left-click place, R rotate; click the game first to capture the mouse`);
}

function activateHotbar(index: number) {
  if (hud.isPaused() || hud.isStorageOpen() || hud.isTradeOpen() || woodMenu?.isOpen() || rigWorkshop?.isOpen() || mapOverlay.isOpen() || removalDialog?.isOpen()) return;
  if (mode !== 'walking' || flying || bench.active) return say('Get out on foot to equip a hotbar item');
  const slot = inventory.slots[index];
  if (!slot) {
    activeHotbar = null;
    activeHotbarItem = null;
    woodBuilding = false;
    unloading = false;
    hud.setActiveHotbar(null);
    return say('That hotbar slot is empty. Open inventory (Tab), click Assign, then press 1-0');
  }
  const item = ITEMS[slot.id];
  activeHotbar = index;
  activeHotbarItem = slot.id;
  hud.setActiveHotbar(index);
  woodBuilding = false;
  unloading = false;
  if (item.placeable) beginWoodBuild(item.placeable);
  else if (item.id === 'build_hammer') {
    say('Build hammer equipped - right-click a placed wood piece to remove; K opens the build menu');
  } else if (item.kind === 'food' || item.kind === 'drink') useInventorySlot(index);
  else say(item.id === 'axe' ? 'Axe equipped - face a tree and press E to chop' :
    item.kind === 'tool' ? `${item.name} equipped - E to use` : `${item.name}: building/crafting material (K menu)`);
}

function overlapFootprint(a: Box2, b: Box2): boolean {
  return Math.abs(a.x - b.x) < a.hx + b.hx - .02 && Math.abs(a.z - b.z) < a.hz + b.hz - .02;
}

function woodSiteProblem(spec: WoodSpec): string | null {
  const problem = checkWood(woodLayout, baseLayout, spec);
  if (problem) return problem;
  const b = woodBounds(spec);
  if (spec.containerId === undefined) {
    const obstacles = [...staticSolids, ...rigs.map(r => obbBounds(r.obb())), obbBounds(flatbed.obb()), truckObb(),
      ...freightSources.flatMap(s => layoutBoxes(s.layout))];
    if (obstacles.some(s => overlapFootprint(b, s))) return 'Something is in the way';
    for (const [x, z] of [[b.x - b.hx, b.z - b.hz], [b.x + b.hx, b.z + b.hz], [b.x - b.hx, b.z + b.hz], [b.x + b.hx, b.z - b.hz]]) {
      const terrain = ground.surface(x, z) - buildBaseY;
      if (spec.level === 0 && Math.abs(terrain - (isBench(spec.kind) ? b.y0 : 0)) > .25) return 'Find flatter ground for building';
      if (terrain > b.y0 + .25) return 'The terrain is in the way';
      const water = waterLevel(worldMap, x, z);
      if (water !== null && water > buildBaseY + b.y0) return 'Cannot build underwater';
    }
  }
  if (spec.kind !== 'floor' && spec.kind !== 'deck' &&
      Math.abs(walker.x - b.x) < b.hx + .4 && Math.abs(walker.z - b.z) < b.hz + .4 &&
      (walkingHeight ?? ground.surface(walker.x, walker.z)) < buildBaseY + b.y0 + b.height)
    return 'You are standing there';
  if (Object.entries(woodMaterials(spec.kind)).some(([id, n]) =>
    [inventory, ...nearBuildStorage()].reduce((count, source) => count + countItem(source, id), 0) < n))
    return spec.kind === 'basicbench' ? 'Need a portable toolbox bench in your pack or nearby vehicle' :
      spec.kind === 'workbench' ? 'Need 6 logs and a planer in your pack or nearby vehicle' : 'Not enough wood planks in your pack or nearby vehicle';
  return null;
}

function updateWoodBuild() {
  baseView.setGhost(null, false);
  hammer.visible = selectedWood !== 'basicbench';
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  const hit = baseView.pick(buildRay);
  woodSpec = null;
  if (hit) woodSpec = aimWood(selectedWood, { x: hit.point.x, y: hit.point.y - buildBaseY, z: hit.point.z },
    buildRot, hit.normal.y > .5 ? hit.piece.level + 1 : buildLevel,
    { id: hit.piece.id, normalX: hit.normal.x, normalZ: hit.normal.z }, baseLayout);
  else if (isBench(selectedWood) && buildLevel === 0) {
    for (let distance = .5; distance <= BUILD_REACH; distance += .2) {
      buildRay.ray.at(distance, buildPoint);
      if (buildPoint.y > ground.surface(buildPoint.x, buildPoint.z)) continue;
      woodSpec = aimWood(selectedWood, buildPoint, buildRot, 0);
      break;
    }
  } else {
    buildPlane.constant = -(buildBaseY + buildLevel * SHIPPING.height);
    if (buildRay.ray.intersectPlane(buildPlane, buildPoint) && buildPoint.distanceTo(buildRay.ray.origin) <= BUILD_REACH)
      woodSpec = aimWood(selectedWood, buildPoint, buildRot, buildLevel);
  }
  if (woodSpec && isBench(woodSpec.kind) && woodSpec.level === 0) {
    const b = woodBounds(woodSpec);
    woodSpec.y = ground.surface(b.x, b.z) - buildBaseY;
  }
  woodProblem = woodSpec ? woodSiteProblem(woodSpec) : 'Aim at the ground, a container wall or roof';
  if (woodSpec?.kind === 'stairs' && woodSpec.flip === undefined) woodSpec.flip = woodTurn >= 2;
  woodView.setGhost(woodSpec, woodProblem === null);
  hud.setBuild({ title: 'Construction / Placement',
    items: [{ name: WOOD_PARTS[selectedWood].name, selected: true }],
    materials: selectedWood === 'basicbench' ? undefined : Object.entries(woodMaterials(selectedWood)).map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' · '),
    hideLevel: isBench(selectedWood),
    level: buildLevel, status: woodProblem ?? 'Ready to place',
    ok: woodProblem === null });
}

function placeWoodBuild() {
  if (!woodSpec) return say('Aim at a building socket first');
  const problem = woodSiteProblem(woodSpec);
  if (problem) return say(problem);
  const result = placeWood(woodLayout, baseLayout, woodSpec, inventory, nearBuildStorage());
  say(result.message);
  if (result.ok) { applyBuildChange(); hud.setInventory(inventory); bedView.update(bed); }
}

function dismantleWoodBuild() {
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  const hit = woodView.pick(buildRay);
  if (!hit) return say('Aim at a wood piece to dismantle');
  if (hit.point.distanceTo(camera.position) > 3) return say('Get closer to remove this piece');
  const piece = woodLayout.pieces.find(p => p.id === hit.id);
  if (!piece) return say('That piece is no longer available');
  keys.clear();
  autoRun = false;
  document.exitPointerLock();
  removalDialog?.open(WOOD_PARTS[piece.kind].name,
    piece.kind === 'basicbench' ? 'The toolbox bench will return to your inventory so you can place it elsewhere.' :
      'This permanently dismantles the piece. Building materials are not refunded.',
    () => {
      if (mode !== 'walking' || flying || hit.point.distanceTo(camera.position) > 3)
        return say('Stand near the piece on foot to remove it');
      const current = woodLayout.pieces.find(p => p.id === hit.id);
      if (!current) return say('That piece is no longer available');
      if (current.kind === 'basicbench') {
        const result = pickupBasicBench(woodLayout, baseLayout, hit.id, inventory);
        say(result.message);
        if (result.ok) { applyBuildChange(); hud.setInventory(inventory); }
      } else {
        if (!countItem(inventory, 'build_hammer')) return say('Carry a build hammer to remove this piece');
        const problem = removeWood(woodLayout, baseLayout, hit.id);
        if (problem) return say(problem);
        applyBuildChange();
        say('Dismantled wood piece (no material refund)');
      }
    });
}

function isHammerEquipped() {
  return activeHotbar !== null && inventory.slots[activeHotbar]?.id === 'build_hammer';
}

function toggleWoodDoor(): boolean {
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  const hit = woodView.pick(buildRay);
  if (!hit || hit.point.distanceTo(camera.position) > 3) return false;
  const piece = woodLayout.pieces.find(p => p.id === hit.id);
  if (!piece || !isOpening(piece.kind)) return false;
  const b = woodBounds(piece);
  if (piece.open && Math.abs(walker.x - b.x) < b.hx + .4 && Math.abs(walker.z - b.z) < b.hz + .4) {
    say('Step clear before closing');
    return true;
  }

  piece.open = !piece.open;
  applyBuildChange();
  say(`${WOOD_PARTS[piece.kind].name} ${piece.open ? 'opened' : 'closed'}`);
  return true;
}

  function nearBench(kind: 'basicbench' | 'workbench') {
    if (mode !== 'walking' || flying) return undefined;
    return woodLayout.pieces.find(p => {
      if (p.kind !== kind) return false;
      const b = woodBounds(p);
      return Math.hypot(walker.x - b.x, walker.z - b.z) < 3 &&
        Math.abs((walkingHeight ?? ground.surface(walker.x, walker.z)) - (buildBaseY + b.y0)) < 1;
    });
  }

  function nearPlanerBench(): boolean { return nearBench('workbench') !== undefined; }

  function nearBuildStorage() {
    return [
      ...(Math.hypot(walker.x - car.body.position.x, walker.z - car.body.position.z) < 8 ? [bed] : []),
      ...rigs.flatMap(r => r.complete() && r.storage && Math.hypot(walker.x - r.model.position.x, walker.z - r.model.position.z) < 8 ? [r.storage] : []),
    ];
  }

  function targetedHarvestTree() {
    return harvestTrees.filter(t => {
      const dx = t.x - walker.x, dz = t.z - walker.z, distance = Math.hypot(dx, dz);
      return !t.cut && distance < 3 && Math.abs(ground.surface(t.x, t.z) - (walkingHeight ?? ground.surface(walker.x, walker.z))) < 2 &&
        (dx * Math.sin(walker.yaw) + dz * Math.cos(walker.yaw)) / Math.max(distance, .01) > .65;
    }).sort((a, b) => Math.hypot(a.x - walker.x, a.z - walker.z) - Math.hypot(b.x - walker.x, b.z - walker.z))[0];
  }

  function harvestTree(): boolean {
    if (currentTarget || carrying || mode !== 'walking' || flying) return false;
    const tree = targetedHarvestTree();
    if (!tree) return false;
    const result = chopTree(tree, inventory);
    say(result.message);
    if (result.felled) {
      if (tree.prop) {
        tree.prop.cut = true;
        for (const mesh of propViews) {
          if (!(mesh instanceof THREE.InstancedMesh)) continue;
          const list = mesh.userData.props as Prop[] | undefined;
          const index = list?.indexOf(tree.prop) ?? -1;
          if (index >= 0) { mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0)); mesh.instanceMatrix.needsUpdate = true; }
        }
      } else if (tree.townIndex !== undefined) townViews[tree.townIndex].removeTree(tree.x, tree.z);
      worldSpec.boxes = worldSpec.boxes.filter(b => !(b.x === tree.x && b.z === tree.z && 'tree' in b && b.tree));
      for (const town of settlements) town.solids = town.solids.filter(b => !(b.tree && b.x === tree.x && b.z === tree.z));
      for (let i = staticSolids.length - 1; i >= 0; i--)
        if (staticSolids[i].x === tree.x && staticSolids[i].z === tree.z && staticSolids[i].hx < .5 && staticSolids[i].hz < .5) staticSolids.splice(i, 1);
      sim.removeTree?.(tree.x, tree.z);
      for (const vehicle of rigs) vehicle.physics.removeTree?.(tree.x, tree.z);
      rebuildBuildSolids();
      hud.setInventory(inventory);
    }
    return true;
  }
function truckDistance(): number {
  return Math.hypot(walker.x - flatbed.model.position.x, walker.z - flatbed.model.position.z);
}

function canStartUnload(): boolean {
  if (bench.active || !towingRig) return false;
  if (mode === 'driving') return rigDriving && rig === towingRig && Math.abs(rig.physics.speed()) < .7;
  return truckDistance() <= UNLOAD_NEAR && Math.abs(towingRig.physics.speed()) < .7;
}

function hitchTrailer() {
  if (!rigDriving) return say('Drive a restored big rig to hook up the flatbed');
  if (rig.kind !== 'tractor') return say('The box truck carries item storage; use the tractor to tow the flatbed');
  if (Math.abs(rig.physics.speed()) >= .7) return say('Stop before changing the trailer hitch');
  if (towingRig) {
    if (towingRig !== rig) return say('The flatbed is attached to another rig');
    const pose = rig.physics.trailerPose?.();
    if (pose) flatbed.update(pose);
    rig.physics.detachTrailer?.();
    towingRig = null;
    flatbed.setAttached(false);
    flatbed.park(ground.surface);
    return say('Flatbed unhooked. Cargo stays on the trailer');
  }
  const hitch = new THREE.Vector3(0, TRAILER.rigHitchY, TRAILER.rigHitchZ)
    .applyQuaternion(rig.model.quaternion).add(new THREE.Vector3(...rig.pose().position));
  const angle = Math.atan2(Math.sin(rig.obb().yaw - flatbed.obb().yaw), Math.cos(rig.obb().yaw - flatbed.obb().yaw));
  if (hitch.distanceTo(flatbed.hitch()) > 1.8 || Math.abs(angle) > .5)
    return say('Back the rig under the flatbed kingpin, aligned and within 1.8 m');
  rig.physics.removeVehicleObstacle?.(100);
  rig.physics.attachTrailer!(flatbed.pose());
  towingRig = rig;
  flatbed.setAttached(true);
  syncTrailerCargo();
  say('Flatbed hooked up. Tow to the docks; U loads or unloads containers');
}

function syncTrailerCargo() {
  flatbed.syncCargo(cargo, cargoColors);
  towingRig?.physics.setTrailerCargo?.(cargo.map(containerLength));
}

function getOutOfTruck() {
  if (rigDriving) {
    const out = exitPosition(rig.obb());
    Object.assign(walker, {x:out.x,z:out.z,yaw:out.yaw,pitch:0});
    rigDriving=false; mode='walking'; keys.clear(); camReady=false; return;
  }
  swingDoor(seat === 'passenger' ? -1 : 1);
  const out = exitPosition(truckObb(), seat === 'passenger' ? -1 : 1);
  Object.assign(walker, { x: out.x, z: out.z, yaw: out.yaw, pitch: 0 });
  mode = 'walking';
}

function applyBuildChange() {
  baseView.sync(baseLayout, modifiedContainers());
  woodView.group.position.y = buildBaseY;
  woodView.sync(woodLayout, baseLayout);
  rebuildBuildSolids();
  worldSpec.buildBoxes = baseBoxes();
  sim.setBuildBoxes?.(worldSpec.buildBoxes);
  for (const vehicle of rigs) vehicle.physics.setBuildBoxes?.(worldSpec.buildBoxes);
  try {
    localStorage.setItem(GAME_BASE_STORAGE_KEY, serializeLayout(baseLayout));
    localStorage.setItem(`${GAME_BASE_STORAGE_KEY}.height`, String(buildBaseY));
    localStorage.setItem(WOOD_SAVE_KEY, JSON.stringify(woodLayout.pieces));
  } catch (error) {
    console.error('Could not save buildings', error);
    say('Buildings changed, but saving failed. They may be lost on reload');
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
    } else if (!canStartUnload()) {
      if (!bench.active) say(!towingRig ? 'Hook the big rig to the flatbed first' : 'Stop and get closer to the flatbed');
    } else {
      if (mode === 'driving') getOutOfTruck();
      if (!baseLayout.pieces.size && !woodLayout.pieces.length) {
        buildBaseY = ground.height(walker.x, walker.z);
        baseView.group.position.y = buildBaseY;
      }
      unloading = true;
      woodBuilding = false;
      cargoIndex = 0;
      autoRun = false;
      keys.clear();
      say('Flatbed: right-click a nearby container to load; left-click to place cargo. U finishes');
    }
    return;
  }
  if (!unloading) return;
  if (e.code === 'PageUp') changeBuildLevel(1);
  if (e.code === 'PageDown') changeBuildLevel(-1);
}

function updateBuild() {
  if (activeHotbar !== null && inventory.slots[activeHotbar]?.id !== activeHotbarItem) {
    activeHotbar = null;
    activeHotbarItem = null;
    woodBuilding = false;
    hud.setActiveHotbar(null);
  }
  if (woodBuilding && (mode !== 'walking' || flying || bench.active || selectedWood !== 'basicbench' && !countItem(inventory, 'build_hammer'))) woodBuilding = false;
  if (woodBuilding) {
    updateWoodBuild();
    return;
  }
  hammer.visible = isHammerEquipped() && mode === 'walking' && !flying && !bench.active;
  woodView.setGhost(null, false);
  if (unloading && mode !== 'walking') unloading = false; // got into the truck, or the performance run started
  if (unloading && (!towingRig || truckDistance() > UNLOAD_FAR)) {
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
  if (!cargo.length) {
    buildSpec = null; buildPlan = null;
    baseView.setGhost(null, false);
    hud.setBuild({ title: 'Trailer / Cargo', items: [], level: buildLevel,
      status: 'Empty. Collect a 10 ft or 20 ft container near the trailer.', ok: true,
      controls: [{ key: 'RMB', label: 'Collect' }, { key: 'U', label: 'Finish' }] });
    return;
  }
  cargoIndex = Math.min(cargoIndex, cargo.length - 1);
  const kind = cargo[cargoIndex];
  const hit = baseView.pick(buildRay);
  buildSpec = null;
  if (hit) {
    buildSpec = aimToSpec(kind, buildRot, cargoColors[cargoIndex] ?? 0, { x: hit.point.x, y: hit.point.y - buildBaseY, z: hit.point.z }, hit.normal, hit.piece, buildLevel);
  } else {
    buildPlane.constant = -(buildBaseY + buildLevel * SHIPPING.height); // the plane at the height of that level
    if (buildRay.ray.intersectPlane(buildPlane, buildPoint) && buildPoint.distanceTo(buildRay.ray.origin) <= BUILD_REACH) {
      buildSpec = aimToSpec(kind, buildRot, cargoColors[cargoIndex] ?? 0, buildPoint, null, null, buildLevel);
    }
  }
  buildPlan = buildSpec ? planPlace(baseLayout, buildSpec) : null;
  buildProblem = null;
  if (buildSpec && buildPlan?.ok) {
    buildProblem = siteProblem([buildSpec, ...buildPlan.pillars], {
      groundHeight: (x, z) => ground.height(x, z) - buildBaseY, // the base is measured from the town's level ground
      solids: [...staticSolids, ...freightSources.flatMap(s => layoutBoxes(s.layout)),
        ...woodLayout.pieces.map(woodBounds),
        ...rigs.map(r => obbBounds(r.obb())), obbBounds(flatbed.obb())],
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
    title: `Trailer / ${cargo.length} loaded`,
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
  if (!addPiece(baseLayout, buildSpec, true)) return say('The placement changed; aim again');
  cargo.splice(cargoIndex, 1);
  cargoColors.splice(cargoIndex, 1);
  syncTrailerCargo();
  cargoIndex = Math.max(0, Math.min(cargoIndex, cargo.length - 1));
  applyBuildChange();
  if (cargo.length === 0) {
    unloading = false;
    say('The flatbed is unloaded');
  } else {
    say(`Put down. ${cargo.length} left on the truck`);
  }
}

function buildRemove() {
  camera.updateMatrixWorld();
  buildRay.setFromCamera(screenCentre, camera);
  const candidates = [
    { hit: baseView.pick(buildRay), layout: baseLayout, y: buildBaseY },
    ...freightSources.map(source => ({ hit: source.view.pick(buildRay), layout: source.layout, y: source.y })),
  ].filter(candidate => candidate.hit !== null)
    .sort((a, b) => a.hit!.point.distanceTo(camera.position) - b.hit!.point.distanceTo(camera.position));
  const candidate = candidates[0];
  const hit = candidate?.hit;
  if (!hit) return;
  if (!towingRig || Math.abs(towingRig.physics.speed()) >= .7) return say('Hook up the flatbed and stop before loading');
  const box = pieceBox(hit.piece);
  if (Math.hypot(box.x - flatbed.model.position.x, box.z - flatbed.model.position.z) > 12)
    return say('Move the flatbed within 12 m of the container');
  const kind = hit.piece.kind;
  if (candidate.layout === baseLayout && woodLayout.pieces.some(p => p.containerId === hit.piece.id ||
      overlapFootprint(woodBounds(p), pieceBox(hit.piece)) && p.level > hit.piece.level))
    return say('Dismantle attached or supported wood pieces before collecting this container');
  if (kind !== 'pillar') {
    const result = loadTrailerContainer(candidate.layout, hit.piece.id, cargo, cargoColors);
    if (!result.ok) return say(result.message);
    syncTrailerCargo();
    say(result.message);
  } else {
    const check = checkRemove(candidate.layout, hit.piece.id);
    if (!check.ok) return say(check.reason ?? 'Cannot pick that up');
    removePiece(candidate.layout, hit.piece.id);
  }
  for (const source of freightSources) source.view.sync(source.layout);
  applyBuildChange();
}

function obbBounds(box: Obb2): Box2 {
  const c = Math.abs(Math.cos(box.yaw)), s = Math.abs(Math.sin(box.yaw));
  return { x: box.x, z: box.z, hx: c * box.hx + s * box.hz, hz: s * box.hx + c * box.hz };
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (removalDialog?.isOpen() || hud.isInventoryOpen() || hud.isStorageOpen() || hud.isTradeOpen() ||
    woodMenu?.isOpen() || rigWorkshop?.isOpen() || mapOverlay.isOpen()) return;
  if ((!unloading && !woodBuilding && !isHammerEquipped()) || mode !== 'walking' || flying || bench.active) return;
  if (hud.isPaused() || document.pointerLockElement !== renderer.domElement) return; // the first click only captures the mouse
  if (e.button === 2 && !unloading && (woodBuilding || isHammerEquipped())) {
    dismantleWoodBuild();
    return;
  }
  if (woodBuilding) {
    if (e.button === 0) placeWoodBuild();
    return;
  }
  if (!unloading) return;
  if (e.button === 0) buildPlace();
  if (e.button === 2) buildRemove();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    if ((!unloading && !woodBuilding) || hud.isPaused()) return;
    e.preventDefault();
    changeBuildLevel(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);
// For tests and screenshots.
(window as unknown as { __game: unknown }).__game = {
  baseLayout, activateHotbar,
  woodLayout, woodMenu, woodView, placeWoodBuild, toggleWoodDoor,
  woodBuilding: () => woodBuilding,
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
  rigs, rigSources, rigWorkshops, rigDriving: () => rigDriving,
  flatbed, freightSources, hitchTrailer, towingRig: () => rigs.indexOf(towingRig!), syncTrailerCargo,
  interact: () => interact(),
  target: () => currentTarget,
  carrying: () => carrying,
  looseParts: () => looseParts.map(({ id, kind, x, z, level }) => ({ id, kind, x, z, level })),
  pickups: () => pickups.map(({ id, item, x, z }) => ({ id, item, x, z })),
  wheelOn,
  mode: () => mode,
};

const yardStops = salvageYardStops(settlements);
let yardStopIndex = -1;
/** For testing: J cycles through the salvage yards, beginning with the starter yard. */
function jumpToSalvageYard() {
  if (bench.active) return;
  if (!yardStops.length) return say('No salvage yards available');
  yardStopIndex = (yardStopIndex + 1) % yardStops.length;
  rigDriving = false;
  flying = false;
  unloading = false;
  woodBuilding = false;
  walkingHeight = null;
  autoRun = false;
  keys.clear();
  closeBed();
  mapOverlay.close();
  currentTarget = null;
  mode = 'walking';
  camReady = false;
  Object.assign(walker, yardStops[yardStopIndex], { pitch: 0 });
  say(`Salvage yard ${yardStopIndex + 1}/${yardStops.length}${yardStopIndex === 0 ? ' - starting yard' : ''} (J: next yard)`);
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
function setPaused(paused: boolean) {
  keys.clear();
  hud.setPaused(paused);
  if (paused) document.exitPointerLock();
}
hud.setResumeHandler(() => setPaused(false));
window.addEventListener('blur', () => setPaused(true));
window.addEventListener('keydown', (e) => {
  if (isLoading()) return;
  if (removalDialog?.isOpen()) {
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); removalDialog.close(); }
    return;
  }
  if (woodMenu?.isOpen()) return;
  if (rigWorkshop?.isOpen()) {
    if (e.code === 'Escape' && !e.repeat) rigWorkshop.close();
    return;
  }
  if (hud.isPaused()) {
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); setPaused(false); }
    return;
  }
  if (e.code === 'Escape' && !e.repeat) {
    e.preventDefault();
    if (hud.isTradeOpen()) hud.closeTrade();
    else if (hud.isStorageOpen()) closeBed();
    else if (hud.isInventoryOpen()) hud.toggleInventory();
    else if (mapOverlay.isOpen()) mapOverlay.close();
    else setPaused(true);
    return;
  }
  if (hud.isTradeOpen()) {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') hud.closeTrade();
    return;
  }
  const hotbarSlot = hotbarIndex(e.code);
  if (hotbarSlot !== null && !e.repeat && !hud.isStorageOpen() && !mapOverlay.isOpen()) {
    e.preventDefault();
    if (hud.isInventoryOpen()) {
      if (!hud.assignHotbar(hotbarSlot)) say('Click Assign on an inventory item first, then press 1-0');
    } else activateHotbar(hotbarSlot);
    return;
  }
  if (e.code === 'KeyK' && !e.repeat) {
    if (mode !== 'walking' || flying || bench.active) return say('Get out on foot to craft or build');
    closeBed();
    mapOverlay.close();
    if (hud.isInventoryOpen()) hud.toggleInventory();
    unloading = false;
    keys.clear();
    autoRun = false;
    document.exitPointerLock();
    woodMenu?.open(inventory);
    return;
  }
  if (e.code === 'Tab') e.preventDefault(); // Tab would otherwise move the page focus
  if (e.repeat) return;
  if (e.code === 'Tab' || e.code === 'KeyI') {
    if (hud.isStorageOpen()) closeBed();
    else if (mode === 'driving' && rigDriving && rig.storage && !bench.active && !flying) {
      openBoxStorage(rig);
    } else if (mode === 'driving' && !rigDriving && !bench.active && !flying) toggleCarStorage();
    else {
      hud.toggleInventory();
      if (hud.isInventoryOpen()) {
        keys.clear(); autoRun = false;
        document.exitPointerLock(); // the mouse is needed to click food and drink
      }
    }
  }
  if (hud.isInventoryOpen()) return;
  if (hud.isStorageOpen()) { if (e.code === 'KeyE') closeBed(); return; }
  if (e.code === 'KeyC') switchSeat();
  if (e.code === 'KeyH') hitchTrailer();
  if (e.code === 'KeyV' && mode === 'driving' && !flying && sim.flipUpright) {
    if (rigDriving && towingRig === rig) say('Unhook the flatbed before flipping the rig');
    else {
      (rigDriving ? rig.physics : sim).flipUpright?.();
      say('Flipped the truck back onto its wheels');
    }
  }
  buildKeys(e);
  if (e.code === 'KeyR') {
    if (woodBuilding) {
      woodTurn = (woodTurn + 1) % 4;
      buildRot = woodTurn % 2 === 0 ? 0 : 1;
    } else if (unloading) buildRot = buildRot === 0 ? 1 : 0;
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
  if (e.code === 'KeyJ') jumpToSalvageYard();
  if (e.code === 'KeyT' && flying) toggleFly(true);
  if (woodBuilding && (e.code === 'PageUp' || e.code === 'PageDown')) changeBuildLevel(e.code === 'PageUp' ? 1 : -1);
  if (e.code === 'KeyE' && !flying) {
    if (mode === 'walking' && toggleWoodDoor()) return;
    if (!currentTarget && (nearPlanerBench() || nearBench('basicbench'))) {
      keys.clear();
      autoRun = false;
      document.exitPointerLock();
      woodMenu?.open(inventory);
      return;
    }
    if (!harvestTree()) interact();
  }
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
  if (!isLoading() && (hud.isPaused() || rigWorkshop?.isOpen() || woodMenu?.isOpen() || removalDialog?.isOpen())) { last = now; return; }
  const vehicleBody = rigDriving ? rig.model : car.body;
  const frameStart = performance.now();
  const frameMs = now - last;
  const dt = isLoading() ? 0 : Math.min(frameMs / 1000, 0.1);
  accumulator += dt;
  last = now;

  recent.push(frameMs);
  while (recent.length > 300 || (recent.length > 30 && recent.reduce((s, v) => s + v, 0) > 5000)) recent.shift();

  if (bench.active) {
    mode = 'driving';
    seat = 'driver';
  }
  const input: DriveInput = bench.active ? scriptedInput(sim.speed()) : mode === 'driving' && !rigDriving && seat === 'driver' && !flying && !hud.isStorageOpen() ? readInput() : PARKED;
  const physicsStart = performance.now();
  while (accumulator >= STEP) {
    const trailerObstacle = flatbed.obstacle(cargo.length > 0);
    rigs.forEach((vehicle, id) => {
      sim.setVehicleObstacle?.(vehicle.pose(), vehicle.half, id);
      vehicle.physics.setVehicleObstacle?.(sim.chassis(), CAR.halfExtents, rigs.length);
      rigs.forEach((other, otherId) => {
        if (other !== vehicle) vehicle.physics.setVehicleObstacle?.(other.pose(), other.half, otherId);
      });
      if (vehicle !== towingRig) vehicle.physics.setVehicleObstacle?.(trailerObstacle.pose, trailerObstacle.half, 100);
    });
    sim.setVehicleObstacle?.(trailerObstacle.pose, trailerObstacle.half, 100);
    sim.step(STEP, input);
    for (const vehicle of rigs) vehicle.step(STEP, vehicle === rig && rigDriving && !flying && !hud.isStorageOpen() ? readInput() : PARKED);
    const trailerPose = towingRig?.physics.trailerPose?.();
    if (trailerPose) flatbed.update(trailerPose);
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
  const sunX = flying ? fly.x : mode === 'walking' ? walker.x : vehicleBody.position.x;
  const sunY = flying ? ground.height(fly.x, fly.z) : mode === 'walking' ? ground.height(walker.x, walker.z) : vehicleBody.position.y;
  const sunZ = flying ? fly.z : mode === 'walking' ? walker.z : vehicleBody.position.z;
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
    const terrainY = ground.surface(walker.x, walker.z);
    walkingHeight = buildBaseY + woodSurface(woodLayout, baseLayout, walker.x, walker.z,
      (walkingHeight ?? terrainY) - buildBaseY, terrainY - buildBaseY);
    const buildingSolids = [...containerShells(baseLayout, woodLayout), ...woodBoxes(woodLayout)]
      .filter(b => b.y0 + buildBaseY < walkingHeight! + WALKER.eyeHeight &&
        b.y0 + b.height + buildBaseY > walkingHeight! + .35);
    stepWalker(walker, { ...readWalkInput(), speedScale: isWeak(survival) ? SURVIVAL.weakSpeedScale : 1 }, dt,
      [...walkSolids, ...buildingSolids], [truckObb(), flatbed.obb(), ...rigs.map(vehicle => vehicle.obb())]);
    const level = waterLevel(worldMap, walker.x, walker.z);
    if (level !== null && level - ground.surface(walker.x, walker.z) > 1.1) {
      walker.x = stepFromX; // too deep to wade: the water stops you (on a bridge deck you stay dry)
      walker.z = stepFromZ;
    }
    currentTarget = findTarget(walker, {
      containers: settlements.flatMap(s => reachableContainers(s, walker.x, walker.z)),
      truck: truckObb(),
      rigs: rigs.map((vehicle, id) => ({ ...vehicle.obb(), id })),
      parts: looseParts.filter(onTop).map((p) => ({ id: p.id, x: p.x, z: p.z, hx: PART_REACH_BOX, hz: PART_REACH_BOX })),
      pickups: pickups.map((p) => ({ id: p.id, x: p.x, z: p.z, hx: 0.55, hz: 0.55 })),
      traders: town.junkyard.trader && insideWorkshop(town.junkyard, walker.x, walker.z) ? [{ ...town.junkyard.trader.counter, id: 0 }] : [],
    });
    const groundY = buildBaseY + woodSurface(woodLayout, baseLayout, walker.x, walker.z,
      walkingHeight - buildBaseY, ground.surface(walker.x, walker.z) - buildBaseY);
    walkingHeight = groundY;
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
    back.set(0, 0, 1).applyQuaternion(vehicleBody.quaternion);
    const carHeading = Math.atan2(back.x, back.z);
    if (!camReady) {
      camHeading = carHeading;
      camY = vehicleBody.position.y;
      camReady = true;
    }
    let diff = carHeading - camHeading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    camHeading += diff * (1 - Math.exp(-CAM_HEADING_RATE * dt));
    camY += (vehicleBody.position.y - camY) * (1 - Math.exp(-CAM_HEIGHT_RATE * dt));

    back.set(-Math.sin(camHeading), 0, -Math.cos(camHeading)).applyAxisAngle(UP, lookYaw);
    camTarget.set(vehicleBody.position.x, camY + (rigDriving ? 2 : 1), vehicleBody.position.z);
    camPos
      .copy(camTarget)
      .addScaledVector(back, Math.cos(lookPitch) * (rigDriving ? 14 : CAM_DISTANCE))
      .setY(camTarget.y + Math.sin(lookPitch) * (rigDriving ? 14 : CAM_DISTANCE));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  terrainTiles.update(camera.position);
  baseView.group.visible = !bench.active;
  cargoView.group.visible = !bench.active;
  cargoView.update(camera);
  for (const source of freightSources) source.view.update(camera);
  updateBuild();
  baseView.update(camera);
  renderer.render(scene, camera);
  if (isLoading()) finishLoading();
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
    const mapX = flying ? fly.x : mode === 'walking' ? walker.x : vehicleBody.position.x;
    const mapZ = flying ? fly.z : mode === 'walking' ? walker.z : vehicleBody.position.z;
    let mapYaw = walker.yaw;
    if (flying) mapYaw = fly.yaw + Math.PI; // the fly camera's 0 faces -Z
    else if (mode === 'driving') {
      back.set(0, 0, 1).applyQuaternion(vehicleBody.quaternion);
      mapYaw = Math.atan2(back.x, back.z);
    }
    mapOverlay.redraw(mapX, mapZ, mapYaw);
  }
  if (hud.isStorageOpen() && (flying || (mode === 'walking' &&
    (storageVehicle ? Math.hypot(walker.x - storageVehicle.model.position.x, walker.z - storageVehicle.model.position.z) > 7 : currentTarget?.kind !== 'truck')))) closeBed();
  if (hud.isTradeOpen() && (flying || mode !== 'walking' || currentTarget?.kind !== 'trader')) hud.closeTrade();
  hud.setMode(flying ? 'walking' : mode);
  hud.setSpeed(Math.abs((rigDriving ? rig.physics : sim).speed()) * 3.6);
  if (bench.active) {
    hud.setPrompt(null);
    hud.setHint('');
    hud.setDebug(`${liveText}\nPERFORMANCE RUN: ${bench.phaseName()}, ${bench.remaining(now).toFixed(0)} s left (B cancels)`);
  } else {
    let prompt: { key: string; text: string } | null = null;
    if (hud.isStorageOpen() || hud.isTradeOpen()) {
      prompt = null;
    } else if (mode === 'walking' && currentTarget && !unloading) {
      if (currentTarget.kind === 'rig') {
        const vehicle = rigs[currentTarget.id];
        prompt = {key:'E',text:vehicle.complete() ? `${vehicle.name} - drive${vehicle.storage ? ' / cargo storage' : ''}` : `Restore ${vehicle.name} - inspect & fit cargo`};
      } else if (currentTarget.kind === 'truck') {
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
        prompt = { key: 'E', text: pick?.item === 'rig_tire' ? `Take the ${name} for the salvage-yard big rig` : `Take the ${name}` };
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
      prompt = { key: 'U', text: 'Load / unload flatbed containers' };
    } else if (mode === 'driving' && seat === 'passenger') {
      prompt = { key: 'C', text: "Switch to the driver's seat   (you can't drive from here)" };
    } else if (mode === 'driving' && Math.abs(sim.speed()) <= 3) {
      prompt = cargo.length > 0 ? { key: 'U', text: 'Unload containers   (E: get out)' } : { key: 'E', text: 'Get out' };
    }
    if (rigDriving) prompt = {key:'E', text: Math.abs(rig.physics.speed()) > 3 ? `Slow down to exit ${rig.name}` : `Exit ${rig.name} | ${rig.storage ? 'Tab: cargo storage' : `H: ${towingRig === rig ? 'unhook flatbed | U: containers' : 'hook up flatbed'}`}`};
    else if (mode === 'walking' && !unloading && !currentTarget && truckDistance() < 7)
      prompt = { key: 'H', text: 'Flatbed trailer - back a big rig under the front kingpin to hook up' };
    hud.setPrompt(flying ? null : prompt);
    if (mode === 'walking' && !currentTarget && !carrying && !hud.isStorageOpen() && !hud.isTradeOpen()) {
      if (nearPlanerBench()) prompt = { key: 'E', text: 'Use planer bench - 1 log makes 4 planks' };
      else if (nearBench('basicbench')) prompt = { key: 'E', text: 'Use toolbox bench - craft tools or pack it up' };
      else if (targetedHarvestTree()) prompt = { key: 'E', text: countItem(inventory, 'axe') ? 'Chop tree for logs (3 chops)' : 'Tree - find or craft an axe to chop' };
      hud.setPrompt(prompt);
    }
    hud.setHint('K  Build / craft   Esc  Menu & controls');
    hud.setDebug(flying ? `${liveText}\nx ${fly.x.toFixed(0)}  z ${fly.z.toFixed(0)}  height ${fly.y.toFixed(0)} m  speed ${flySpeed.toFixed(0)} m/s` : '');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applySize();
});
