import * as THREE from 'three';
import { bedLoad, type BedProp } from '../rules/bedLoad';
import type { Inventory } from '../rules/inventory';

// Draws what is stored in the El Cajon's bed. Positions are in the truck's own space (+Z is the nose, 0 is the middle).

const FLOOR = -0.06; // top of the bed floor ribs
// Where props sit on the floor as [x, z]: rear row first, so a light load rides at the back by the tailgate.
const SPOTS: [number, number][] = [[-0.3, -2.1], [0.3, -2.1], [-0.3, -1.5], [0.3, -1.5], [-0.3, -0.98], [0.3, -0.98]];

const mat = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  rubber: mat(0x1b1c1e, 0.95),
  steel: mat(0x70767c, 0.5, 0.7),
  engine: mat(0x2f3338, 0.55, 0.6),
  rocker: mat(0x7d3a2a, 0.6, 0.3),
  wood: mat(0x8c6a3f, 0.9),
  woodDark: mat(0x6c4f2d, 0.9),
  tin: mat(0xb9bcc0, 0.4, 0.7),
  label: mat(0xa8452f, 0.7),
  bottle: new THREE.MeshStandardMaterial({ color: 0x9cc7dd, roughness: 0.15, transparent: true, opacity: 0.75 }),
  paper: mat(0xc9b88f, 0.9),
  white: mat(0xe6e4dc, 0.8),
  cross: mat(0xb0211d, 0.7),
  green: mat(0x4f6b45, 0.85),
  blue: mat(0x3d5f8a, 0.85),
};

const G = {
  tire: new THREE.TorusGeometry(0.2, 0.085, 12, 28),
  hub: new THREE.CylinderGeometry(0.115, 0.115, 0.04, 16),
  can: new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12),
  bottle: new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12),
  unit: new THREE.BoxGeometry(1, 1, 1),
  air: new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16),
  rigTire: new THREE.TorusGeometry(0.36, 0.16, 14, 32),
  rigHub: new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20),
};

function piece(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, p: [number, number, number], scale?: [number, number, number]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...p);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const slab = (parent: THREE.Object3D, material: THREE.Material, size: [number, number, number], p: [number, number, number]) => piece(G.unit, material, parent, p, size);

function tireStack(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = piece(G.tire, M.rubber, g, [0, 0.085 + i * 0.17, 0]);
    t.rotation.x = Math.PI / 2;
  }
  piece(G.hub, M.steel, g, [0, 0.085 + (count - 1) * 0.17 + 0.07, 0]);
  return g;
}

/** A big rig tyre, lying flat. About a metre across: it takes a whole row of the bed. */
function rigTire(): THREE.Group {
  const g = new THREE.Group();
  const t = piece(G.rigTire, M.rubber, g, [0, 0.16, 0]);
  t.rotation.x = Math.PI / 2;
  piece(G.rigHub, M.steel, g, [0, 0.3, 0]);
  return g;
}

function motor(): THREE.Group {
  const g = new THREE.Group();
  slab(g, M.engine, [0.46, 0.3, 0.56], [0, 0.15, 0]);
  for (const s of [-1, 1]) slab(g, M.rocker, [0.14, 0.07, 0.4], [s * 0.15, 0.335, -0.02]);
  piece(G.air, M.steel, g, [0, 0.36, 0.0]);
  slab(g, M.steel, [0.3, 0.1, 0.14], [0, 0.05, 0.3]);
  return g;
}

/** A supply crate with goods showing over the top. The more it holds, the fuller it looks. */
function crate(count: number): THREE.Group {
  const g = new THREE.Group();
  const w = 0.6, d = 0.5, h = 0.32, t = 0.03;
  slab(g, M.woodDark, [w, t, d], [0, t / 2, 0]);
  for (const s of [-1, 1]) {
    slab(g, M.wood, [t, h, d], [s * (w / 2 - t / 2), h / 2, 0]);
    slab(g, M.wood, [w, h, t], [0, h / 2, s * (d / 2 - t / 2)]);
  }
  for (const z of [-1, 1]) slab(g, M.woodDark, [w + 0.02, 0.03, 0.04], [0, h * 0.55, z * (d / 2)]);
  const goods = Math.min(9, 3 + Math.floor(count / 2));
  const colours = [M.green, M.label, M.blue, M.paper, M.tin];
  for (let i = 0; i < goods; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = (col - 1) * 0.17 + (row % 2) * 0.03;
    const z = (row - 1) * 0.15;
    const height = 0.14 + ((i * 37) % 5) * 0.025;
    slab(g, colours[i % colours.length], [0.13, height, 0.12], [x, h - 0.06 + height / 2, z]);
  }
  return g;
}

/** A few loose goods of one kind, standing or lying on the floor. */
function smallGoods(look: BedProp['look'], count: number): THREE.Group {
  const g = new THREE.Group();
  const n = Math.min(count, 5);
  for (let i = 0; i < n; i++) {
    const x = (i % 3 - 1) * 0.1;
    const z = (Math.floor(i / 3) - 0.5) * 0.1;
    if (look === 'food') {
      piece(G.can, M.tin, g, [x, 0.05, z]);
      piece(G.can, M.label, g, [x, 0.05, z], [1.04, 0.5, 1.04]);
    } else if (look === 'drink') piece(G.bottle, M.bottle, g, [x, 0.11, z]);
    else if (look === 'tool') {
      const bar = slab(g, M.steel, [0.04, 0.03, 0.3], [x, 0.015, z]);
      bar.rotation.y = i * 0.5;
    } else if (look === 'medical') {
      slab(g, M.white, [0.14, 0.08, 0.1], [x, 0.04, z]);
      slab(g, M.cross, [0.05, 0.082, 0.02], [x, 0.04, z]);
    } else slab(g, M.paper, [0.12, 0.1 + (i % 2) * 0.04, 0.12], [x, 0.06, z]);
  }
  return g;
}

export interface BedView {
  group: THREE.Group;
  /** Redraws the bed for what is in the storage now. */
  update(storage: Inventory): void;
}

export function createBedView(): BedView {
  const group = new THREE.Group();
  group.name = 'Bed load';
  let key = '';
  return {
    group,
    update(storage) {
      const props = bedLoad(storage);
      const next = JSON.stringify(props);
      if (next === key) return;
      key = next;
      group.clear();
      let cursor = 0;
      props.forEach((prop, i) => {
        const span = prop.spots ?? 1;
        if (span === 2 && cursor % 2 === 1) cursor++;
        const model =
          prop.look === 'rig_tire' ? rigTire() : prop.look === 'tire' ? tireStack(prop.count) : prop.look === 'motor' ? motor() : prop.look === 'crate' ? crate(prop.count) : smallGoods(prop.look, prop.count);
        // A prop that takes two places sits between them.
        const x = span === 2 ? (SPOTS[cursor][0] + SPOTS[cursor + 1][0]) / 2 : SPOTS[cursor][0];
        const z = SPOTS[cursor][1] + (span === 2 ? 0.1 : 0); // the rig tyre is wide: keep it off the tailgate
        cursor += span;
        model.position.set(x, FLOOR, z);
        model.rotation.y = prop.look === 'crate' || prop.look === 'motor' || span === 2 ? 0 : (i * 1.7) % 6.28;
        group.add(model);
      });
    },
  };
}
