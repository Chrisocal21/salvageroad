import * as THREE from 'three';
import { bedLoad, type BedProp } from '../rules/bedLoad';
import type { Inventory } from '../rules/inventory';

// Draws what is stored in the El Cajon's bed. Positions are in the truck's own space (+Z is the nose, 0 is the middle).

const FLOOR = -0.06; // top of the bed floor ribs
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

/** Four upright, strapped wheels in a raised rack above the wheel houses. */
function rigTire(tires: BedProp[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Four tire rack';
  // Shared rails and feet keep the tires clear of the wheel houses.
  for (const z of [-0.39, 0.39]) {
    slab(g, M.engine, [1.4, 0.06, 0.06], [0, 0.24, z]);
    for (const x of [-0.64, 0.64]) slab(g, M.engine, [0.06, 0.24, 0.08], [x, 0.12, z]);
  }
  for (let i = 0; i < tires.length; i++) {
    const wheel = new THREE.Group();
    wheel.name = `Secured tire ${i + 1}`;
    wheel.position.x = (tires[i].rackIndex! - 1.5) * 0.34;
    if (tires[i].look === 'tire') {
      wheel.scale.setScalar(0.65);
      wheel.position.y = 0.28 * (1 - 0.65);
    }
    g.add(wheel);
    const center = 0.8;
    const tire = piece(G.rigTire, M.rubber, wheel, [0, center, 0]);
    tire.rotation.y = Math.PI / 2;
    const hub = piece(G.rigHub, M.steel, wheel, [0, center, 0]);
    hub.rotation.z = Math.PI / 2;
    // Chunky tread blocks around the rolling surface.
    for (let j = 0; j < 28; j++) {
      const angle = j * Math.PI * 2 / 28;
      const tread = slab(wheel, M.rubber, [0.28, 0.045, 0.09], [0, center + Math.cos(angle) * 0.515, Math.sin(angle) * 0.515]);
      tread.rotation.x = angle;
    }
    const strapBetween = (start: THREE.Vector3, end: THREE.Vector3) => {
      const middle = start.clone().add(end).multiplyScalar(0.5);
      const strap = slab(wheel, M.paper, [0.055, start.distanceTo(end), 0.018], [middle.x, middle.y, middle.z]);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    };
    // Webbing follows the tread over the crown instead of cutting through the wheel.
    for (let j = 0; j < 20; j++) {
      const point = (n: number) => new THREE.Vector3(0, center + Math.sin(n * Math.PI / 20) * 0.55, Math.cos(n * Math.PI / 20) * 0.55);
      strapBetween(point(j), point(j + 1));
    }
    for (const z of [-0.32, 0.32]) {
      slab(wheel, M.engine, [0.31, 0.1, 0.14], [0, 0.31, z]);
      strapBetween(new THREE.Vector3(0, 0.34, z * 1.55), new THREE.Vector3(0, center, Math.sign(z) * 0.55));
      slab(wheel, M.steel, [0.085, 0.12, 0.045], [0, 0.55, Math.sign(z) * 0.53]);
    }
  }
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

/** A lidded supply crate, sized for three-high stacking. */
function crate(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.6, d = 0.5, h = 0.32, t = 0.03;
  slab(g, M.woodDark, [w, t, d], [0, t / 2, 0]);
  for (const s of [-1, 1]) {
    slab(g, M.wood, [t, h, d], [s * (w / 2 - t / 2), h / 2, 0]);
    slab(g, M.wood, [w, h, t], [0, h / 2, s * (d / 2 - t / 2)]);
  }
  for (const z of [-1, 1]) slab(g, M.woodDark, [w + 0.02, 0.03, 0.04], [0, h * 0.55, z * (d / 2)]);
  // A closed lid lets crates stack without intersecting their contents.
  slab(g, M.wood, [w, 0.035, d], [0, h + 0.0175, 0]);
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
      const tires = props.filter(prop => prop.rackIndex !== undefined);
      if (tires.length) {
        const rack = rigTire(tires);
        rack.position.set(0, FLOOR, -1.25);
        group.add(rack);
      }
      for (const prop of props.filter(prop => prop.rackIndex === undefined)) {
        const model = prop.look === 'motor' ? motor() : crate();
        model.name = prop.look === 'motor' ? 'Stored engine' : 'Stacked supply crate';
        model.position.set(prop.column === 0 ? -0.32 : 0.32, FLOOR + (prop.level ?? 0) * 0.36, -2.2);
        group.add(model);
      }
    },
  };
}
