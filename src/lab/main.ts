import * as THREE from 'three';
import { createCannonSim } from './cannonSim';
import { createRapierSim } from './rapierSim';
import { CAR, RAMP, type CarSim, type DriveInput } from './types';

// Physics lab. Open /lab/index.html?engine=rapier or ?engine=cannon.
// Drive: W/S or arrows up/down, A/D or left/right to steer, Space to brake, R to reset.

const engine = new URLSearchParams(location.search).get('engine') === 'cannon' ? 'cannon' : 'rapier';
const hud = document.getElementById('hud') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
scene.fog = new THREE.Fog(0x9fb4c4, 60, 300);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 50, 20);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshStandardMaterial({ color: 0x6b7a5a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(1000, 200, 0x445544, 0x556655));

const ramp = new THREE.Mesh(
  new THREE.BoxGeometry(RAMP.halfExtents[0] * 2, RAMP.halfExtents[1] * 2, RAMP.halfExtents[2] * 2),
  new THREE.MeshStandardMaterial({ color: 0x8a8a8a }),
);
ramp.position.set(...RAMP.center);
ramp.rotation.x = RAMP.pitch;
scene.add(ramp);

const chassisMesh = new THREE.Mesh(
  new THREE.BoxGeometry(CAR.halfExtents[0] * 2, CAR.halfExtents[1] * 2, CAR.halfExtents[2] * 2),
  new THREE.MeshStandardMaterial({ color: 0xb5532f }),
);
// A small marker on the front so you can tell which way the car faces.
const nose = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.2, 0.6),
  new THREE.MeshStandardMaterial({ color: 0xf2d16b }),
);
nose.position.set(0, CAR.halfExtents[1] + 0.1, CAR.halfExtents[2] - 0.4);
chassisMesh.add(nose);
scene.add(chassisMesh);

const wheelMeshes = [0, 1, 2, 3].map(() => {
  const geo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.3, 16);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
  scene.add(m);
  return m;
});

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));

function readInput(): DriveInput {
  const up = keys.has('KeyW') || keys.has('ArrowUp');
  const down = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  return {
    throttle: (up ? 1 : 0) - (down ? 1 : 0),
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    brake: keys.has('Space') ? 1 : 0,
  };
}

async function load(): Promise<CarSim> {
  return engine === 'cannon' ? createCannonSim() : createRapierSim();
}

let sim = await load();
window.addEventListener('keydown', async (e) => {
  if (e.code === 'KeyR') sim = await load();
});

const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let last = performance.now();
let frames = 0;
let fpsClock = last;
let fps = 0;
let physicsMs = 0;

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;

  const t0 = performance.now();
  sim.step(dt, readInput());
  physicsMs = physicsMs * 0.95 + (performance.now() - t0) * 0.05;

  const c = sim.chassis();
  chassisMesh.position.set(...c.position);
  chassisMesh.quaternion.set(...c.quaternion);
  sim.wheels().forEach((w, i) => {
    wheelMeshes[i].position.set(...w.position);
    wheelMeshes[i].quaternion.set(...w.quaternion);
  });

  // Chase camera: behind and above the car, following its heading.
  const back = new THREE.Vector3(0, 0, -1).applyQuaternion(chassisMesh.quaternion);
  back.y = 0;
  back.normalize();
  camPos.copy(chassisMesh.position).addScaledVector(back, 9).setY(chassisMesh.position.y + 3.5);
  camera.position.lerp(camPos, 0.12);
  camTarget.copy(chassisMesh.position).setY(chassisMesh.position.y + 1);
  camera.lookAt(camTarget);

  renderer.render(scene, camera);

  frames++;
  if (now - fpsClock >= 500) {
    fps = (frames * 1000) / (now - fpsClock);
    frames = 0;
    fpsClock = now;
  }
  hud.textContent =
    `engine: ${sim.name}   (?engine=rapier or ?engine=cannon)\n` +
    `fps: ${fps.toFixed(0)}   physics: ${physicsMs.toFixed(2)} ms/frame\n` +
    `speed: ${(sim.speed() * 3.6).toFixed(0)} km/h\n` +
    `W/S gas/reverse  A/D steer  Space brake  R reset`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
