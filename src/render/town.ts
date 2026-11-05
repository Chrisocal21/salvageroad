import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTAINERS } from '../data/containers';
import { makeRandom } from '../rules/scatter';
import { LOT, ROAD, STORE, type Building, type ContainerSpawn, type Town } from '../rules/town';
import { createJunkyardView } from './junkyard';

// The town: asphalt streets, brick buildings, stores you can walk into (shop front with windows, a sign,
// an awning, shelves stocked with goods), small coloured boxes for the containers outside, and the junkyard.
export interface TownView {
  group: THREE.Group;
  /** Call when a container has been opened, so it looks used: boxes darken, shelves are emptied. */
  markOpened(id: number): void;
}

export function createTownView(town: Town, groundY = 0, surface?: (x: number, z: number) => number): TownView {
  const group = new THREE.Group();
  group.position.y = groundY; // the town stands on level ground at this height

  const roadMat = worldMaterial('asphalt', { color: 0x888888 });
  const length = town.roadsX[town.roadsX.length - 1] - town.roadsX[0] + ROAD;
  const addRoad = (x: number, z: number, w: number, d: number, material = roadMat, elevation = 0.06) => {
    const geometry = new THREE.PlaneGeometry(w, d, surface ? Math.max(1, Math.ceil(w / 4)) : 1, surface ? Math.max(1, Math.ceil(d / 4)) : 1);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.getAttribute('position');
    if (surface) for (let i = 0; i < pos.count; i++) pos.setY(i, surface(x + pos.getX(i), z + pos.getZ(i)) - groundY);
    geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, material);
    road.position.set(x, elevation, z);
    group.add(road);
  };
  if (town.lawns?.length) {
    const grass = worldMaterial('grass', { color: 0x87915d });
    const path = worldMaterial('concrete', { color: 0xafa998 });
    for (const lawn of town.lawns) addRoad(lawn.x, lawn.z, lawn.hx * 2, lawn.hz * 2, grass, 0.02);
    for (const b of town.buildings.filter(b => b.housing === 'home')) {
      const side = Math.cos(b.front ?? 0) > 0 ? 1 : -1;
      const gap = LOT - ROAD / 2 - 0.6 - Math.abs(b.z - town.center.z) - b.hz;
      if (gap > 0) {
        const z = b.z + side * (b.hz + gap / 2);
        addRoad(b.x, z, 1.2, gap, path, 0.07);
        addRoad(b.x + 3, z, 3, gap, path, 0.07);
      }
    }
  }
  if (town.yard) addRoad(town.yard.x, town.yard.z, town.yard.hx * 2, town.yard.hz * 2,
    town.salvage ? worldMaterial('sand', { color: 0x9b896f }) : roadMat, town.salvage ? 0.02 : 0.06);
  if (town.parking) {
    const p = town.parking;
    const paint = new THREE.MeshStandardMaterial({ color: 0xcac5ad, roughness: 1 });
    const concrete = worldMaterial('concrete', { color: 0xb4afa0 });
    addRoad(town.center.x, town.center.z - 4.5, 43.2, 3, concrete, 0.08);
    for (let i = 0; i <= 15; i++) addRoad(p.x - p.hx + i * (p.hx * 2 / 15), p.z, 0.08, p.hz * 2, paint, 0.09);
    for (let z = p.z - p.hz; z <= p.z + p.hz; z += 1.2) addRoad(p.x, z, 2, 0.5, paint, 0.1);
  }
  if (town.trees?.length) {
    const bark = worldMaterial('bark', { color: 0x82715d });
    const leaves = worldMaterial('grass', { color: 0x587045 });
    for (const tree of town.trees) {
      const trunkHeight = tree.height * 0.65;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, trunkHeight, 6), bark);
      trunk.position.set(tree.x, trunkHeight / 2, tree.z);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(tree.radius, 1), leaves);
      crown.position.set(tree.x, tree.height - tree.radius, tree.z);
      crown.scale.y = 1.2;
      crown.castShadow = true;
      group.add(trunk, crown);
    }
  }
  for (const lane of town.accessLanes ?? []) {
    const dx = lane.to.x - lane.from.x, dz = lane.to.z - lane.from.z;
    const length = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const geometry = new THREE.PlaneGeometry(lane.width, length, 2, Math.max(1, Math.ceil(length / 4)));
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(yaw);
    const x = (lane.from.x + lane.to.x) / 2, z = (lane.from.z + lane.to.z) / 2;
    const pos = geometry.getAttribute('position');
    if (surface) for (let i = 0; i < pos.count; i++) pos.setY(i, surface(x + pos.getX(i), z + pos.getZ(i)) - groundY);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, roadMat);
    mesh.position.set(x, 0.07, z);
    group.add(mesh);
  }
  if (town.quay) {
    const q = town.quay;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(q.hx * 2, 1, q.hz * 2), worldMaterial('concrete', { color: 0x888a82 }));
    mesh.position.set(q.x, -0.5, q.z);
    group.add(mesh);
  }
  for (const f of [...(town.fixtures ?? []), ...(town.overhead ?? [])]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(f.hx * 2, f.height, f.hz * 2), worldMaterial('metal', { color: f.color }));
    mesh.position.set(f.x, ('y0' in f && typeof f.y0 === 'number' ? f.y0 : 0) + f.height / 2, f.z);
    mesh.castShadow = true;
    group.add(mesh);
    if (town.siteKind === 'dock' && f.height < 6) {
      for (let k = -5; k <= 5; k++) for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, f.height - 0.1, 0.08), mesh.material);
        rib.position.set(f.x + side * f.hx, f.height / 2, f.z + k);
        group.add(rib);
      }
    }
  }
  const midX = (town.roadsX[0] + town.roadsX[town.roadsX.length - 1]) / 2;
  const midZ = (town.roadsZ[0] + town.roadsZ[town.roadsZ.length - 1]) / 2;
  for (const rx of town.roadsX) addRoad(rx, midZ, ROAD, length);
  for (const rz of town.roadsZ) addRoad(midX, rz, length, ROAD);
  if (town.roadsX.length >= 6 || town.districtKind) {
    const sidewalks: THREE.BufferGeometry[] = [];
    for (let i = 1; i < town.roadsX.length; i++) for (let j = 1; j < town.roadsZ.length; j++) {
      const x0 = town.roadsX[i - 1], x1 = town.roadsX[i];
      const z0 = town.roadsZ[j - 1], z1 = town.roadsZ[j];
      const edge = ROAD / 2 + 0.6;
      for (const x of [x0 + edge, x1 - edge]) {
        sidewalks.push(new THREE.PlaneGeometry(1.2, z1 - z0 - ROAD).rotateX(-Math.PI / 2).translate(x, 0.08, (z0 + z1) / 2));
      }
      for (const z of [z0 + edge, z1 - edge]) {
        sidewalks.push(new THREE.PlaneGeometry(x1 - x0 - ROAD, 1.2).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.08, z));
      }
    }
    const sidewalk = new THREE.Mesh(mergeGeometries(sidewalks)!, worldMaterial('concrete', { color: 0xb4afa0 }));
    sidewalk.receiveShadow = true;
    group.add(sidewalk);
    sidewalks.forEach(g => g.dispose());
  }
  // A short drive from the street to the junkyard gate.
  const yard = town.junkyard;
  const driveLength = town.roadsZ[0] - ROAD / 2 - (yard.z + yard.hz) + 0.5;
  if (town.hasJunkyard !== false) addRoad(yard.gateX, yard.z + yard.hz + driveLength / 2 - 0.5, 6, driveLength);

  const roofMat = worldMaterial('asphalt', { color: 0x77716b });
  const detailMaterials = [
    worldMaterial('concrete', { color: 0xaca28e }),
    new THREE.MeshStandardMaterial({ color: 0x24302e, roughness: 0.36, metalness: 0.18 }),
    worldMaterial('metal', { color: 0x6d6c61 }),
  ];
  const facadeBatches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const addDetails = (b: Building, firstFloor = 0) => {
    const details = buildingDetails(b, detailMaterials, firstFloor);
    for (const child of details.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const batch = facadeBatches.get(child.material) ?? [];
      batch.push(child.geometry.translate(b.x, 0, b.z));
      facadeBatches.set(child.material, batch);
    }
  };
  for (const b of town.buildings) {
    if (b.store) {
      group.add(createStore(b, roofMat));
      if (b.height > 9) addDetails(b, 1);
      continue;
    }
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(b.hx * 2, b.height, b.hz * 2),
      worldMaterial(b.color === 0x9aa6a8 ? 'brick-1' : b.color === 0xa88a7a ? 'brick-2' : 'brick-red', { color: 0xe4d9c7 }),
    );
    wall.position.set(b.x, b.height / 2, b.z);
    wall.castShadow = true;
    group.add(wall);
    addDetails(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.4, 0.3, b.hz * 2 + 0.4), roofMat);
    roof.position.set(b.x, b.height + 0.15, b.z);
    roof.castShadow = true;
    group.add(roof);
    if (b.housing === 'home') {
      const pitch = new THREE.Mesh(new THREE.ConeGeometry(1, 2.2, 4), roofMat);
      pitch.scale.set(b.hx * 1.48, 1, b.hz * 1.48);
      pitch.rotation.y = Math.PI / 4;
      pitch.position.set(b.x, b.height + 1.1, b.z);
      group.add(pitch);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2.15, 0.06), worldMaterial('wood', { color: 0x70523b }));
      const front = b.front ?? 0;
      const depth = Math.abs(Math.sin(front)) > 0.5 ? b.hx : b.hz;
      door.position.set(b.x + Math.sin(front) * (depth + 0.04), 1.075, b.z + Math.cos(front) * (depth + 0.04));
      door.rotation.y = front;
      group.add(door);
    }
  }
  for (const [material, geometries] of facadeBatches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries)!, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach(g => g.dispose());
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
      worldMaterial('wood', { color: CONTAINERS[c.kind].color }),
    );
    mesh.position.set(c.x, c.height / 2, c.z);
    mesh.userData.lootDynamic = true;
    group.add(mesh);
    opened.set(c.id, () => (mesh.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.45));
  }

  if (town.hasJunkyard !== false) group.add(createJunkyardView(yard));
  if (town.salvage) {
    const view = createJunkyardView(town.salvage.yard);
    view.position.set(town.center.x, 0, town.center.z);
    view.rotation.y = town.salvage.yaw;
    group.add(view);
  }

  return {
    group,
    markOpened(id) {
      opened.get(id)?.();
      opened.delete(id); // only once
    },
  };
}

const SIGN_TEXT: Record<NonNullable<Building['store']>, string> = { market: 'MARKET', hardware: 'HARDWARE', warehouse: 'FREIGHT', barracks: 'LOGISTICS' };
const AWNING: Record<NonNullable<Building['store']>, string> = { market: '#a8432f', hardware: '#2f5f8a', warehouse: '#5d6871', barracks: '#546448' };

/** A store you can walk into: drawn in its own frame, the door facing local +Z, then turned to face its street. */
function createStore(b: Building, roofMat: THREE.Material): THREE.Group {
  const store = new THREE.Group();
  store.position.set(b.x, 0, b.z);
  store.rotation.y = b.front ?? 0;
  const quarter = Math.abs(Math.sin(b.front ?? 0)) > 0.5;
  const w = quarter ? b.hz : b.hx; // half the width across the front
  const d = quarter ? b.hx : b.hz; // half the depth
  const h = b.housing === 'apartments' ? Math.min(b.height, 3.2) : b.height;
  const industrial = b.store === 'warehouse' || b.store === 'barracks';
  const t = STORE.wall;
  const door = STORE.doorHalf;
  const wallMat = worldMaterial(industrial ? 'metal' : b.color === 0x9aa6a8 ? 'brick-1' : b.color === 0xa88a7a ? 'brick-2' : 'brick-red', { color: industrial ? b.color : 0xe4d9c7 });
  const trimMat = worldMaterial('metal', { color: 0x65615a, roughness: 0.7, metalness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb7c2, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
  const box = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = m !== glassMat;
    mesh.receiveShadow = true;
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
    if (industrial) {
      box(wallMat, len, h, t, x, h / 2, d - t / 2);
      continue;
    }
    box(wallMat, len, sill, t, x, sill / 2, d - t / 2);
    box(wallMat, len, h - head, t, x, (head + h) / 2, d - t / 2);
    box(glassMat, len - 0.1, head - sill, 0.03, x, (sill + head) / 2, d - t / 2);
    for (const e of [door, w - 0.06]) box(trimMat, 0.1, head - sill, t + 0.02, s * e, (sill + head) / 2, d - t / 2);
    box(trimMat, len, 0.06, t + 0.04, x, sill, d - t / 2);
  }
  box(wallMat, door * 2, h - 2.3, t, 0, (2.3 + h) / 2, d - t / 2); // over the door
  for (const s of [-1, 1]) box(trimMat, 0.08, 2.3, t + 0.04, s * door, 1.15, d - t / 2);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * 2 - t * 2, d * 2 - t * 2), worldMaterial('concrete', { color: 0x8c8a82 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  store.add(floor);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.4, 0.3, d * 2 + 0.4), roofMat);
  roof.position.y = h + 0.15;
  roof.castShadow = true;
  store.add(roof);
  if (b.height > h) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w * 2, b.height - h, d * 2), wallMat);
    upper.position.y = h + (b.height - h) / 2;
    upper.castShadow = true;
    store.add(upper);
    roof.position.y = b.height + 0.15;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.2, d * 2), roofMat);
    ceiling.position.y = h;
    store.add(ceiling);
  }

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
  if (industrial) return store;
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
  stock.userData.lootDynamic = true;
  group.add(stock);
  return {
    group,
    empty: () => {
      stock.visible = false;
    },
  };
}

/** Recessed-looking windows and masonry trim give the solid background buildings scale. */
function buildingDetails(b: Building, materials: THREE.Material[], firstFloor = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);
  const [trim, dark, frame] = materials;
  const pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const box = (material: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, yaw: number) => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z).rotateY(yaw);
    const batch = pieces.get(material) ?? []; batch.push(geometry); pieces.set(material, batch);
  };
  for (let face = 0; face < 4; face++) {
    const yaw = face * Math.PI / 2;
    const width = (face % 2 ? b.hz : b.hx) * 2;
    const depth = face % 2 ? b.hx : b.hz;
    box(trim, width + 0.06, 0.22, 0.10, 0, 0.13, depth, yaw);
    box(trim, width + 0.12, 0.16, 0.14, 0, b.height - 0.18, depth, yaw);
    const count = Math.max(1, Math.floor((width - 1.0) / 3));
    for (let floor = firstFloor; floor < Math.max(1, Math.floor(b.height / 3.2)); floor++) for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 2.8;
      const y = Math.min(1.95, b.height * 0.56) + floor * 3.2;
      box(frame, 1.34, 1.40, 0.09, x, y, depth + 0.045, yaw);
      box(dark, 1.20, 1.24, 0.025, x, y, depth + 0.10, yaw);
      box(frame, 0.045, 1.25, 0.035, x, y, depth + 0.12, yaw);
      box(frame, 1.20, 0.045, 0.035, x, y, depth + 0.12, yaw);
      box(trim, 1.49, 0.10, 0.23, x, y - 0.73, depth + 0.07, yaw);
      box(trim, 1.48, 0.12, 0.12, x, y + 0.76, depth + 0.04, yaw);
    }
  }
  for (const [material, geometries] of pieces) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries)!, material);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  return group;
}

/** Spatially batch immutable scenery, retaining independently openable loot meshes. */
export function batchTownScenery(views: TownView[]): THREE.Group {
  const scenery = new THREE.Group();
  const batches = new Map<string, { material: THREE.MeshStandardMaterial; castShadow: boolean; geometries: THREE.BufferGeometry[] }>();
  for (const { group } of views) {
    group.updateMatrixWorld(true);
    const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !object.userData.lootDynamic)
        meshes.push(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>);
    });
    for (const mesh of meshes) {
      const m = mesh.material;
      const position = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
      const key = [Math.floor(position.x / 128), Math.floor(position.z / 128), m.customProgramCacheKey(),
        m.type, m.color.getHex(), m.emissive.getHex(), m.roughness, m.metalness, m.map?.uuid, m.vertexColors, m.side,
        m.transparent, m.opacity, m.depthWrite, mesh.castShadow,
        Object.keys(mesh.geometry.attributes).sort().join(','), !!mesh.geometry.index].join(':');
      const batch = batches.get(key) ?? { material: m, castShadow: mesh.castShadow, geometries: [] };
      batch.geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      batches.set(key, batch);
      mesh.removeFromParent();
    }
  }
  for (const { material, castShadow, geometries } of batches.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries)!, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scenery.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  return scenery;
}
