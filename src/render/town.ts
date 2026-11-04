import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTAINERS } from '../data/containers';
import { makeRandom } from '../rules/scatter';
import { ROAD, STORE, type Building, type ContainerSpawn, type Town } from '../rules/town';
import { createJunkyardView } from './junkyard';

// The town: flat dark streets, plain buildings as boxes, stores you can walk into (shop front with windows, a sign,
// an awning, shelves stocked with goods), small coloured boxes for the containers outside, and the junkyard.
export interface TownView {
  group: THREE.Group;
  /** Call when a container has been opened, so it looks used: boxes darken, shelves are emptied. */
  markOpened(id: number): void;
}

export function createTownView(town: Town, groundY = 0): TownView {
  const group = new THREE.Group();
  group.position.y = groundY; // the town stands on level ground at this height

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 1 });
  const length = town.roadsX[town.roadsX.length - 1] - town.roadsX[0] + ROAD;
  const addRoad = (x: number, z: number, w: number, d: number) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.06, z); // just above the ground
    group.add(road);
  };
  const midX = (town.roadsX[0] + town.roadsX[town.roadsX.length - 1]) / 2;
  const midZ = (town.roadsZ[0] + town.roadsZ[town.roadsZ.length - 1]) / 2;
  for (const rx of town.roadsX) addRoad(rx, midZ, ROAD, length);
  for (const rz of town.roadsZ) addRoad(midX, rz, length, ROAD);
  // A short drive from the street to the junkyard gate.
  const yard = town.junkyard;
  const driveLength = town.roadsZ[0] - ROAD / 2 - (yard.z + yard.hz) + 0.5;
  addRoad(yard.gateX, yard.z + yard.hz + driveLength / 2 - 0.5, 6, driveLength);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 });
  for (const b of town.buildings) {
    if (b.store) {
      group.add(createStore(b, roofMat));
      continue;
    }
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(b.hx * 2, b.height, b.hz * 2),
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.9 }),
    );
    wall.position.set(b.x, b.height / 2, b.z);
    group.add(wall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.4, 0.3, b.hz * 2 + 0.4), roofMat);
    roof.position.set(b.x, b.height + 0.15, b.z);
    group.add(roof);
  }

  const opened = new Map<number, () => void>();
  for (const c of town.containers) {
    if (c.kind === 'market_shelf' || c.kind === 'hardware_shelf') {
      const shelf = createShelf(c, town.buildings[c.inside!]);
      group.add(shelf.group);
      opened.set(c.id, shelf.empty);
      continue;
    }
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(c.hx * 2, c.height, c.hz * 2),
      new THREE.MeshStandardMaterial({ color: CONTAINERS[c.kind].color, roughness: 0.8 }),
    );
    mesh.position.set(c.x, c.height / 2, c.z);
    group.add(mesh);
    opened.set(c.id, () => (mesh.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.45));
  }

  group.add(createJunkyardView(yard));

  return {
    group,
    markOpened(id) {
      opened.get(id)?.();
      opened.delete(id); // only once
    },
  };
}

const SIGN_TEXT: Record<NonNullable<Building['store']>, string> = { market: 'MARKET', hardware: 'HARDWARE' };
const AWNING: Record<NonNullable<Building['store']>, string> = { market: '#a8432f', hardware: '#2f5f8a' };

/** A store you can walk into: drawn in its own frame, the door facing local +Z, then turned to face its street. */
function createStore(b: Building, roofMat: THREE.Material): THREE.Group {
  const store = new THREE.Group();
  store.position.set(b.x, 0, b.z);
  store.rotation.y = b.front ?? 0;
  const quarter = Math.abs(Math.sin(b.front ?? 0)) > 0.5;
  const w = quarter ? b.hz : b.hx; // half the width across the front
  const d = quarter ? b.hx : b.hz; // half the depth
  const h = b.height;
  const t = STORE.wall;
  const door = STORE.doorHalf;
  const wallMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.7, metalness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb7c2, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
  const box = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    mesh.position.set(x, y, z);
    store.add(mesh);
    return mesh;
  };

  box(wallMat, w * 2, h, t, 0, h / 2, -d + t / 2); // back
  for (const s of [-1, 1]) box(wallMat, t, h, d * 2, s * (w - t / 2), h / 2, 0); // sides
  // The shop front: a low wall, a big window, wall above; the doorway open in the middle.
  const sill = 0.8;
  const head = 2.4;
  const len = w - door;
  for (const s of [-1, 1]) {
    const x = s * (door + len / 2);
    box(wallMat, len, sill, t, x, sill / 2, d - t / 2);
    box(wallMat, len, h - head, t, x, (head + h) / 2, d - t / 2);
    box(glassMat, len - 0.1, head - sill, 0.03, x, (sill + head) / 2, d - t / 2);
    for (const e of [door, w - 0.06]) box(trimMat, 0.1, head - sill, t + 0.02, s * e, (sill + head) / 2, d - t / 2);
    box(trimMat, len, 0.06, t + 0.04, x, sill, d - t / 2);
  }
  box(wallMat, door * 2, h - 2.3, t, 0, (2.3 + h) / 2, d - t / 2); // over the door
  for (const s of [-1, 1]) box(trimMat, 0.08, 2.3, t + 0.04, s * door, 1.15, d - t / 2);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2 - t * 2, d * 2 - t * 2), new THREE.MeshStandardMaterial({ color: 0x8c8a82, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  store.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.4, 0.3, d * 2 + 0.4), roofMat);
  roof.position.y = h + 0.15;
  store.add(roof);

  // Sign over the door, and a striped awning over the window line.
  const kind = b.store ?? 'market';
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8e0cc';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#2b2a28';
  ctx.font = 'bold 76px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SIGN_TEXT[kind], 256, 68);
  const signTexture = new THREE.CanvasTexture(canvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const signWidth = Math.min(w * 2 - 1, 4.4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signWidth, signWidth / 4), new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.8 }));
  sign.position.set(0, Math.min(h - 0.2 - signWidth / 8, 2.95 + signWidth / 8), d + 0.02);
  store.add(sign);
  const stripes = document.createElement('canvas');
  stripes.width = 64;
  stripes.height = 8;
  const sctx = stripes.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    sctx.fillStyle = i % 2 ? '#e8e0cc' : AWNING[kind];
    sctx.fillRect(i * 8, 0, 8, 8);
  }
  const stripeTexture = new THREE.CanvasTexture(stripes);
  stripeTexture.colorSpace = THREE.SRGBColorSpace;
  stripeTexture.wrapS = THREE.RepeatWrapping;
  stripeTexture.repeat.set((w * 2) / 2.4, 1);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 2 - 0.4, 0.06, 1.1), new THREE.MeshStandardMaterial({ map: stripeTexture, roughness: 0.9 }));
  awning.position.set(0, head + 0.12, d + 0.55);
  awning.rotation.x = 0.22;
  store.add(awning);
  return store;
}

/** A metal shelf unit with goods on it. Emptying it takes the goods away. */
function createShelf(c: ContainerSpawn, store: Building): { group: THREE.Group; empty: () => void } {
  const group = new THREE.Group();
  group.position.set(c.x, 0, c.z);
  // Turn it so the goods face into the room and the back panel is against the wall.
  const along = c.hx >= c.hz; // the long side runs along X
  group.rotation.y = along ? (store.z >= c.z ? 0 : Math.PI) : store.x >= c.x ? Math.PI / 2 : -Math.PI / 2;
  const len = Math.max(c.hx, c.hz) * 2;
  const depth = Math.min(c.hx, c.hz) * 2;
  const frame = new THREE.MeshStandardMaterial({ color: CONTAINERS[c.kind].color, roughness: 0.6, metalness: 0.5 });
  const parts: THREE.BufferGeometry[] = [];
  const piece = (sx: number, sy: number, sz: number, x: number, y: number, z: number) =>
    parts.push(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z));
  for (const s of [-1, 1]) piece(0.05, c.height, depth, s * (len / 2 - 0.025), c.height / 2, 0);
  piece(len, c.height - 0.2, 0.02, 0, c.height / 2 + 0.05, -depth / 2 + 0.01); // back panel
  const boards = [0.12, 0.62, 1.12, 1.62];
  for (const y of boards) piece(len, 0.03, depth, 0, y, 0);
  const unit = new THREE.Mesh(mergeGeometries(parts)!, frame);
  group.add(unit);

  // Goods: small boxes and cans in a few colours, one merged mesh coloured per vertex.
  const rand = makeRandom(c.id * 977 + 13);
  const palette = c.kind === 'market_shelf' ? [0xc94f3d, 0xe0b04a, 0x4f8a4a, 0x3f6fa8, 0xd8d2c0, 0x8a4f9a] : [0x5a5f66, 0xb98a3a, 0x8a3a2e, 0x3a5a7a, 0x9a9a8a];
  const goods: THREE.BufferGeometry[] = [];
  const colour = new THREE.Color();
  for (const y of boards.slice(0, 3)) {
    let x = -len / 2 + 0.1;
    while (x < len / 2 - 0.2) {
      const gw = 0.1 + rand() * 0.16;
      const gh = 0.12 + rand() * 0.24;
      const gd = depth * (0.5 + rand() * 0.35);
      if (rand() < 0.85) {
        const g = rand() < 0.4 ? new THREE.CylinderGeometry(gw / 2, gw / 2, gh, 10) : new THREE.BoxGeometry(gw, gh, gd);
        g.translate(x + gw / 2, y + 0.015 + gh / 2, (rand() - 0.5) * (depth - gd) * 0.5);
        const nonIndexed = g.index ? g.toNonIndexed() : g;
        colour.setHex(palette[Math.floor(rand() * palette.length)]);
        const colours = new Float32Array(nonIndexed.attributes.position.count * 3);
        for (let i = 0; i < colours.length; i += 3) colours.set([colour.r, colour.g, colour.b], i);
        nonIndexed.setAttribute('color', new THREE.BufferAttribute(colours, 3));
        nonIndexed.deleteAttribute('uv');
        goods.push(nonIndexed);
      }
      x += gw + 0.03;
    }
  }
  const stock = new THREE.Mesh(mergeGeometries(goods)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  group.add(stock);
  return {
    group,
    empty: () => {
      stock.visible = false;
    },
  };
}
