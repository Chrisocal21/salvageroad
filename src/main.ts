import * as THREE from 'three';
import { Bench, formatReport, scriptedInput } from './bench';
import { createRapierSim } from './lab/rapierSim';
import { RAMP, type CarSim, type DriveInput } from './lab/types';
import { createElCajon } from './render/elCajon';
import { createProps } from './render/props';
import { createTerrainMesh } from './render/terrainMesh';
import { summarizeFrames } from './rules/perfStats';
import { scatterProps } from './rules/scatter';
import { buildTerrainGrid, TERRAIN } from './rules/terrain';

// Step Zero: the placeholder El Cajon driving on generated terrain among placeholder props.
// W/S gas and brake/reverse, A/D steer, Space handbrake, R reset, B performance run.
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

// The world: seeded terrain and props, shared by what you see and what you drive on.
const grid = buildTerrainGrid(TERRAIN);
const props = scatterProps(7, propCount, TERRAIN.size, 45);
scene.add(createTerrainMesh(grid));
createProps(props, TERRAIN.seed).forEach((o) => scene.add(o));
const worldSpec = { terrain: grid, props };

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

let sim: CarSim = await createRapierSim(worldSpec);
let resetting = false;
async function reset() {
  if (resetting) return;
  resetting = true;
  sim = await createRapierSim(worldSpec);
  prev = curr = takeSnapshot();
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
);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyR') void reset();
  if (e.code === 'KeyX') benchPanel.style.display = 'none';
  if (e.code === 'KeyB') {
    if (bench.active) {
      bench.cancel();
    } else {
      benchPanel.style.display = 'none';
      void reset().then(() => bench.start(performance.now()));
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

  const input = bench.active ? scriptedInput(sim.speed()) : readInput();
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
  const status = bench.active
    ? `PERFORMANCE RUN: ${bench.phaseName()}, ${bench.remaining(now).toFixed(0)} s left (B cancels)`
    : 'W gas  S brake/reverse  A/D steer  Space handbrake  R reset  B performance run\n' +
      'Click the page to look around with the mouse, Esc to release';
  hud.textContent = `${(Math.abs(sim.speed()) * 3.6).toFixed(0)} km/h   ${liveText}\n${status}`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applySize();
});
