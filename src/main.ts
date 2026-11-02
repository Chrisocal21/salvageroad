import * as THREE from 'three';
import { createRapierSim } from './lab/rapierSim';
import { RAMP, type CarSim, type DriveInput } from './lab/types';
import { createElCajon } from './render/elCajon';

// Step Zero stage 4: the placeholder El Cajon driving on flat ground with a ramp.
// W/S gas and brake/reverse, A/D steer, Space handbrake, R reset.

const STEP = 1 / 60; // physics always runs at a fixed 60 steps per second

const hud = document.getElementById('hud') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 80, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 50, 20);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshStandardMaterial({ color: 0x6b7a5a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
// Grid lines give a sense of speed on an otherwise empty plane.
scene.add(new THREE.GridHelper(1000, 200, 0x445544, 0x556655));

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

let sim: CarSim = await createRapierSim();
let resetting = false;
async function reset() {
  if (resetting) return;
  resetting = true;
  sim = await createRapierSim();
  resetting = false;
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') void reset();
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
let lastFrame = performance.now();

renderer.domElement.addEventListener('click', () => {
  void renderer.domElement.requestPointerLock();
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  lookYaw -= e.movementX * LOOK_SENSITIVITY;
  lookPitch = Math.min(1.3, Math.max(0.05, lookPitch + e.movementY * LOOK_SENSITIVITY));
  lastLook = performance.now();
});

const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const back = new THREE.Vector3();
let last = performance.now();
let accumulator = 0;
let frames = 0;
let fpsClock = last;
let fps = 0;

renderer.setAnimationLoop((now) => {
  accumulator += Math.min((now - last) / 1000, 0.1);
  last = now;

  const input = readInput();
  while (accumulator >= STEP) {
    sim.step(STEP, input);
    accumulator -= STEP;
  }

  const c = sim.chassis();
  if (c.position[1] < -20) void reset(); // fell off the world

  car.body.position.set(...c.position);
  car.body.quaternion.set(...c.quaternion);
  sim.wheels().forEach((w, i) => {
    car.wheels[i].position.set(...w.position);
    car.wheels[i].quaternion.set(...w.quaternion);
  });

  // Chase camera: behind the car, following its heading, with the mouse looking around it.
  // With no mouse movement for a moment, it drifts back to straight behind the car.
  if (now - lastLook > LOOK_RECENTER_AFTER_MS) {
    const k = 1 - Math.exp(-2 * (now - lastFrame) / 1000);
    lookYaw -= lookYaw * k;
    lookPitch += (DEFAULT_PITCH - lookPitch) * k;
  }
  lastFrame = now;
  back.set(0, 0, -1).applyQuaternion(car.body.quaternion);
  back.y = 0;
  back.normalize().applyAxisAngle(UP, lookYaw);
  camTarget.copy(car.body.position).setY(car.body.position.y + 1);
  camPos
    .copy(camTarget)
    .addScaledVector(back, Math.cos(lookPitch) * CAM_DISTANCE)
    .setY(camTarget.y + Math.sin(lookPitch) * CAM_DISTANCE);
  camera.position.lerp(camPos, 0.12);
  camera.lookAt(camTarget);

  renderer.render(scene, camera);

  frames++;
  if (now - fpsClock >= 500) {
    fps = (frames * 1000) / (now - fpsClock);
    frames = 0;
    fpsClock = now;
  }
  hud.textContent =
    `${(Math.abs(sim.speed()) * 3.6).toFixed(0)} km/h   ${fps.toFixed(0)} fps\n` +
    `W gas  S brake/reverse  A/D steer  Space handbrake  R reset\n` +
    `Click the page to look around with the mouse, Esc to release`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
