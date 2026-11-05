import { createVehicleCrib } from './vehicleFinish';
import * as THREE from 'three';
import { createRapierSim, type WorldSpec } from '../lab/rapierSim';
import type { DriveInput, Pose } from '../lab/types';
import { createSalvageRig } from './salvageRig';
import { createBoxTruck } from './boxTruck';
import { createImportedVehicle, IMPORTED_VEHICLES } from './importedVehicle';
import { createBoxStorage } from '../rules/vehicleStorage';
import { BOX_TRUCK, createRigBuild, rigComplete, partsForRig, rigRequirements, rigLabel, type RigKind } from '../rules/rigBuild';

export const RIG_HALF = [1.55, 1.35, 4.35] as const;
export const RIG_OFFSET = 1.95;
export async function createRigRuntime(spec: WorldSpec, spawn: { x:number; z:number; yaw:number; kind?: RigKind }) {
  const kind = spawn.kind ?? 'tractor';
  const boxTruck = kind === 'box-truck';
  const importedKind = kind === 'salvage-pickup' || kind === 'step-van' ? kind : null;
  const imported = importedKind ? IMPORTED_VEHICLES[importedKind] : null;
  const half: readonly [number, number, number] = imported?.half ?? (boxTruck ? [1.55, 1.95, 4.35] : RIG_HALF);
  const offset = imported?.offset ?? (boxTruck ? BOX_TRUCK.offset : RIG_OFFSET);
  const wheelX = imported?.wheelX ?? (boxTruck ? BOX_TRUCK.wheelX : 1.13);
  const physics = await createRapierSim({ ...spec, carSpawn: spawn, spawnHeight: 2.4,
    vehicle: { mass: imported?.mass ?? (boxTruck ? 5500 : 7000), halfExtents: half, wheelRadius: imported?.radius ?? (boxTruck ? BOX_TRUCK.wheelRadius : .56), wheelX,
      wheelFrontZ: imported?.front ?? (boxTruck ? BOX_TRUCK.frontAxle : 2.75), wheelRearZ: imported?.rear ?? (boxTruck ? BOX_TRUCK.rearAxle : -1.9),
      wheelY: (imported ? imported.radius + .29 : boxTruck ? .78 : .85) - offset, suspensionStiffness: 22,
      maxBrake: imported ? 120 : 220, centerOfMassY: 0 }, rearAxles: imported ? [imported.rear] : boxTruck ? [BOX_TRUCK.rearAxle] : [-1.9,-3.2], engineScale: imported?.engine ?? (boxTruck ? 3.5 : 5), fifthWheel: kind === 'tractor' });
  const model = importedKind ? await createImportedVehicle(importedKind) : boxTruck ? createBoxTruck() : createSalvageRig();
  model.rotation.y = spawn.yaw;
  const build = createRigBuild();
  const storage = imported ? createBoxStorage(imported.slots) : boxTruck ? createBoxStorage() : undefined;
  const complete = () => rigComplete(build, kind);
  model.position.set(spawn.x, spec.ground?.(spawn.x,spawn.z) ?? 0, spawn.z);
  const tireMeshes: THREE.Object3D[] = [];
  model.traverse(o => { if (o.name.startsWith('Rig tire ')) tireMeshes.push(o); });
  const axleForTire = imported ? [0,1,2,3] : boxTruck ? [2,2,3,3,0,1] : [4,4,5,5,2,2,3,3,0,1];
  const offsets = tireMeshes.map(mesh => mesh.position.x - Math.sign(mesh.position.x) * wheelX);
  const tireOrientation = imported ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
  const blocks = new THREE.Group();
  for (const x of [-wheelX,wheelX]) for (const z of imported ? [imported.rear, imported.front] : boxTruck ? [BOX_TRUCK.rearAxle, BOX_TRUCK.frontAxle] : [-3.2,2.75]) {
    const block = createVehicleCrib();
    block.position.set(x,0,z); blocks.add(block);
  }
  model.add(blocks);
  const sync = () => {
    tireMeshes.forEach((mesh,i) => { mesh.visible = i < (imported ? build.tire : build.rig_tire); });
    partsForRig(kind).filter(id => id !== 'rig_tire' && id !== 'tire').forEach(id => {
      const part = model.getObjectByName(id)!;
      part.visible = build[id] > 0;
      if ((boxTruck || imported) && (rigRequirements(kind)[id] ?? 0) > 1)
        part.children.forEach((child, i) => { child.visible = i < build[id]; });
      const damaged = model.getObjectByName(`Damaged ${id}`);
      damaged?.children.forEach((child, i) => { child.visible = i >= build[id]; });
    });
    blocks.visible = !complete();
  };
  sync();
  return {
    model, build, physics, sync, kind, half, storage, complete, name: rigLabel(kind),
    cameraHeight: imported ? importedKind === 'salvage-pickup' ? 1.3 : 1.8 : 2,
    cameraDistance: imported ? importedKind === 'salvage-pickup' ? 9 : 11 : 14,
    setCargoOpen(open: boolean) {
      model.getObjectByName('truck_box_door')?.children.forEach((door, i) => {
        door.rotation.y = open ? (i ? -1 : 1) * Math.PI * .75 : 0;
      });
    },
    obb() {
      const forward = new THREE.Vector3(0,0,1).applyQuaternion(model.quaternion);
      return { x:model.position.x, z:model.position.z, hx:half[0], hz:half[2], yaw:Math.atan2(forward.x,forward.z) };
    },
    pose(): Pose {
      const p = new THREE.Vector3(0,offset,0).applyQuaternion(model.quaternion).add(model.position);
      return {position:p.toArray(),quaternion:model.quaternion.toArray()};
    },
    step(dt: number, input: DriveInput) {
      if (!complete()) return;
      physics.step(dt,input);
      const pose = physics.chassis();
      model.quaternion.fromArray(pose.quaternion);
      model.position.fromArray(pose.position).sub(new THREE.Vector3(0,offset,0).applyQuaternion(model.quaternion));
      physics.setFocus?.(model.position.x,model.position.z);
      model.updateMatrixWorld(true);
      const wheels = physics.wheels();
      const inverse = model.quaternion.clone().invert();
      tireMeshes.forEach((mesh,i) => {
        const wheel = wheels[axleForTire[i]];
        const world = new THREE.Vector3(...wheel.position).add(new THREE.Vector3(offsets[i],0,0).applyQuaternion(model.quaternion));
        mesh.position.copy(model.worldToLocal(world));
        mesh.quaternion.copy(inverse).multiply(new THREE.Quaternion(...wheel.quaternion)).multiply(tireOrientation);
      });
    },
  };
}
