import RAPIER from '@dimforge/rapier3d-compat';
import type { BuildBox } from '../rules/baseWorld';
import { resistanceForce, resolvePedals, updateSteer } from '../rules/driving';
import { PROP_COLLIDER, type Prop } from '../rules/scatter';
import { columnMajor, terrainHeight, type TerrainGrid } from '../rules/terrain';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';
import { TRAILER } from '../rules/trailer';

type Quat = [number, number, number, number]; // x, y, z, w
let rapierReady: Promise<void> | undefined;

/** What the world is made of. With nothing given it is the flat lab ground. */
export interface WorldSpec {
  vehicle?: Partial<{ [K in keyof typeof CAR]: typeof CAR[K] extends readonly number[] ? readonly [number, number, number] : number }>;
  rearAxles?: number[];
  engineScale?: number;
  spawnHeight?: number;
  fifthWheel?: boolean;
  terrain?: TerrainGrid;
  /**
   * Ground height anywhere, for a big world. The ground is then built as small collider tiles that follow the car
   * (see setFocus), instead of one heightfield for the whole map. Replaces terrain, and the lab's ramp is left out.
   */
  ground?: (x: number, z: number) => number;
  props?: Prop[];
  /** Solid boxes standing on the ground, such as buildings and containers. height is full height. */
  boxes?: { x: number; z: number; hx: number; hz: number; height: number; tree?: boolean }[];
  /** Solid blocks of the player's base (containers and pillars), standing on level ground. */
  buildBoxes?: BuildBox[];
  /** Where the truck starts. Defaults to the lab spawn point. */
  carSpawn?: { x: number; z: number; yaw: number };
}

/** Rapier's heightfield, built from the same grid the visible terrain mesh uses. */
export function heightfieldDesc(grid: TerrainGrid): RAPIER.ColliderDesc {
  // Rapier counts cells, not vertices: a grid of N cells has N + 1 heights along each side.
  return RAPIER.ColliderDesc.heightfield(
    grid.nrows - 1,
    grid.ncols - 1,
    columnMajor(grid),
    { x: grid.spec.size, y: 1, z: grid.spec.size },
  );
}

export async function createRapierSim(spec: WorldSpec = {}): Promise<CarSim> {
  // Concurrent initialization replaces Rapier's shared WASM state while worlds are being created.
  await (rapierReady ??= RAPIER.init());
  const tuning = { ...CAR, ...spec.vehicle };
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;

  // Rolling ground: 64 m square heightfield tiles, 2 m between points, kept in a ring round the car. The 2 m lattice
  // is the same one the finest drawn terrain tiles use, so what you see is what you drive on.
  const TILE = 64;
  const TILE_CELLS = 32;
  const REACH = 224; // metres of ground kept built round the car
  const groundTiles = new Map<string, RAPIER.Collider>();
  function groundTile(ix: number, iz: number): RAPIER.Collider {
    const cell = TILE / TILE_CELLS;
    const n = TILE_CELLS + 1;
    const heights = new Float32Array(n * n);
    for (let col = 0; col < n; col++) {
      for (let row = 0; row < n; row++) heights[col * n + row] = spec.ground!(ix * TILE + col * cell, iz * TILE + row * cell);
    }
    return world.createCollider(
      RAPIER.ColliderDesc.heightfield(TILE_CELLS, TILE_CELLS, heights, { x: TILE, y: 1, z: TILE }).setTranslation(
        ix * TILE + TILE / 2,
        0,
        iz * TILE + TILE / 2,
      ),
    );
  }
  /** Builds missing ground tiles near (x, z), at most maxNew of them, and drops the ones far away. */
  function setFocus(x: number, z: number, maxNew = 6) {
    if (!spec.ground) return;
    const r = Math.ceil(REACH / TILE);
    const cx = Math.floor(x / TILE);
    const cz = Math.floor(z / TILE);
    const need = new Set<string>();
    let made = 0;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const key = `${cx + dx}:${cz + dz}`;
        need.add(key);
        if (!groundTiles.has(key) && made < maxNew) {
          groundTiles.set(key, groundTile(cx + dx, cz + dz));
          made++;
        }
      }
    }
    for (const [key, collider] of groundTiles) {
      if (!need.has(key)) {
        world.removeCollider(collider, true);
        groundTiles.delete(key);
      }
    }
  }

  if (spec.ground) {
    // tiles are built below, once we know where the car starts
  } else if (spec.terrain) {
    world.createCollider(heightfieldDesc(spec.terrain));
  } else {
    world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
  }

  // Static boxes for the props. Trees collide as their trunk only.
  const seed = spec.terrain?.spec.seed ?? 0;
  const groundAt = spec.ground ?? ((x: number, z: number) => terrainHeight(seed, x, z));
  const treeColliders = new Map<string, RAPIER.Collider[]>();
  const rememberTree = (x: number, z: number, collider: RAPIER.Collider) => {
    const key = `${x},${z}`;
    treeColliders.set(key, [...(treeColliders.get(key) ?? []), collider]);
  };
  for (const prop of spec.props ?? []) {
    if (prop.cut) continue;
    const c = PROP_COLLIDER[prop.kind];
    const hx = c.hx * prop.scale;
    const hy = c.hy * prop.scale;
    const hz = c.hz * prop.scale;
    const half = prop.yaw / 2;
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(prop.x, groundAt(prop.x, prop.z) + hy, prop.z)
        .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }),
    );
    if (prop.kind === 'tree') rememberTree(prop.x, prop.z, collider);
  }

  if (!spec.ground) {
    const half = RAMP.pitch / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(...RAMP.halfExtents)
        .setTranslation(...RAMP.center)
        .setRotation({ x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) }),
    );
  }

  for (const b of spec.boxes ?? []) {
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(b.hx, b.height / 2, b.hz).setTranslation(
        b.x,
        groundAt(b.x, b.z) + b.height / 2,
        b.z,
      ),
    );
    if (b.tree) rememberTree(b.x, b.z, collider);
  }

  // The player's base. Can be replaced while the world runs, so building does not reset the truck.
  let buildColliders: RAPIER.Collider[] = [];
  function setBuildBoxes(boxes: BuildBox[]) {
    for (const c of buildColliders) world.removeCollider(c, true);
    buildColliders = boxes.map((b) =>
      world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx, b.height / 2, b.hz).setTranslation(b.x, b.y0 + b.height / 2, b.z)),
    );
  }
  setBuildBoxes(spec.buildBoxes ?? []);

  const spawn = spec.carSpawn
    ? { x: spec.carSpawn.x, y: groundAt(spec.carSpawn.x, spec.carSpawn.z) + (spec.spawnHeight ?? 1), z: spec.carSpawn.z, yaw: spec.carSpawn.yaw }
    : { x: tuning.spawn[0], y: tuning.spawn[1], z: tuning.spawn[2], yaw: 0 };
  setFocus(spawn.x, spawn.z, Infinity); // ground under the car before the first step
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setRotation({ x: 0, y: Math.sin(spawn.yaw / 2), z: 0, w: Math.cos(spawn.yaw / 2) })
      .setAngularDamping(0.4)
      .setCanSleep(false),
  );
  // A solid box with the same mass, but with the centre of mass moved up so the body can lean.
  const [hx, hy, hz] = tuning.halfExtents;
  const m = tuning.mass / 3;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, spec.fifthWheel ? 2.825 : hz)
      .setTranslation(0, 0, spec.fifthWheel ? 1.525 : 0).setMassProperties(
      tuning.mass,
      { x: 0, y: tuning.centerOfMassY, z: spec.fifthWheel ? -1.525 : 0 },
      { x: m * (hy * hy + hz * hz), y: m * (hx * hx + hz * hz), z: m * (hx * hx + hy * hy) },
      { x: 0, y: 0, z: 0, w: 1 },
    ),
    body,
  );
  if (spec.fifthWheel) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.3, .2, 1.525)
      .setTranslation(0, -1.15, -2.825).setMass(0), body);
  }

  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;

  // Order: front-left, front-right, rear-left, rear-right.
  const points: [number, number][] = [
    [-tuning.wheelX, tuning.wheelFrontZ],
    [tuning.wheelX, tuning.wheelFrontZ],
    ...(spec.rearAxles ?? [tuning.wheelRearZ]).flatMap(z => [[-tuning.wheelX, z], [tuning.wheelX, z]] as [number, number][]),
  ];
  points.forEach(([x, z], i) => {
    vehicle.addWheel(
      { x, y: tuning.wheelY, z },
      { x: 0, y: -1, z: 0 },
      { x: -1, y: 0, z: 0 },
      tuning.suspensionRest,
      tuning.wheelRadius,
    );
    vehicle.setWheelSuspensionStiffness(i, tuning.suspensionStiffness);
    vehicle.setWheelSuspensionCompression(i, tuning.suspensionCompression);
    vehicle.setWheelSuspensionRelaxation(i, tuning.suspensionRelaxation);
    vehicle.setWheelMaxSuspensionTravel(i, tuning.suspensionTravel);
    vehicle.setWheelFrictionSlip(i, 1.4);
    vehicle.setWheelMaxSuspensionForce(i, 100000);
  });

  const otherVehicles = new Map<number, RAPIER.Collider>();
  let trailer: { body: RAPIER.RigidBody; wheels: RAPIER.DynamicRayCastVehicleController; cargo: RAPIER.Collider[] } | null = null;
  function detachTrailer() {
    if (!trailer) return;
    world.removeVehicleController(trailer.wheels);
    world.removeRigidBody(trailer.body);
    trailer = null;
  }

  let steerAngle = 0; // current wheel angle in radians, positive is right
  let spin = 0; // wheel roll angle in radians, for looks only

  return {
    name: 'rapier',
    removeVehicleObstacle(id) {
      const collider = otherVehicles.get(id);
      if (collider) world.removeCollider(collider, true);
      otherVehicles.delete(id);
    },
    attachTrailer(pose) {
      if (trailer) throw new Error('A trailer is already attached');
      const [x, y, z] = pose.position, [qx, qy, qz, qw] = pose.quaternion;
      const trailerBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z).setRotation({ x: qx, y: qy, z: qz, w: qw })
        .setAngularDamping(.8).setCanSleep(false).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.cuboid(...TRAILER.half).setMass(1800), trailerBody);
      const wheels = world.createVehicleController(trailerBody);
      wheels.indexUpAxis = 1;
      wheels.setIndexForwardAxis = 2;
      for (const axle of TRAILER.axleZ) for (const side of [-1, 1]) {
        const i = wheels.numWheels();
        wheels.addWheel({ x: side * 1.05, y: -.2, z: axle }, { x: 0, y: -1, z: 0 },
          { x: -1, y: 0, z: 0 }, .35, TRAILER.wheelRadius);
        wheels.setWheelSuspensionStiffness(i, 30);
        wheels.setWheelSuspensionCompression(i, 3);
        wheels.setWheelSuspensionRelaxation(i, 4);
        wheels.setWheelFrictionSlip(i, 1.4);
        wheels.setWheelMaxSuspensionForce(i, 100000);
      }
      const joint = world.createImpulseJoint(RAPIER.JointData.spherical(
        { x: 0, y: TRAILER.rigHitchY, z: TRAILER.rigHitchZ },
        { x: 0, y: 0, z: TRAILER.hitchZ }), body, trailerBody, true);
      joint.setContactsEnabled(false);
      trailer = { body: trailerBody, wheels, cargo: [] };
    },
    detachTrailer,
    trailerPose() {
      if (!trailer) return null;
      const p = trailer.body.translation(), q = trailer.body.rotation();
      return { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] };
    },
    setTrailerCargo(lengths) {
      if (!trailer) throw new Error('Cannot load a trailer that is not attached');
      for (const collider of trailer.cargo) world.removeCollider(collider, true);
      let rear = -3.5;
      trailer.cargo = lengths.map(length => {
        const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(1.2192, 1.2954, length / 2)
          .setTranslation(0, TRAILER.deckHeight + 1.2954, rear + length / 2).setMass(length * 220), trailer!.body);
        rear += length;
        return collider;
      });
    },
    setVehicleObstacle(pose, halfExtents, id = 0) {
      let otherVehicle = otherVehicles.get(id);
      if (!otherVehicle) {
        otherVehicle = world.createCollider(RAPIER.ColliderDesc.cuboid(...halfExtents));
        otherVehicles.set(id, otherVehicle);
      }
      const [x,y,z] = pose.position, [qx,qy,qz,qw] = pose.quaternion;
      otherVehicle.setHalfExtents({ x: halfExtents[0], y: halfExtents[1], z: halfExtents[2] });
      otherVehicle.setTranslation({ x,y,z });
      otherVehicle.setRotation({ x:qx, y:qy, z:qz, w:qw });
    },
    step(dt, input: DriveInput) {
      const speed = vehicle.currentVehicleSpeed();
      const pedals = resolvePedals(input.throttle, input.brake, speed);

      // Rear-wheel drive: split the engine force over the two rear wheels.
      for (let i = 2; i < points.length; i++) vehicle.setWheelEngineForce(i, pedals.engine * (spec.engineScale ?? 1) / (points.length - 2));

      // Positive steer means right, which is -X when facing +Z.
      steerAngle = updateSteer(steerAngle, input.steer, Math.abs(speed), dt);
      vehicle.setWheelSteering(0, -steerAngle);
      vehicle.setWheelSteering(1, -steerAngle);

      // Service brake works on all four wheels, handbrake on the rear pair only.
      const front = pedals.brake * tuning.maxBrake;
      const rear = Math.max(pedals.brake, pedals.handbrake) * tuning.maxBrake;
      vehicle.setWheelBrake(0, front);
      vehicle.setWheelBrake(1, front);
      for (let i = 2; i < points.length; i++) vehicle.setWheelBrake(i, rear);

      // Air drag and rolling resistance, pushing against the direction of travel.
      const v = body.linvel();
      const flat = Math.hypot(v.x, v.z);
      body.resetForces(true);
      if (flat > 0.05) {
        const f = resistanceForce(flat) * (tuning.mass / CAR.mass);
        body.addForce({ x: (-v.x / flat) * f, y: 0, z: (-v.z / flat) * f }, true);
      }

      vehicle.updateVehicle(dt);
      if (trailer) {
        for (let i = 0; i < trailer.wheels.numWheels(); i++) trailer.wheels.setWheelBrake(i, Math.max(pedals.brake, pedals.handbrake) * 100);
        trailer.wheels.updateVehicle(dt);
      }
      world.timestep = dt;
      world.step();

      spin += (speed / tuning.wheelRadius) * dt;
    },
    chassis: (): Pose => {
      const t = body.translation();
      const r = body.rotation();
      return { position: [t.x, t.y, t.z], quaternion: [r.x, r.y, r.z, r.w] };
    },
    wheels: () => {
      const r = body.rotation();
      const chassisQ: Quat = [r.x, r.y, r.z, r.w];
      return points.map((_, i) => {
        const hard = vehicle.wheelHardPoint(i);
        const len = vehicle.wheelSuspensionLength(i) ?? tuning.suspensionRest;
        const t = body.translation();
        // wheelHardPoint is in world space. The wheel hangs one suspension length below it,
        // along the car's own down direction, so it follows the body when the body leans.
        const [qx, qy, qz, qw] = chassisQ;
        const down: [number, number, number] = [
          -2 * (qx * qy - qz * qw),
          -(1 - 2 * (qx * qx + qz * qz)),
          -2 * (qy * qz + qx * qw),
        ];
        const position: [number, number, number] = [
          (hard?.x ?? t.x) + down[0] * len,
          (hard?.y ?? t.y) + down[1] * len,
          (hard?.z ?? t.z) + down[2] * len,
        ];
        const steer = i < 2 ? -steerAngle : 0;
        const q = mul(mul(chassisQ, axisAngle(0, 1, 0, steer)), axisAngle(1, 0, 0, spin));
        return { position, quaternion: q };
      });
    },
    speed: () => vehicle.currentVehicleSpeed(),
    setBuildBoxes,
    removeTree(x, z) {
      const key = `${x},${z}`;
      for (const collider of treeColliders.get(key) ?? []) world.removeCollider(collider, true);
      treeColliders.delete(key);
    },
    setFocus: (x: number, z: number) => setFocus(x, z),
    flipUpright: () => {
      // Keep the heading, drop the roll and pitch, and set the car down a little above where it lies.
      const r = body.rotation();
      const fx = 2 * (r.x * r.z + r.w * r.y);
      const fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const yaw = Math.atan2(fx, fz);
      const t = body.translation();
      body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
  };
}

function axisAngle(x: number, y: number, z: number, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

function mul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
