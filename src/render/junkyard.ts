import { createYardVehicle } from './yardVehicles';
import { createYardTire } from './yardTire';
import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { workshopWalls, YARD, type Junkyard } from '../rules/town';
import { createRustedMaterial } from './rust';

// The junkyard: a rusty corrugated fence with a sign over the open gate, a dirt yard, dead cars sitting on their
// rims, a brick workshop, and piles of old tyres. Drawn from the rules' layout in src/rules/town.ts.
export function createJunkyardView(yard: Junkyard): THREE.Group {
  const group = new THREE.Group();
  const tin = createRustedMaterial('chrome', 0x9aa0a4);
  const post = worldMaterial('metal', { color: 0x77716a, roughness: 0.8, metalness: 0.4 });

  // Dirt underfoot.
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(yard.hx * 2, yard.hz * 2), worldMaterial('sand', { color: 0x9b896f }));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(yard.x, 0.03, yard.z);
  group.add(dirt);

  // The fence: corrugated sheets (ribbed boxes) between posts every 3 m.
  const sheets: THREE.BufferGeometry[] = [];
  const posts: THREE.BufferGeometry[] = [];
  for (const f of yard.fence) {
    const along = f.hx >= f.hz;
    const len = (along ? f.hx : f.hz) * 2;
    const ribs = Math.max(1, Math.round(len / 0.25));
    for (let i = 0; i < ribs; i++) {
      const offset = -len / 2 + (i + 0.5) * (len / ribs);
      const bump = i % 2 ? 0.03 : 0;
      const g = new THREE.BoxGeometry(along ? len / ribs : 0.04, f.height, along ? 0.04 : len / ribs);
      g.translate(f.x + (along ? offset : bump), f.height / 2, f.z + (along ? bump : offset));
      sheets.push(g);
    }
    for (let k = 0; k <= Math.floor(len / 3); k++) {
      const offset = -len / 2 + Math.min(len, k * 3);
      posts.push(new THREE.BoxGeometry(0.1, f.height + 0.15, 0.1).translate(f.x + (along ? offset : 0), (f.height + 0.15) / 2, f.z + (along ? 0 : offset)));
    }
  }
  const fenceMesh = new THREE.Mesh(mergeGeometries(sheets)!, tin);
  fenceMesh.castShadow = true;
  group.add(fenceMesh, new THREE.Mesh(mergeGeometries(posts)!, post));

  // A sign over the gate.
  const gateZ = yard.z + yard.hz;
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), post);
    pole.position.set(yard.gateX + s * (YARD.gateHalf + 0.1), 2.1, gateZ);
    group.add(pole);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#5a2a1c';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SALVAGE YARD', 256, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(YARD.gateHalf * 2 + 0.4, 0.75, 0.06), [post, post, post, post, signMat, signMat]);
  sign.position.set(yard.gateX, 3.75, gateZ);
  group.add(sign);

  // Five reference-inspired, non-drivable salvage vehicles use collision bounds sized to their silhouettes.
  yard.wrecks.forEach((w, index) => {
    const car = createYardVehicle(index);
    car.position.set(w.x, 0, w.z);
    if (w.turned) car.rotation.y = Math.PI / 2;
    group.add(car);
  });

  // The workshop: weathered red brick, a steel door and a sloping metal roof.
  const brick = worldMaterial('brick-2', { color: 0xe2d1bb });
  for (const wall of workshopWalls(yard)) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.hx * 2, wall.height, wall.hz * 2), brick);
    mesh.position.set(wall.x, wall.height / 2, wall.z);
    mesh.castShadow = true;
    group.add(mesh);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(yard.shed.hx * 2 + 0.4, 0.08, yard.shed.hz * 2 + 0.5), post);
  roof.position.set(yard.shed.x, yard.shed.height + (yard.trader ? 0.04 : 0.12), yard.shed.z);
  roof.rotation.x = yard.trader ? 0 : 0.12;
  group.add(roof);
  if (yard.trader) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(yard.shed.hx * 2, yard.shed.hz * 2),
      new THREE.MeshStandardMaterial({ color: 0x918a7c, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(yard.shed.x, 0.04, yard.shed.z);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 1.6), brick);
    lintel.position.set(yard.shed.x - yard.shed.hx + 0.15, 2.4, yard.shed.z);
    group.add(floor, lintel);
  } else {
    const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.95, 0.9), worldMaterial('metal', { color: 0x66736b }));
    shedDoor.position.set(yard.shed.x - yard.shed.hx - 0.02, 0.98, yard.shed.z - 0.5);
    group.add(shedDoor);
    const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.065, 2.08, 1.02), post);
    doorTrim.position.copy(shedDoor.position); doorTrim.position.x += 0.035;
    group.add(doorTrim);
    for (const y of [0.14, 1.82]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.82), post);
      brace.position.set(shedDoor.position.x - 0.03, y, shedDoor.position.z); group.add(brace);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.13, 0.03), post);
    handle.position.set(shedDoor.position.x - 0.04, 1.0, shedDoor.position.z + 0.31); group.add(handle);
  }

  // Tyre piles.
  for (const t of yard.tires) {
    const count = Math.max(2, Math.round(t.height / 0.24));
    for (let i = 0; i < count; i++) {
      const ring = createYardTire(0.48, 0.23);
      ring.position.set(t.x + Math.sin(i * 2.3) * 0.06, 0.13 + i * 0.25, t.z + Math.cos(i * 1.7) * 0.06);
      ring.castShadow = true;
      group.add(ring);
    }
  }
  if (yard.trader) {
      const { counter, person } = yard.trader;
      const wood = new THREE.MeshStandardMaterial({ color: 0x796149, roughness: 0.9 });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(counter.hx * 2, counter.height, counter.hz * 2), wood);
      desk.position.set(counter.x, counter.height / 2, counter.z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(counter.hx * 2 + 0.1, 0.08, counter.hz * 2 + 0.1),
        new THREE.MeshStandardMaterial({ color: 0x8e9995, roughness: 0.8 }));
      top.position.set(counter.x, counter.height, counter.z);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.8, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x495b4e, roughness: 1 }));
      body.position.set(person.x, 0.85, person.z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xb38b6c, roughness: 1 }));
      head.position.set(person.x, 1.6, person.z);
      const label = document.createElement('canvas');
      label.width = 256; label.height = 64;
      const ink = label.getContext('2d')!;
      ink.fillStyle = '#292f2b'; ink.fillRect(0, 0, 256, 64);
      ink.fillStyle = '#e0cfad'; ink.font = 'bold 28px sans-serif'; ink.textAlign = 'center';
      ink.fillText('BARTER ONLY', 128, 42);
      const map = new THREE.CanvasTexture(label);
      map.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map }));
      sign.position.set(counter.x, 0.65, counter.z + counter.hz + 0.01);
      group.add(desk, top, body, head, sign);
      const entranceSign = sign.clone();
      entranceSign.position.set(yard.shed.x - yard.shed.hx - 0.02, 2.4, yard.shed.z);
      entranceSign.rotation.y = -Math.PI / 2;
      group.add(entranceSign);
      for (const mesh of [desk, top, body, head]) mesh.castShadow = true;
  }
  return group;
}
