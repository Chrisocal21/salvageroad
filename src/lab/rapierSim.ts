import RAPIER from '@dimforge/rapier3d-compat';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';

export async function createRapierSim(): Promise<CarSim> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

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
    vehicle.setWheelSuspensionStiffness(i, 30);
    vehicle.setWheelMaxSuspensionTravel(i, 0.3);
    vehicle.setWheelFrictionSlip(i, 1.4);
    vehicle.setWheelMaxSuspensionForce(i, 100000);
  });

  return {
    name: 'rapier',
    step(dt, input: DriveInput) {
      const force = input.throttle * CAR.maxEngineForce;
      vehicle.setWheelEngineForce(2, force);
      vehicle.setWheelEngineForce(3, force);
      // Positive steer means right, which is -X when facing +Z.
      vehicle.setWheelSteering(0, -input.steer * CAR.maxSteer);
      vehicle.setWheelSteering(1, -input.steer * CAR.maxSteer);
      for (let i = 0; i < 4; i++) vehicle.setWheelBrake(i, input.brake * CAR.maxBrake);
      world.timestep = Math.min(dt, 1 / 30);
      vehicle.updateVehicle(world.timestep);
      world.step();
    },
    chassis: (): Pose => {
      const t = body.translation();
      const r = body.rotation();
      return { position: [t.x, t.y, t.z], quaternion: [r.x, r.y, r.z, r.w] };
    },
    wheels: () => {
      const t = body.translation();
      const r = body.rotation();
      return points.map((_, i) => {
        const hard = vehicle.wheelHardPoint(i);
        const len = vehicle.wheelSuspensionLength(i) ?? CAR.suspensionRest;
        // wheelHardPoint is in world space; the wheel hangs one suspension length below it.
        return {
          position: [hard?.x ?? t.x, (hard?.y ?? t.y) - len, hard?.z ?? t.z],
          quaternion: [r.x, r.y, r.z, r.w],
        } as Pose;
      });
    },
    speed: () => vehicle.currentVehicleSpeed(),
  };
}
