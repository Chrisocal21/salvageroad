import RAPIER from '@dimforge/rapier3d-compat';
import { resistanceForce, resolvePedals, updateSteer } from '../rules/driving';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';

type Quat = [number, number, number, number]; // x, y, z, w

export async function createRapierSim(): Promise<CarSim> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;

  world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));

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
  world.createCollider(RAPIER.ColliderDesc.cuboid(...CAR.halfExtents).setMass(CAR.mass), body);

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
    vehicle.setWheelMaxSuspensionTravel(i, 0.3);
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
        // wheelHardPoint is in world space; the wheel hangs one suspension length below it.
        const position: [number, number, number] = [hard?.x ?? t.x, (hard?.y ?? t.y) - len, hard?.z ?? t.z];
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
