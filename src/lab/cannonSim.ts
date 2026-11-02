import * as CANNON from 'cannon-es';
import { CAR, RAMP, type CarSim, type DriveInput, type Pose } from './types';

export interface CannonTuning {
  suspensionStiffness?: number;
  maxSuspensionTravel?: number;
  frictionSlip?: number;
}

export function createCannonSim(tuning: CannonTuning = {}): CarSim {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.defaultContactMaterial.friction = 0.4;

  // A big box, not a Plane: wheel rays against an infinite Plane made the car stall.
  const ground = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(500, 0.5, 500)),
    position: new CANNON.Vec3(0, -0.5, 0),
  });
  world.addBody(ground);

  const ramp = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(...RAMP.halfExtents)),
    position: new CANNON.Vec3(...RAMP.center),
  });
  ramp.quaternion.setFromEuler(RAMP.pitch, 0, 0);
  world.addBody(ramp);

  const body = new CANNON.Body({
    mass: CAR.mass,
    shape: new CANNON.Box(new CANNON.Vec3(...CAR.halfExtents)),
    position: new CANNON.Vec3(...CAR.spawn),
  });
  body.angularDamping = 0.4;

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody: body,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });

  // Order: front-left, front-right, rear-left, rear-right.
  const points: [number, number][] = [
    [-CAR.wheelX, CAR.wheelFrontZ],
    [CAR.wheelX, CAR.wheelFrontZ],
    [-CAR.wheelX, CAR.wheelRearZ],
    [CAR.wheelX, CAR.wheelRearZ],
  ];
  for (const [x, z] of points) {
    vehicle.addWheel({
      radius: CAR.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      suspensionStiffness: tuning.suspensionStiffness ?? 30,
      suspensionRestLength: CAR.suspensionRest,
      maxSuspensionTravel: tuning.maxSuspensionTravel ?? 0.3,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      frictionSlip: tuning.frictionSlip ?? 1.4,
      rollInfluence: 0.01,
      maxSuspensionForce: 100000,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
      chassisConnectionPointLocal: new CANNON.Vec3(x, CAR.wheelY, z),
    });
  }
  vehicle.addToWorld(world);

  return {
    name: 'cannon-es',
    step(dt, input: DriveInput) {
      // cannon-es drives toward +Z with a negative engine force.
      const force = -input.throttle * CAR.maxEngineForce;
      vehicle.applyEngineForce(force, 2);
      vehicle.applyEngineForce(force, 3);
      const steer = -input.steer * CAR.maxSteer;
      vehicle.setSteeringValue(steer, 0);
      vehicle.setSteeringValue(steer, 1);
      for (let i = 0; i < 4; i++) vehicle.setBrake(input.brake * CAR.maxBrake, i);
      world.step(1 / 60, dt, 3);
    },
    chassis: (): Pose => toPose(body.position, body.quaternion),
    wheels: () =>
      vehicle.wheelInfos.map((w) => toPose(w.worldTransform.position, w.worldTransform.quaternion)),
    speed() {
      const forward = body.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
      return body.velocity.dot(forward);
    },
  };
}

function toPose(p: CANNON.Vec3, q: CANNON.Quaternion): Pose {
  return { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] };
}
