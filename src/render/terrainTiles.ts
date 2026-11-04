import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import type { Ground } from '../rules/ground';
import { groundHeight, type WorldMap } from '../rules/world';
import { groundColourAt } from './worldView';

// The drawn ground, as square tiles of 64 x 64 cells. Near the camera the tiles are small and fine (2 m between
// points, the same lattice the driving physics uses); further away they are bigger and coarser (4, 8, then 16 m,
// about the world's own detail). A tile is built the first time it is wanted and kept for later.
// If a wanted tile is not built yet, a coarser one already built stands in, so there are never holes and never
// overlaps. Each tile has a skirt hanging down its edges so neighbours of different detail leave no cracks.

const CELLS = 64;
const ROOT = 1024; // metres: the biggest tile
const MIN = 128; // metres: the smallest tile (2 m cells)
/** A tile of this size is wanted while the camera is nearer than this many metres. */
const RANGE: Record<number, number> = { 128: 420, 256: 850, 512: 1600 };
const MAX_CACHED = 320;

interface Tile {
  mesh: THREE.Mesh;
  size: number;
  ix: number;
  iz: number;
  lastUsed: number;
}

interface Node {
  size: number;
  ix: number;
  iz: number;
}

const keyOf = (n: Node) => `${n.size}:${n.ix}:${n.iz}`;
const parentOf = (n: Node): Node => ({ size: n.size * 2, ix: Math.floor(n.ix / 2), iz: Math.floor(n.iz / 2) });

/** Index list shared by every tile, since every tile has the same layout. */
function sharedIndex(): THREE.BufferAttribute {
  const stride = CELLS + 1;
  const skirtBase = stride * stride; // skirt vertices follow the surface vertices: north, south, west, east
  const index: number[] = [];
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  // Each skirt strip joins an edge of the surface to its lowered copy.
  const edge = (surface: (k: number) => number, lowBase: number) => {
    for (let k = 0; k < CELLS; k++) {
      const s0 = surface(k);
      const s1 = surface(k + 1);
      const l0 = lowBase + k;
      const l1 = lowBase + k + 1;
      index.push(s0, l0, s1, s1, l0, l1);
    }
  };
  edge((k) => k, skirtBase); // north edge, row 0
  edge((k) => CELLS * stride + k, skirtBase + stride); // south edge
  edge((k) => k * stride, skirtBase + 2 * stride); // west edge
  edge((k) => k * stride + CELLS, skirtBase + 3 * stride); // east edge
  return new THREE.BufferAttribute(new Uint32Array(index), 1);
}

export class TerrainTiles {
  readonly group = new THREE.Group();
  private tiles = new Map<string, Tile>();
  private index = sharedIndex();
  private material = worldMaterial('terrain', { vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  private frame = 0;
  private color = new THREE.Color();
  /** How many tiles are drawn right now, and how many have been built and kept. */
  drawn = 0;

  constructor(
    private map: WorldMap,
    private ground: Ground,
  ) {}

  get built(): number {
    return this.tiles.size;
  }

  private build(node: Node): Tile {
    const { size, ix, iz } = node;
    const cell = size / CELLS;
    const x0 = ix * size;
    const z0 = iz * size;
    const stride = CELLS + 1;
    const border = CELLS + 3; // one extra ring of heights all round, to get the slope at the edges
    const heights = new Float32Array(border * border);
    for (let r = -1; r <= CELLS + 1; r++) {
      for (let c = -1; c <= CELLS + 1; c++) {
        heights[(r + 1) * border + (c + 1)] = this.ground.height(x0 + c * cell, z0 + r * cell);
      }
    }
    const surface = stride * stride;
    const count = surface + 4 * stride;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const drop = Math.max(2, cell * 1.5);
    const put = (v: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color) => {
      positions[v * 3] = x;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = z;
      normals[v * 3] = nx;
      normals[v * 3 + 1] = ny;
      normals[v * 3 + 2] = nz;
      colours[v * 3] = c.r;
      colours[v * 3 + 1] = c.g;
      colours[v * 3 + 2] = c.b;
    };
    for (let r = 0; r <= CELLS; r++) {
      for (let c = 0; c <= CELLS; c++) {
        const at = (rr: number, cc: number) => heights[(rr + 1) * border + (cc + 1)];
        const h = at(r, c);
        const dx = at(r, c - 1) - at(r, c + 1);
        const dz = at(r - 1, c) - at(r + 1, c);
        const len = Math.hypot(dx, 2 * cell, dz);
        const x = x0 + c * cell;
        const z = z0 + r * cell;
        // The colour's slope is measured at the world's own grid spacing, whatever the tile's detail, so a tile
        // and its coarser neighbour agree on where the rock starts and no seams show between them.
        const sp = this.map.spacing;
        const slope = Math.hypot(groundHeight(this.map, x - sp, z) - groundHeight(this.map, x + sp, z), groundHeight(this.map, x, z - sp) - groundHeight(this.map, x, z + sp)) / (2 * sp);
        // Muddy where the ground is within a metre or two of a river's or lake's own surface, fading out smoothly.
        const lvl = this.waterNear(x, z);
        const wet = lvl > 0.5 ? 1 - Math.min(1, Math.max(0, (h - lvl + 0.5) / 2)) : 0;
        groundColourAt(this.map, x, z, h, slope, wet, this.color);
        const v = r * stride + c;
        put(v, x, h, z, dx / len, (2 * cell) / len, dz / len, this.color);
        // Skirt copies of the edge vertices, hung lower.
        if (r === 0) put(surface + c, x, h - drop, z, dx / len, (2 * cell) / len, dz / len, this.color);
        if (r === CELLS) put(surface + stride + c, x, h - drop, z, dx / len, (2 * cell) / len, dz / len, this.color);
        if (c === 0) put(surface + 2 * stride + r, x, h - drop, z, dx / len, (2 * cell) / len, dz / len, this.color);
        if (c === CELLS) put(surface + 3 * stride + r, x, h - drop, z, dx / len, (2 * cell) / len, dz / len, this.color);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setIndex(this.index);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.visible = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    const tile: Tile = { mesh, size, ix, iz, lastUsed: this.frame };
    this.tiles.set(keyOf(node), tile);
    return tile;
  }

  /** The highest water surface at the four grid points round a position, or NO_WATER. */
  private waterNear(x: number, z: number): number {
    const m = this.map;
    const col = Math.min(m.n - 2, Math.max(0, Math.floor((x + m.half) / m.spacing)));
    const row = Math.min(m.n - 2, Math.max(0, Math.floor((z + m.half) / m.spacing)));
    const i = row * m.n + col;
    return Math.max(m.water[i], m.water[i + 1], m.water[i + m.n], m.water[i + m.n + 1]);
  }

  /** Distance from a point to a tile (nearest edge, with the camera height as the vertical distance). */
  private distance(node: Node, cx: number, cz: number, height: number): number {
    const x0 = node.ix * node.size;
    const z0 = node.iz * node.size;
    const dx = Math.max(x0 - cx, 0, cx - (x0 + node.size));
    const dz = Math.max(z0 - cz, 0, cz - (z0 + node.size));
    return Math.hypot(dx, dz, height);
  }

  private wanted(cam: THREE.Vector3): Node[] {
    const half = this.map.half;
    const height = Math.max(0, cam.y - this.ground.height(cam.x, cam.z));
    const out: Node[] = [];
    const visit = (node: Node) => {
      const x0 = node.ix * node.size;
      const z0 = node.iz * node.size;
      if (x0 >= half || z0 >= half || x0 + node.size <= -half || z0 + node.size <= -half) return; // all outside the map: open sea
      const child = node.size / 2;
      if (child >= MIN && this.distance(node, cam.x, cam.z, height) < RANGE[child]) {
        for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) visit({ size: child, ix: node.ix * 2 + dx, iz: node.iz * 2 + dz });
      } else {
        out.push(node);
      }
    };
    for (let iz = Math.floor(-half / ROOT); iz < Math.ceil(half / ROOT); iz++) {
      for (let ix = Math.floor(-half / ROOT); ix < Math.ceil(half / ROOT); ix++) visit({ size: ROOT, ix, iz });
    }
    return out;
  }

  /**
   * Chooses what to draw for this camera position and builds what is missing, up to the budget (a number of
   * tiles). Pass Infinity to build everything wanted at once, which is what you want the first time.
   */
  update(cam: THREE.Vector3, budget = 3): void {
    this.frame++;
    const wanted = this.wanted(cam);
    const show = new Map<string, Tile>();
    const missing: { node: Node; d: number }[] = [];
    const height = Math.max(0, cam.y - this.ground.height(cam.x, cam.z));
    for (const node of wanted) {
      const tile = this.tiles.get(keyOf(node));
      if (tile) {
        show.set(keyOf(node), tile);
      } else {
        missing.push({ node, d: this.distance(node, cam.x, cam.z, height) });
      }
    }
    missing.sort((a, b) => a.d - b.d);
    let built = 0;
    for (const { node } of missing) {
      if (built < budget) {
        show.set(keyOf(node), this.build(node));
        built++;
        continue;
      }
      // Not built yet: borrow the nearest coarser tile that is, so there is no hole. Build the root if need be.
      let up = parentOf(node);
      for (;;) {
        const tile = this.tiles.get(keyOf(up));
        if (tile) {
          show.set(keyOf(up), tile);
          break;
        }
        if (up.size >= ROOT) {
          show.set(keyOf(up), this.build(up));
          break;
        }
        up = parentOf(up);
      }
    }
    // A borrowed tile covers its neighbours too, so drop any tile that sits under another one that is drawn.
    for (const [key, tile] of show) {
      let up: Node = parentOf(tile);
      while (up.size <= ROOT) {
        if (show.has(keyOf(up))) {
          show.delete(key);
          break;
        }
        up = parentOf(up);
      }
    }
    for (const [key, tile] of this.tiles) {
      const on = show.has(key);
      tile.mesh.visible = on;
      if (on) tile.lastUsed = this.frame;
    }
    this.drawn = show.size;

    // Forget tiles that have not been needed for a long time.
    if (this.tiles.size > MAX_CACHED) {
      const old = [...this.tiles.entries()].filter(([, t]) => t.size < ROOT && this.frame - t.lastUsed > 120);
      old.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [key, tile] of old.slice(0, this.tiles.size - MAX_CACHED)) {
        this.group.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        this.tiles.delete(key);
      }
    }
  }
}
