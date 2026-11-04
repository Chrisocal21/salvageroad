import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YARD, type Junkyard } from '../rules/town';
import { createRustedMaterial } from './rust';

// The junkyard: a rusty corrugated fence with a sign over the open gate, a dirt yard, dead cars sitting on their
// rims, a tin shed, and piles of old tyres. Drawn from the rules' layout in src/rules/town.ts.
export function createJunkyardView(yard: Junkyard): THREE.Group {
  const group = new THREE.Group();
  const tin = createRustedMaterial('chrome', 0x9aa0a4);
  const post = new THREE.MeshStandardMaterial({ color: 0x4b4640, roughness: 0.8, metalness: 0.4 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.95 });

  // Dirt underfoot.
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(yard.hx * 2, yard.hz * 2), new THREE.MeshStandardMaterial({ color: 0x7d6a52, roughness: 1 }));
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

  // Dead cars: a body and a cabin, sunk on their rims, rusted through in their own old colours.
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x1f2428, roughness: 0.4, metalness: 0.3 });
  for (const w of yard.wrecks) {
    const car = new THREE.Group();
    car.position.set(w.x, 0, w.z);
    if (w.turned) car.rotation.y = Math.PI / 2;
    const paint = createRustedMaterial('paint', 0xffffff, w.color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.62, 4.5), paint);
    body.position.y = 0.42;
    body.rotation.z = 0.04;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.52, 2.0), paint);
    cabin.position.set(0, 0.98, -0.25);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.36, 1.7), glassDark);
    windows.position.set(0, 1.0, -0.25);
    car.add(body, cabin, windows);
    for (const sx of [-1, 1]) {
      for (const sz of [-1.45, 1.35]) {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14), tin);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(sx * 0.85, 0.2, sz);
        car.add(rim);
      }
    }
    car.traverse((o) => (o.castShadow = true));
    group.add(car);
  }

  // The shed: tin walls with a door, and a sloping roof.
  const shed = new THREE.Mesh(new THREE.BoxGeometry(yard.shed.hx * 2, yard.shed.height, yard.shed.hz * 2), tin);
  shed.position.set(yard.shed.x, yard.shed.height / 2, yard.shed.z);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(yard.shed.hx * 2 + 0.4, 0.08, yard.shed.hz * 2 + 0.5), post);
  roof.position.set(yard.shed.x, yard.shed.height + 0.12, yard.shed.z);
  roof.rotation.x = 0.12;
  const shedDoor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.95, 0.9), new THREE.MeshStandardMaterial({ color: 0x5e3b2a, roughness: 0.9 }));
  shedDoor.position.set(yard.shed.x - yard.shed.hx - 0.02, 0.98, yard.shed.z - 0.5);
  shed.castShadow = true;
  group.add(shed, roof, shedDoor);

  // Tyre piles.
  const tyreGeometry = new THREE.TorusGeometry(0.36, 0.13, 8, 18).rotateX(Math.PI / 2);
  for (const t of yard.tires) {
    const count = Math.max(2, Math.round(t.height / 0.24));
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(tyreGeometry, tyre);
      ring.position.set(t.x + Math.sin(i * 2.3) * 0.06, 0.13 + i * 0.25, t.z + Math.cos(i * 1.7) * 0.06);
      ring.castShadow = true;
      group.add(ring);
    }
  }
  return group;
}
