import RAPIER from '@dimforge/rapier3d-compat';
import type { BuildBox } from '../rules/baseWorld';
import { resistanceForce, resolvePedals, updateSteer } from '../rules/driving';
import { PROP_COLLIDER, type Prop } from '../rules/scatter';
import { columnMajor, terrainHeight, type TerrainGrid } from '../rules/terrain';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';

type Quat = [number, number, number, number]; // x, y, z, w

/** What the world is made of. With nothing given it is the flat lab ground. */
export interface WorldSpec {
  terrain?: TerrainGrid;
  /**
   * Ground height anywhere, for a big world. The ground is then built as small collider tiles that follow the car
   * (see setFocus), instead of one heightfield for the whole map. Replaces terrain, and the lab's ramp is left out.
   */
  ground?: (x: number, z: number) => number;
  props?: Prop[];
  /** Solid boxes standing on the ground, such as buildings and containers. height is full height. */
  boxes?: { x: number; z: number; hx: number; hz: number; height: number }[];
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
  await RAPIER.init();
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
  for (const prop of spec.props ?? []) {
    const c = PROP_COLLIDER[prop.kind];
    const hx = c.hx * prop.scale;
    const hy = c.hy * prop.scale;
    const hz = c.hz * prop.scale;
    const half = prop.yaw / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(prop.x, groundAt(prop.x, prop.z) + hy, prop.z)
        .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }),
    );
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
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(b.hx, b.height / 2, b.hz).setTranslation(
        b.x,
        groundAt(b.x, b.z) + b.height / 2,
        b.z,
      ),
    );
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
    ? { x: spec.carSpawn.x, y: groundAt(spec.carSpawn.x, spec.carSpawn.z) + 1, z: spec.carSpawn.z, yaw: spec.carSpawn.yaw }
    : { x: CAR.spawn[0], y: CAR.spawn[1], z: CAR.spawn[2], yaw: 0 };
  setFocus(spawn.x, spawn.z, Infinity); // ground under the car before the first step
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setRotation({ x: 0, y: Math.sin(spawn.yaw / 2), z: 0, w: Math.cos(spawn.yaw / 2) })
      .setAngularDamping(0.4)
      .setCanSleep(false),
  );
  // A solid box with the same mass, but with the centre of mass moved up so the body can lean.
  const [hx, hy, hz] = CAR.halfExtents;
  const m = CAR.mass / 3;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setMassProperties(
      CAR.mass,
      { x: 0, y: CAR.centerOfMassY, z: 0 },
      { x: m * (hy * hy + hz * hz), y: m * (hx * hx + hz * hz), z: m * (hx * hx + hy * hy) },
      { x: 0, y: 0, z: 0, w: 1 },
    ),
    body,
  );

  const vehicle = world.createVehicleController(body);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;

  // Order: front-left, front-right, rear-left, rear-right.
  const points: [number, number][] = [
    [-CAR.wheelX, CAR.wheelFrontZ],
    [CAR.wheelX, CAR.wheelFrontZ],
    [-CAR.wheelX, CAR.wheelRearZ],
    [CAR.wheelX, CAR.wheelRearZ],
  ];
  points.forEach(([x, z], i) => {
    vehicle.addWheel(
      { x, y: CAR.wheelY, z },
      { x: 0, y: -1, z: 0 },
      { x: -1, y: 0, z: 0 },
      CAR.suspensionRest,
      CAR.wheelRadius,
    );
    vehicle.setWheelSuspensionStiffness(i, CAR.suspensionStiffness);
    vehicle.setWheelSuspensionCompression(i, CAR.suspensionCompression);
    vehicle.setWheelSuspensionRelaxation(i, CAR.suspensionRelaxation);
    vehicle.setWheelMaxSuspensionTravel(i, CAR.suspensionTravel);
    vehicle.setWheelFrictionSlip(i, 1.4);
    vehicle.setWheelMaxSuspensionForce(i, 100000);
  });

  let steerAngle = 0; // current wheel angle in radians, positive is right
  let spin = 0; // wheel roll angle in radians, for looks only

  return {
    name: 'rapier',
    step(dt, input: DriveInput) {
      const speed = vehicle.currentVehicleSpeed();
      const pedals = resolvePedals(input.throttle, input.brake, speed);

      // Rear-wheel drive: split the engine force over the two rear wheels.
      vehicle.setWheelEngineForce(2, pedals.engine / 2);
      vehicle.setWheelEngineForce(3, pedals.engine / 2);

      // Positive steer means right, which is -X when facing +Z.
      steerAngle = updateSteer(steerAngle, input.steer, Math.abs(speed), dt);
      vehicle.setWheelSteering(0, -steerAngle);
      vehicle.setWheelSteering(1, -steerAngle);

      // Service brake works on all four wheels, handbrake on the rear pair only.
      const front = pedals.brake * CAR.maxBrake;
      const rear = Math.max(pedals.brake, pedals.handbrake) * CAR.maxBrake;
      vehicle.setWheelBrake(0, front);
      vehicle.setWheelBrake(1, front);
      vehicle.setWheelBrake(2, rear);
      vehicle.setWheelBrake(3, rear);

      // Air drag and rolling resistance, pushing against the direction of travel.
      const v = body.linvel();
      const flat = Math.hypot(v.x, v.z);
      body.resetForces(true);
      if (flat > 0.05) {
        const f = resistanceForce(flat);
        body.addForce({ x: (-v.x / flat) * f, y: 0, z: (-v.z / flat) * f }, true);
      }

      vehicle.updateVehicle(dt);
      world.timestep = dt;
      world.step();

      spin += (speed / CAR.wheelRadius) * dt;
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
        const len = vehicle.wheelSuspensionLength(i) ?? CAR.suspensionRest;
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
