// Shared by both physics engines so the same scene and the same driving script can run on each.
export interface DriveInput {
  throttle: number; // -1 (reverse) to 1 (forward)
  steer: number; // -1 (left) to 1 (right)
  brake: number; // 0 to 1
}

export interface Pose {
  position: [number, number, number];
  quaternion: [number, number, number, number]; // x, y, z, w
}

export interface CarSim {
  readonly name: string;
  step(dt: number, input: DriveInput): void;
  chassis(): Pose;
  wheels(): Pose[];
  /** Forward speed in m/s (positive means moving along +Z of the chassis). */
  speed(): number;
}

// One placeholder El Cajon: long, low, 4 wheels. Chassis forward is +Z.
export const CAR = {
  mass: 1400,
  halfExtents: [0.95, 0.35, 2.4] as const,
  wheelRadius: 0.38,
  wheelX: 0.9,
  wheelFrontZ: 1.6,
  wheelRearZ: -1.5,
  wheelY: -0.1, // suspension attach point relative to chassis center
  suspensionRest: 0.35,
  centerOfMassY: 0.35, // height of the centre of mass above the chassis centre; higher means more lean
  suspensionStiffness: 14,
  suspensionTravel: 0.45, // how far a wheel can compress, in metres
  suspensionCompression: 2.5, // damping while the spring is squashed (Rapier default 0.83 bounced for 2 s)
  suspensionRelaxation: 3.5, // damping while it springs back (Rapier default 0.88)
  spawn: [0, 1.6, -20] as const,
  maxEngineForce: 4500,
  maxBrake: 50,
  maxSteer: 0.5,
};

// Scene: a big flat ground and one ramp 20 m ahead of the spawn point.
export const RAMP = {
  center: [0, 0.6, 0] as const,
  halfExtents: [3, 0.15, 6] as const,
  pitch: -0.2, // radians about X; low end toward -Z (the car approaches from -Z)
};
