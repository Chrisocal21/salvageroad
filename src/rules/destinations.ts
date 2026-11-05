import { CONTAINERS } from '../data/containers';
import type { Box2 } from './geometry';
import type { Ground } from './ground';
import type { Dock, Plan } from './places';
import { ROAD_SPEC, type RoadNetwork } from './roads';
import { generateJunkyard, generateTown, localBox, storeWalls, type ContainerSpawn, type Town } from './town';
import { isDryFootprint, type WorldMap } from './world';
import { makeRandom } from './scatter';

/** Road-end facilities share town loot/door/collision handling, not residential lots. */
export function generateDestinations(seed: number, plan: Plan, network: RoadNetwork, offset: number, map?: WorldMap): Town[] {
  const sites: Town[] = [];
  const salvageIds = new Set(plan.places.filter(p => p.kind === 'outpost').filter((_, i) => i % 2 === 0).map(p => p.id));
  for (const p of plan.places.filter(p => !['city', 'town', 'village'].includes(p.kind))) {
    // Project onto segments, not samples: the driveway must touch the actual formation.
    const gates = network.roads.flatMap(r => r.points.slice(1).flatMap((b, i) => {
      const a = r.points[i];
      if (a.bridge || b.bridge) return [];
      const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
      const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2)) : 0;
      return [{ x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t }];
    })).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    let chosen: { gate: typeof gates[number]; cx: number; cz: number; turn: number } | undefined;
    // A conservative whole-compound setback also protects diagonal road shoulders.
    // Quarter turns preserve the axis-aligned door, worldBox and wall conventions.
    search: for (const distance of [80, 110, 150, 210, 290]) for (const gate of gates) {
      if (Math.hypot(gate.x - p.x, gate.z - p.z) > 350) continue;
      for (let turn = 0; turn < 4; turn++) {
        const cx = gate.x + Math.round(Math.sin(turn * Math.PI / 2)) * distance;
        const cz = gate.z + Math.round(Math.cos(turn * Math.PI / 2)) * distance;
        const bounds = { x: cx, z: cz, hx: 48, hz: 48 };
        if (map && (!isDryFootprint(map, bounds, map.spacing * 3) ||
          !isDryFootprint(map, { x: (gate.x + cx) / 2, z: (gate.z + cz) / 2,
            hx: Math.abs(gate.x - cx) / 2 + 6, hz: Math.abs(gate.z - cz) / 2 + 6 }, map.spacing * 3))) continue;
        if (p.kind === 'dock') {
          const shore = (p as Dock).shore;
          if (Math.abs(cx - shore.x) < 80 && Math.abs(cz - shore.z) < 80) continue;
        }
        if (network.roads.some(r => r.points.slice(1).some((b, i) =>
          segmentHitsBox(r.points[i], b, bounds, ROAD_SPEC[r.class].width / 2 + 3)))) continue;
        if (sites.some(s => Math.abs(s.center.x - cx) < 100 && Math.abs(s.center.z - cz) < 100)) continue;
        chosen = { gate, cx, cz, turn };
        break search;
      }
    }
    if (!chosen) throw new Error(`No road-clear destination layout for ${p.name} (${p.id})`);
    const { gate, cx, cz, turn } = chosen;
    const military = p.kind === 'industrial';
    const dock = p.kind === 'dock';
    const salvage = salvageIds.has(p.id);
    if (military) p.name = 'Fort Iron Logistics';
    else if (salvage && !p.name.endsWith('Salvage Yard')) p.name = `${p.name.replace(/ Freight Depot$/, '')} Salvage Yard`;
    else if (!dock && !salvage && !p.name.endsWith('Depot')) p.name = `${p.name} ${p.kind === 'lookout' ? 'Relay Depot' : 'Freight Depot'}`;
    const site = generateTown(seed + p.id, { x: cx, z: cz }, { grid: 1, junkyard: false });
    site.siteKind = salvage ? 'salvage' : military ? 'military' : dock ? 'dock' : p.kind === 'lookout' ? 'lookout' : 'depot';
    site.placeId = p.id;
    site.groundY = gate.y;
    site.roadsX = [];
    site.roadsZ = [];
    site.accessLanes = [{ from: { ...gate }, to: { x: cx, z: cz, y: gate.y }, width: 12 }];
    site.yard = { x: cx, z: cz, hx: 19, hz: 19 };
    site.buildings = [];
    site.containers = [];
    site.solids = [];
    site.fixtures = [];
    // Keep a full turning court clear. Doors open towards the court.
    const count = military ? 3 : dock ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const side = i === 1 ? 1 : -1;
      const b = {
        id: offset++, x: cx + (i === 2 ? 0 : side * 31), z: cz + (i === 2 ? 32 : 0),
        hx: i === 2 ? 10 : 8, hz: i === 2 ? 7 : dock ? 15 : 10,
        height: military ? 4 : dock ? 7 : 5,
        color: military ? 0x65705a : dock ? 0x6d8294 : 0x947b57,
        store: military ? 'barracks' as const : 'warehouse' as const,
        front: i === 2 ? Math.PI : side < 0 ? Math.PI / 2 : -Math.PI / 2,
      };
      site.buildings.push(b);
      site.solids.push(...storeWalls(b).map(w => ({ ...w, height: b.height })));
      for (let k = 0; k < 3; k++) {
        const kind = military ? 'locker' as const : k === 0 ? 'toolbox' as const : 'crate' as const;
        const def = CONTAINERS[kind];
        site.containers.push({ id: offset++, kind, x: b.x - 4 + k * 4, z: b.z - b.hz + 2, hx: def.hx, hz: def.hz, height: def.height, inside: b.id });
      }
    }
    if (military) {
      // One explicit entrance on -Z, aligned with the access drive.
      for (const s of [-1, 1]) for (const t of [-1, 1]) {
        site.fixtures.push({ x: cx + s * 46, z: cz + t * 23, hx: 0.6, hz: 23, height: 2.4, color: 0x69705d });
        site.fixtures.push({ x: cx + s * 27, z: cz + t * 46, hx: 19, hz: 0.6, height: 2.4, color: 0x69705d });
      }
      site.fixtures.push({ x: cx + 34, z: cz + 32, hx: 3, hz: 3, height: 10, color: 0x414c3d });
    }
    for (let n = 0; n < turn; n++) {
      const rotate = (b: Box2) => {
        const x = b.x - cx, z = b.z - cz;
        b.x = cx + z; b.z = cz - x;
        [b.hx, b.hz] = [b.hz, b.hx];
      };
      for (const b of [...site.buildings, ...site.containers, ...site.solids, ...site.fixtures]) rotate(b);
      for (const b of site.buildings) b.front! += Math.PI / 2;
    }
    if (salvage) {
      const containers: ContainerSpawn[] = [];
      const yard = generateJunkyard(makeRandom(seed * 31 + p.id * 7919), 0, 0, containers, false);
      const yaw = (turn + 2) * Math.PI / 2;
      site.salvage = { yard, yaw };
      for (const box of [...yard.fence, ...yard.wrecks.filter(w => !w.model), yard.shed, ...yard.tires])
        site.solids.push({ ...localBox(cx, cz, yaw, box.x, box.z, box.hx, box.hz), height: box.height });
      for (const c of containers)
        site.containers.push({ ...c, ...localBox(cx, cz, yaw, c.x, c.z, c.hx, c.hz), id: offset++ });
    }
    if (dock) {
      const d = p as Dock;
      const qx = d.shore.x, qz = d.shore.z;
      // Keep the sea deck local to the quay; a routed drive connects the inland court.
      site.quay = { x: qx, z: qz, hx: 22, hz: 28 };
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue; // central ten-metre freight lane stays open to the quay
        site.fixtures.push({ x: qx + (i - 2) * 12, z: qz + 20, hx: 3, hz: 6, height: i % 2 ? 5.2 : 2.6, color: [0x96594b, 0x557a81, 0x9b8b51][i % 3] });
      }
      // Two tall gantry legs and a cross-yard boom distinguish the working quay.
      for (const s of [-1, 1]) site.fixtures.push({ x: qx + s * 13, z: qz, hx: 1, hz: 1, height: 17, color: 0xb69b45 });
      site.overhead = [{ x: qx, z: qz, hx: 15, hz: 1, y0: 16, height: 1.5, color: 0xb69b45 }];
      // Quay equipment must obey the same all-segment clearance as land-side buildings.
      for (const f of site.fixtures) {
        const x = f.x, z = f.z;
        let placed = false;
        for (const shift of [0, 12, -12, 24, -24, 48, -48, 80, -80]) {
          f.z = z + shift;
          if (segmentHitsBox({ x: qx, z: qz }, { x: qx, z: qz }, f, 6) ||
            segmentHitsBox({ x: cx, z: cz }, { x: cx, z: cz }, f, 6)) continue;
          if (network.roads.some(r => r.points.slice(1).some((b, i) =>
            segmentHitsBox(r.points[i], b, f, ROAD_SPEC[r.class].width / 2 + 3)))) continue;
          if ([...site.buildings, ...site.fixtures.filter(other => other !== f)].some(other =>
            Math.abs(f.x - other.x) < f.hx + other.hx + 2 && Math.abs(f.z - other.z) < f.hz + other.hz + 2)) continue;
          placed = true; break;
        }
        if (!placed) throw new Error(`No road-clear quay equipment position for ${p.name} at ${x},${z}`);
      }
      const start = { x: cx, z: cz, y: gate.y }, end = { x: qx, z: qz, y: gate.y };
      const obstacles = [...site.buildings, ...site.fixtures];
      const nodes = [start, end, ...obstacles.flatMap(b => [-1, 1].flatMap(sx => [-1, 1].map(sz =>
        ({ x: b.x + sx * (b.hx + 7), z: b.z + sz * (b.hz + 7), y: gate.y }))))];
      const distance = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
      distance[0] = 0;
      while (visited.size < nodes.length) {
        let current = -1;
        for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || distance[i] < distance[current])) current = i;
        if (current < 0 || !Number.isFinite(distance[current]) || current === 1) break;
        visited.add(current);
        for (let i = 0; i < nodes.length; i++) {
          if (visited.has(i) || obstacles.some(box => segmentHitsBox(nodes[current], nodes[i], box, 6))) continue;
          const d = distance[current] + Math.hypot(nodes[i].x - nodes[current].x, nodes[i].z - nodes[current].z);
          if (d < distance[i]) { distance[i] = d; previous[i] = current; }
        }
      }
      if (!Number.isFinite(distance[1])) throw new Error(`No unobstructed quay drive for ${p.name}`);
      const path = [end];
      for (let i = previous[1]; i >= 0; i = previous[i]) path.unshift(nodes[i]);
      for (let i = 1; i < path.length; i++) site.accessLanes!.push({ from: path[i - 1], to: path[i], width: 12 });
    }
    site.solids.push(...site.fixtures);
    sites.push(site);
  }
  const salvageSites = sites.filter(s => s.salvage);
  if (salvageSites.length > 1) {
    const trailerYard = salvageSites.at(-1)!.salvage!.yard;
    trailerYard.wrecks = trailerYard.wrecks.filter(w => w.model !== 'big-rig');
  }
  salvageSites.slice(0, 2).forEach((site, index) => {
    site.salvage!.yard.wrecks.push({
      x: 9, z: -2, hx: index ? 1.5 : 1.3, hz: index ? 3.7 : 3.15, height: index ? 3.3 : 2.9,
      turned: false, color: 0xb5824a, model: index ? 'step-van' : 'salvage-pickup',
    });
  });
  return sites;
}

const contains = (b: Box2, x: number, z: number) => Math.abs(x - b.x) <= b.hx && Math.abs(z - b.z) <= b.hz;

/** Slab intersection includes the complete segment, even when both samples are far away. */
export function segmentHitsBox(a: { x: number; z: number }, b: { x: number; z: number }, box: Box2, margin = 0): boolean {
  let lo = 0, hi = 1;
  for (const axis of ['x', 'z'] as const) {
    const half = (axis === 'x' ? box.hx : box.hz) + margin;
    const delta = b[axis] - a[axis], min = box[axis] - half, max = box[axis] + half;
    if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) return false; }
    else {
      const t0 = (min - a[axis]) / delta, t1 = (max - a[axis]) / delta;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
      if (lo > hi) return false;
    }
  }
  return true;
}

/** Concrete decks remain above water; warehouse foundations locally level the terrain. */
export function installDestinationGround(ground: Ground, sites: Town[]): void {
  const height = ground.height, surface = ground.surface;
  const pads = new Map<number, (Box2 & { y: number })[]>();
  const key = (x: number, z: number) => (Math.floor(x / 64) + 512) * 2048 + Math.floor(z / 64) + 512;
  for (const s of sites) for (const b of [
    ...s.buildings, ...(s.fixtures ?? []), ...(s.yard ? [{ ...s.yard, hx: s.yard.hx + 6, hz: s.yard.hz + 6 }] : []),
    // The land-side drive is an earthwork, not an unsupported ribbon above (or below) terrain.
    // Quay drives remain decks so they do not fill the sea.
    ...(s.accessLanes?.slice(0, 1).map(lane => ({
      x: (lane.from.x + lane.to.x) / 2, z: (lane.from.z + lane.to.z) / 2,
      hx: Math.abs(lane.to.x - lane.from.x) / 2 + lane.width / 2 + 8,
      hz: Math.abs(lane.to.z - lane.from.z) / 2 + lane.width / 2 + 8,
    })) ?? []),
  ]) {
    const pad = { ...b, y: s.groundY! };
    for (let x = Math.floor((b.x - b.hx - 6) / 64); x <= Math.floor((b.x + b.hx + 6) / 64); x++)
      for (let z = Math.floor((b.z - b.hz - 6) / 64); z <= Math.floor((b.z + b.hz + 6) / 64); z++) {
        const k = key(x * 64, z * 64);
        const bucket = pads.get(k) ?? [];
        bucket.push(pad); pads.set(k, bucket);
      }
  }
  ground.height = (x, z) => {
    let h = height(x, z);
    // Facilities never regrade the validated road formation or its shoulders.
    if (ground.roadDistance(x, z) <= 23) return h;
    for (const b of pads.get(key(x, z)) ?? []) {
      const edge = Math.max(Math.abs(x - b.x) - b.hx, Math.abs(z - b.z) - b.hz);
      if (edge >= 6) continue;
      const t = Math.max(0, edge / 6);
      h = b.y + (h - b.y) * t * t * (3 - 2 * t);
    }
    if (h > 0) for (const s of sites) for (const lane of s.accessLanes?.slice(1) ?? []) {
      const dx = lane.to.x - lane.from.x, dz = lane.to.z - lane.from.z, l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - lane.from.x) * dx + (z - lane.from.z) * dz) / l2)) : 0;
      const edge = Math.hypot(x - lane.from.x - dx * t, z - lane.from.z - dz * t) - lane.width / 2 - 8;
      if (edge < 6) {
        const blend = Math.max(0, edge / 6), y = lane.from.y + (lane.to.y - lane.from.y) * t;
        h = y + (h - y) * blend * blend * (3 - 2 * blend);
      }
    }
    return h;
  };
  ground.surface = (x, z) => {
    if (ground.roadDistance(x, z) <= 23) return surface(x, z);
    for (const s of sites) if (s.quay && contains(s.quay, x, z)) return Math.max(surface(x, z), s.groundY!);
    for (const s of sites) {
      if (s.yard && contains(s.yard, x, z)) return s.groundY!;
      for (const lane of s.accessLanes ?? []) {
        const dx = lane.to.x - lane.from.x, dz = lane.to.z - lane.from.z, l2 = dx * dx + dz * dz;
        const t = l2 ? Math.max(0, Math.min(1, ((x - lane.from.x) * dx + (z - lane.from.z) * dz) / l2)) : 0;
        if (Math.hypot(x - lane.from.x - dx * t, z - lane.from.z - dz * t) <= lane.width / 2) {
          if (lane === s.accessLanes![0]) return surface(x, z) - height(x, z) + ground.height(x, z);
          // Keep the road formation at the entrance, then ease onto the level court.
          const blend = Math.min(1, t * Math.sqrt(l2) / 24);
          const y = lane.from.y + (lane.to.y - lane.from.y) * t;
          return surface(x, z) * (1 - blend) + y * blend;
        }
      }
    }
    return surface(x, z) - height(x, z) + ground.height(x, z);
  };
}
