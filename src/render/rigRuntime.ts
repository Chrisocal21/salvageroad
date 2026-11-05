import * as THREE from 'three';
import { createRapierSim, type WorldSpec } from '../lab/rapierSim';
import type { DriveInput, Pose } from '../lab/types';
import { createSalvageRig } from './salvageRig';
import { createBoxTruck } from './boxTruck';
import { createBoxStorage } from '../rules/vehicleStorage';
import { BOX_TRUCK, createRigBuild, rigComplete, partsForRig, rigRequirements, rigLabel, type RigKind } from '../rules/rigBuild';

export const RIG_HALF = [1.55, 1.35, 4.35] as const;
export const RIG_OFFSET = 1.95;
export async function createRigRuntime(spec: WorldSpec, spawn: { x:number; z:number; yaw:number; kind?: RigKind }) {
  const kind = spawn.kind ?? 'tractor';
  const boxTruck = kind === 'box-truck';
  const half: readonly [number, number, number] = boxTruck ? [1.55, 1.95, 4.35] : RIG_HALF;
  const offset = boxTruck ? BOX_TRUCK.offset : RIG_OFFSET;
  const wheelX = boxTruck ? BOX_TRUCK.wheelX : 1.13;
  const physics = await createRapierSim({ ...spec, carSpawn: spawn, spawnHeight: 2.4,
    vehicle: { mass: boxTruck ? 5500 : 7000, halfExtents: half, wheelRadius: boxTruck ? BOX_TRUCK.wheelRadius : .56, wheelX,
      wheelFrontZ: boxTruck ? BOX_TRUCK.frontAxle : 2.75, wheelRearZ: boxTruck ? BOX_TRUCK.rearAxle : -1.9,
      wheelY: (boxTruck ? .78 : .85) - offset, suspensionStiffness: 22,
      maxBrake: 220, centerOfMassY: 0 }, rearAxles: boxTruck ? [BOX_TRUCK.rearAxle] : [-1.9,-3.2], engineScale: boxTruck ? 3.5 : 5, fifthWheel: kind === 'tractor' });
  const model = kind === 'box-truck' ? createBoxTruck() : createSalvageRig();
  model.rotation.y = spawn.yaw;
  const build = createRigBuild();
  const storage = kind === 'box-truck' ? createBoxStorage() : undefined;
  const complete = () => rigComplete(build, kind);
  model.position.set(spawn.x, spec.ground?.(spawn.x,spawn.z) ?? 0, spawn.z);
  const tireMeshes: THREE.Mesh[] = [];
  model.traverse(o => { if (o.name.startsWith('Rig tire ')) tireMeshes.push(o as THREE.Mesh); });
  const axleForTire = boxTruck ? [2,2,3,3,0,1] : [4,4,5,5,2,2,3,3,0,1];
  const offsets = tireMeshes.map(mesh => mesh.position.x - Math.sign(mesh.position.x) * wheelX);
  const tireOrientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
  const blocks = new THREE.Group();
  for (const x of [-1.1,1.1]) for (const z of boxTruck ? [BOX_TRUCK.rearAxle, BOX_TRUCK.frontAxle] : [-3.2,2.75]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(.45,.66,.6), new THREE.MeshStandardMaterial({color:0x77756c}));
    block.position.set(x,.33,z); blocks.add(block);
  }
  model.add(blocks);
  const sync = () => {
    tireMeshes.forEach((mesh,i) => { mesh.visible = i < build.rig_tire; });
    partsForRig(kind).filter(id => id !== 'rig_tire').forEach(id => {
      const part = model.getObjectByName(id)!;
      part.visible = build[id] > 0;
      if (kind === 'box-truck' && (rigRequirements(kind)[id] ?? 0) > 1)
        part.children.forEach((child, i) => { child.visible = i < build[id]; });
      const damaged = model.getObjectByName(`Damaged ${id}`);
      damaged?.children.forEach((child, i) => { child.visible = i >= build[id]; });
    });
    blocks.visible = !complete();
  };
  sync();
  return {
    model, build, physics, sync, kind, half, storage, complete, name: rigLabel(kind),
    setCargoOpen(open: boolean) {
      model.getObjectByName('truck_box_door')?.children.forEach((door, i) => {
        door.rotation.y = open ? (i ? -1 : 1) * Math.PI * .75 : 0;
      });
    },
    obb() {
      const forward = new THREE.Vector3(0,0,1).applyQuaternion(model.quaternion);
      return { x:model.position.x, z:model.position.z, hx:1.55, hz:4.35, yaw:Math.atan2(forward.x,forward.z) };
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
