import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import type { Ground } from '../rules/ground';
import { groundHeight, type WorldMap } from '../rules/world';
import { groundColourAt } from './worldView';

// The drawn ground, as square tiles of 64 x 64 cells. Near the camera the tiles are small and fine (2 m between
// points, the same lattice the driving physics uses); further away they are bigger and coarser (4, 8, then 16 m,
// about the world's own detail). A tile is built the first time it is wanted and kept for later.
// If a wanted tile is not built yet, a coarser one already built stands in, so there are never holes and never
// overlaps. All boundaries use the same 2 m lattice, including coarse tiles: no
// T-junction cracks, overlapping skirts or detail-dependent edge lighting.

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

export class TerrainTiles {
  readonly group = new THREE.Group();
  private tiles = new Map<string, Tile>();
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
    const positions: number[] = [], normals: number[] = [], colours: number[] = [], indices: number[] = [];
    const vertex = (x: number, z: number) => {
        const h = this.ground.height(x, z);
        const dx = this.ground.height(x - 2, z) - this.ground.height(x + 2, z);
        const dz = this.ground.height(x, z - 2) - this.ground.height(x, z + 2);
        const len = Math.hypot(dx, 4, dz);
        // The colour's slope is measured at the world's own grid spacing, whatever the tile's detail, so a tile
        // and its coarser neighbour agree on where the rock starts and no seams show between them.
        const sp = this.map.spacing;
        const slope = Math.hypot(groundHeight(this.map, x - sp, z) - groundHeight(this.map, x + sp, z), groundHeight(this.map, x, z - sp) - groundHeight(this.map, x, z + sp)) / (2 * sp);
        // Muddy where the ground is within a metre or two of a river's or lake's own surface, fading out smoothly.
        const lvl = this.waterNear(x, z);
        const wet = lvl > 0.5 ? 1 - Math.min(1, Math.max(0, (h - lvl + 0.5) / 2)) : 0;
        groundColourAt(this.map, x, z, h, slope, wet, this.color);
        const id = positions.length / 3;
        positions.push(x, h, z);
        normals.push(dx / len, 4 / len, dz / len);
        colours.push(this.color.r, this.color.g, this.color.b);
        return id;
    };
    for (let r = 0; r <= CELLS; r++) for (let c = 0; c <= CELLS; c++) vertex(x0 + c * cell, z0 + r * cell);
    for (let r = 0; r < CELLS; r++) for (let c = 0; c < CELLS; c++) {
      const a = r * stride + c, b = a + 1, d = a + stride, e = d + 1;
      if (r > 0 && c > 0 && r < CELLS - 1 && c < CELLS - 1) {
        indices.push(a, d, b, b, d, e);
        continue;
      }
      const perimeter: number[] = [];
      const edge = (from: number, to: number, subdivide: boolean) => {
        perimeter.push(from);
        if (!subdivide) return;
        const fx = positions[from * 3], fz = positions[from * 3 + 2];
        const tx = positions[to * 3], tz = positions[to * 3 + 2];
        for (let k = 1; k < cell / 2; k++) perimeter.push(vertex(fx + (tx - fx) * k * 2 / cell, fz + (tz - fz) * k * 2 / cell));
      };
      edge(a, d, c === 0);
      edge(d, e, r === CELLS - 1);
      edge(e, b, c === CELLS - 1);
      edge(b, a, r === 0);
      const centre = vertex(x0 + (c + 0.5) * cell, z0 + (r + 0.5) * cell);
      for (let k = 0; k < perimeter.length; k++) indices.push(centre, perimeter[k], perimeter[(k + 1) % perimeter.length]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
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
