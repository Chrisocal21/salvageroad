import type { BuildBox } from '../rules/baseWorld';

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
  /** Replaces the solid blocks of the player's base. Optional: only the Rapier world supports it. */
  setBuildBoxes?(boxes: BuildBox[]): void;
  /** Tells a world with rolling ground where to keep ground under the car. Optional: only the Rapier world supports it. */
  setFocus?(x: number, z: number): void;
  /** Sets a flipped or tilted car back on its wheels, keeping its heading. Optional: only the Rapier world supports it. */
  flipUpright?(): void;
  setVehicleObstacle?(pose: Pose, halfExtents: readonly [number, number, number], id?: number): void;
  removeVehicleObstacle?(id: number): void;
  removeTree?(x: number, z: number): void;
  attachTrailer?(pose: Pose): void;
  detachTrailer?(): void;
  trailerPose?(): Pose | null;
  setTrailerCargo?(lengths: number[]): void;
}

// The longer cargo bed adds rear overhang. Recenter the chassis and axle positions together.
export const EL_CAJON_BED_EXTENSION = 0.4;

// El Cajon chassis forward is +Z.
export const CAR = {
  mass: 1400,
  halfExtents: [0.95, 0.35, 2.4 + EL_CAJON_BED_EXTENSION / 2] as const,
  wheelRadius: 0.38,
  wheelX: 0.9,
  wheelFrontZ: 1.6 + EL_CAJON_BED_EXTENSION / 2,
  wheelRearZ: -1.5 + EL_CAJON_BED_EXTENSION / 2,
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
