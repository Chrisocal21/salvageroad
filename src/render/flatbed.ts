import * as THREE from 'three';
import { createYardTire } from './yardTire';
import { containerLength, TRAILER } from '../rules/trailer';
import { SHIPPING, type ShippingKind } from '../data/shippingContainers';
import type { Pose } from '../lab/types';

export function createFlatbed(spawn: { x: number; z: number; yaw: number }, groundY: number) {
  const model = new THREE.Group();
  model.name = 'Salvage flatbed trailer';
  model.position.set(spawn.x, groundY + 1.2, spawn.z);
  model.rotation.y = spawn.yaw;
  const steel = new THREE.MeshStandardMaterial({ color: 0x66544a, roughness: .85 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x81705a, roughness: .95 });
  const box = (size: [number, number, number], position: [number, number, number], material = steel) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; model.add(mesh);
    return mesh;
  };
  box([2.6, .36, 8.2], [0, 0, 0]);
  box([2.5, .04, 8], [0, .2, 0], wood);
  for (const z of TRAILER.axleZ) {
    box([2.2, .15, .15], [0, -.5, z]);
    for (const side of [-1, 1]) {
      const tire = createYardTire(TRAILER.wheelRadius, .3);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(side * 1.13, -.72, z);
      model.add(tire);
    }
  }
  const legs = new THREE.Group();
  for (const x of [-.9, .9]) {
    const leg = box([.14, 1.05, .14], [x, -.6, 1.5]);
    legs.add(leg);
  }
  model.add(legs);
  box([.12, .2, .12], [0, -.2, TRAILER.hitchZ]);
  const loads = new THREE.Group(); model.add(loads);
  function syncCargo(cargo: ShippingKind[], colors: number[]) {
    for (const child of [...loads.children]) {
      if (child instanceof THREE.Mesh) { child.geometry.dispose(); child.material.dispose(); }
      loads.remove(child);
    }
    let rear = -3.5;
    cargo.forEach((kind, i) => {
      const length = containerLength(kind);
      const material = new THREE.MeshStandardMaterial({ color: SHIPPING.colors[colors[i] ?? 0], roughness: .85 });
      const container = new THREE.Mesh(new THREE.BoxGeometry(2.4384, SHIPPING.height, length), material);
      container.position.set(0, TRAILER.deckHeight + SHIPPING.height / 2, rear + length / 2);
      container.castShadow = true; container.receiveShadow = true; loads.add(container);
      rear += length;
    });
  }
  return {
    model, syncCargo,
    setAttached(attached: boolean) { legs.visible = !attached; },
    pose(): Pose { return { position: model.position.toArray(), quaternion: model.quaternion.toArray() }; },
    update(pose: Pose) { model.position.fromArray(pose.position); model.quaternion.fromArray(pose.quaternion); },
    hitch() { return model.localToWorld(new THREE.Vector3(0, 0, TRAILER.hitchZ)); },
    obb() {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion);
      return { x: model.position.x, z: model.position.z, hx: 1.3, hz: 4.1, yaw: Math.atan2(forward.x, forward.z) };
    },
    obstacle(loaded: boolean) {
      const pose = this.pose();
      const offset = new THREE.Vector3(0, loaded ? SHIPPING.height / 2 : 0, 0).applyQuaternion(model.quaternion);
      pose.position = new THREE.Vector3(...pose.position).add(offset).toArray();
      return { pose, half: [1.3, loaded ? SHIPPING.height / 2 + TRAILER.deckHeight : TRAILER.deckHeight, 4.1] as const };
    },
    park(ground: (x: number, z: number) => number) {
      model.rotation.set(0, this.obb().yaw, 0);
      model.position.y = ground(model.position.x, model.position.z) + 1.2;
    },
  };
}
