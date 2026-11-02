import RAPIER from '@dimforge/rapier3d-compat';
import { resistanceForce, resolvePedals, updateSteer } from '../rules/driving';
import { PROP_COLLIDER, type Prop } from '../rules/scatter';
import { columnMajor, terrainHeight, type TerrainGrid } from '../rules/terrain';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';

type Quat = [number, number, number, number]; // x, y, z, w

/** What the world is made of. With nothing given it is the flat lab ground. */
export interface WorldSpec {
  terrain?: TerrainGrid;
  props?: Prop[];
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

  if (spec.terrain) {
    world.createCollider(heightfieldDesc(spec.terrain));
  } else {
    world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
  }

  // Static boxes for the props. Trees collide as their trunk only.
  const seed = spec.terrain?.spec.seed ?? 0;
  for (const prop of spec.props ?? []) {
    const c = PROP_COLLIDER[prop.kind];
    const hx = c.hx * prop.scale;
    const hy = c.hy * prop.scale;
    const hz = c.hz * prop.scale;
    const half = prop.yaw / 2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(prop.x, terrainHeight(seed, prop.x, prop.z) + hy, prop.z)
        .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }),
    );
  }

  const half = RAMP.pitch / 2;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(...RAMP.halfExtents)
      .setTranslation(...RAMP.center)
      .setRotation({ x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) }),
  );

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...CAR.spawn)
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
