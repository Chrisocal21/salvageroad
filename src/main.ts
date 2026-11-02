import * as THREE from 'three';
import { Bench, formatReport, scriptedInput } from './bench';
import { CONTAINERS } from './data/containers';
import { createRapierSim } from './lab/rapierSim';
import { CAR, RAMP, type CarSim, type DriveInput } from './lab/types';
import { createElCajon } from './render/elCajon';
import { createProps } from './render/props';
import { createTerrainMesh } from './render/terrainMesh';
import { createTownView } from './render/town';
import type { Box2, Obb2 } from './rules/geometry';
import { exitPosition, findTarget, type Target } from './rules/interaction';
import { createInventory, describeInventory, INVENTORY_SLOTS, usedSlots } from './rules/inventory';
import { describeStacks, newContainerState, openContainer } from './rules/loot';
import { summarizeFrames } from './rules/perfStats';
import { PROP_COLLIDER, scatterProps } from './rules/scatter';
import { buildTerrainGrid, terrainHeight, TERRAIN } from './rules/terrain';
import { generateTown } from './rules/town';
import { lookWalker, stepWalker, WALKER, type Walker } from './rules/walker';

// Step Zero: walk a generated town in first person, loot containers, carry items, and get in and out of
// the placeholder El Cajon to drive it over generated terrain.
// On foot: W/A/S/D walk, Shift run, E use, mouse look. Driving: W/S gas and brake, A/D steer, Space handbrake.
// Always: R reset, B performance run.
// Page options: ?objects=1000 changes the prop count (default 300).

const STEP = 1 / 60; // physics always runs at a fixed 60 steps per second

const params = new URLSearchParams(location.search);
const propCount = Math.max(0, Number(params.get('objects') ?? 300) | 0);

const hud = document.getElementById('hud') as HTMLElement;
const benchPanel = document.getElementById('bench') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
const basePixelRatio = Math.min(window.devicePixelRatio, 2);
let renderScale = 1;
function applySize() {
  renderer.setPixelRatio(basePixelRatio * renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
}
applySize();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 120, 380);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 50, 20);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);

// The world: seeded terrain, a seeded town and props, shared by what you see, walk on and drive on.
const SEED = 1;
const grid = buildTerrainGrid(TERRAIN);
const town = generateTown(SEED);
const props = scatterProps(7, propCount, TERRAIN.size, 45, 12, [{ x: town.center.x, z: town.center.z, r: 70 }]);
scene.add(createTerrainMesh(grid));
createProps(props, TERRAIN.seed).forEach((o) => scene.add(o));
const townView = createTownView(town);
scene.add(townView.group);
const worldSpec = {
  terrain: grid,
  props,
  boxes: [
    ...town.buildings.map((b) => ({ x: b.x, z: b.z, hx: b.hx, hz: b.hz, height: b.height })),
    ...town.containers.map((c) => ({ x: c.x, z: c.z, hx: c.hx, hz: c.hz, height: c.height })),
  ],
  carSpawn: town.carSpawn,
};

// Grid lines in the flat start area give a sense of speed where there is nothing else to look at.
const startGrid = new THREE.GridHelper(120, 60, 0x445544, 0x556655);
startGrid.position.y = 0.03;
scene.add(startGrid);

const ramp = new THREE.Mesh(
  new THREE.BoxGeometry(RAMP.halfExtents[0] * 2, RAMP.halfExtents[1] * 2, RAMP.halfExtents[2] * 2),
  new THREE.MeshStandardMaterial({ color: 0x8a8a8a }),
);
ramp.position.set(...RAMP.center);
ramp.rotation.x = RAMP.pitch;
scene.add(ramp);

// Everything the player on foot cannot walk through. Props count as square for simplicity.
const walkSolids: Box2[] = [
  ...town.buildings,
  ...town.containers,
  { x: RAMP.center[0], z: RAMP.center[2], hx: RAMP.halfExtents[0], hz: RAMP.halfExtents[2] },
  ...props.map((p) => {
    const c = PROP_COLLIDER[p.kind];
    const r = Math.max(c.hx, c.hz) * p.scale;
    return { x: p.x, z: p.z, hx: r, hz: r };
  }),
];

const car = createElCajon();
scene.add(car.body);
car.wheels.forEach((w) => scene.add(w));

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
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
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  return { forward: f, right: r, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

// Game state: where you are, what you carry, which containers have been looted.
type Mode = 'walking' | 'driving';
let mode: Mode = 'walking';
const walker: Walker = { x: town.playerSpawn.x, z: town.playerSpawn.z, yaw: town.playerSpawn.yaw, pitch: 0 };
const inventory = createInventory();
const containerStates = new Map(town.containers.map((c) => [c.id, newContainerState(c.kind)]));
let message = '';
let messageUntil = 0;
function say(text: string) {
  message = text;
  messageUntil = performance.now() + 5000;
}
const PARKED: DriveInput = { throttle: 0, steer: 0, brake: 1 }; // handbrake on while you are out of the truck

let sim: CarSim = await createRapierSim(worldSpec);
let resetting = false;
/** 'town' puts you and the truck back at the town. 'lab' puts the truck on the open test field for the performance run. */
async function reset(kind: 'town' | 'lab' = 'town') {
  if (resetting) return;
  resetting = true;
  sim = await createRapierSim(kind === 'town' ? worldSpec : { ...worldSpec, carSpawn: undefined });
  prev = curr = takeSnapshot();
  camReady = false;
  if (kind === 'town') {
    mode = 'walking';
    Object.assign(walker, { x: town.playerSpawn.x, z: town.playerSpawn.z, yaw: town.playerSpawn.yaw, pitch: 0 });
  } else {
    mode = 'driving';
  }
  resetting = false;
}

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
  void renderer.domElement.requestPointerLock();
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
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
function interact() {
  if (bench.active) return;
  if (mode === 'driving') {
    if (Math.abs(sim.speed()) > 3) {
      say('Slow down to get out');
      return;
    }
    const out = exitPosition(truckObb());
    Object.assign(walker, { x: out.x, z: out.z, yaw: out.yaw, pitch: 0 });
    mode = 'walking';
    return;
  }
  const target = currentTarget;
  if (!target) return;
  if (target.kind === 'truck') {
    mode = 'driving';
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
  if (!result.leftBehind) townView.markOpened(target.id);
}

const bench = new Bench(
  {
    gpu: gpuName(),
    screen: `${window.innerWidth}x${window.innerHeight}`,
    props: props.length,
    terrain: `${TERRAIN.size} m terrain, ${TERRAIN.cells * TERRAIN.cells} cells`,
    basePixelRatio,
  },
  (scale) => {
    renderScale = scale;
    applySize();
  },
  () => `${renderer.domElement.width}x${renderer.domElement.height}`,
);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyR') void reset('town');
  if (e.code === 'KeyE') interact();
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

  if (bench.active) mode = 'driving';
  const input: DriveInput = bench.active ? scriptedInput(sim.speed()) : mode === 'driving' ? readInput() : PARKED;
  const physicsStart = performance.now();
  while (accumulator >= STEP) {
    sim.step(STEP, input);
    prev = curr;
    curr = takeSnapshot();
    accumulator -= STEP;
  }
  const physicsMs = performance.now() - physicsStart;
  if (curr.chassisPos.y < -20) void reset(); // fell off the world

  const alpha = accumulator / STEP;
  car.body.position.lerpVectors(prev.chassisPos, curr.chassisPos, alpha);
  car.body.quaternion.slerpQuaternions(prev.chassisQuat, curr.chassisQuat, alpha);
  car.wheels.forEach((wheel, i) => {
    wheel.position.lerpVectors(prev.wheelPos[i], curr.wheelPos[i], alpha);
    wheel.quaternion.slerpQuaternions(prev.wheelQuat[i], curr.wheelQuat[i], alpha);
  });

  if (mode === 'walking') {
    // First person: walk, then look through the player's eyes.
    stepWalker(walker, readWalkInput(), dt, walkSolids, [truckObb()]);
    currentTarget = findTarget(walker, { containers: town.containers, truck: truckObb() });
    const groundY = terrainHeight(TERRAIN.seed, walker.x, walker.z);
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
  }
  const lines: string[] = [];
  lines.push(`${(Math.abs(sim.speed()) * 3.6).toFixed(0)} km/h   ${liveText}`);
  if (bench.active) {
    lines.push(`PERFORMANCE RUN: ${bench.phaseName()}, ${bench.remaining(now).toFixed(0)} s left (B cancels)`);
  } else {
    // Temporary debug text. The real HUD (canvas or HTML) is still an open question for Chris.
    if (mode === 'walking' && currentTarget) {
      if (currentTarget.kind === 'truck') {
        lines.push('E: get in the El Cajon');
      } else {
        const state = containerStates.get(currentTarget.id);
        const name = CONTAINERS[town.containers[currentTarget.id].kind].name;
        lines.push(state?.opened ? `E: take the rest from the ${name}` : `E: open the ${name}`);
      }
    } else if (mode === 'driving' && Math.abs(sim.speed()) <= 3) {
      lines.push('E: get out');
    }
    if (now < messageUntil) lines.push(message);
    lines.push(`Carrying (${usedSlots(inventory)}/${INVENTORY_SLOTS} slots): ${describeInventory(inventory)}`);
    lines.push(
      mode === 'walking'
        ? 'W/A/S/D walk  Shift run  E use  R reset  B performance run'
        : 'W gas  S brake/reverse  A/D steer  Space handbrake  E get out  R reset  B performance run',
    );
    lines.push('Click the page to look around with the mouse, Esc to release');
  }
  hud.textContent = lines.join('\n');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applySize();
});
