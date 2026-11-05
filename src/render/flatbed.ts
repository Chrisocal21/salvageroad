import { VehicleGeometry } from './vehicleGeometry';
import { vehicleFinish } from './vehicleFinish';
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
  const {steel,dark,trim} = vehicleFinish(0x796f59);
  const g = new VehicleGeometry();
  const red = new THREE.MeshStandardMaterial({color:0x9b2923,roughness:.35});
  const amber = new THREE.MeshStandardMaterial({color:0xc18b36,roughness:.4});
  const white = new THREE.MeshStandardMaterial({color:0xd7d5b9,roughness:.6});
  // Twin I-beams and open crossmembers replace the solid slab.
  for(const x of [-.73,.73]) {
    g.box(steel,[.06,.3,8.1],[x,-.015,0],.006);
    for(const y of [-.17,.14]) g.box(steel,[.22,.04,8.1],[x,y,0],.006);
  }
  for(let i=0;i<14;i++) g.box(steel,[2.5,.12,.065],[0,-.02,-3.9+i*.6],.006);
  for(const side of [-1,1]) {
    g.box(steel,[.07,.26,8.2],[side*1.265,.02,0],.012);
    for(let i=0;i<17;i++) {
      const z=-3.9+i*.48;
      g.box(i%2?white:red,[.012,.055,.28],[side*1.307,.07,z],.003);
      g.disc(trim,.014,.018,[side*1.31,-.055,z],'x',8);
      if(i%2===0) {
        g.box(dark,[.095,.14,.13],[side*1.245,.055,z],.008);
        g.box(steel,[.12,.035,.16],[side*1.245,.14,z],.006);
      }
    }
    for(const z of [-3.8,0,3.8]) g.box(amber,[.028,.065,.12],[side*1.31,-.07,z],.014);
  }
  // Individually worn boards with staggered joints and recessed fasteners.
  for(let lane=0;lane<12;lane++) {
    const wood=new THREE.MeshStandardMaterial({color:new THREE.Color(0x83735a).multiplyScalar(.82+(lane%4)*.09),roughness:.96});
    const x=-1.15+lane*.208;
    for(let segment=0;segment<4;segment++) {
      const z=-3.02+segment*2;
      g.box(wood,[.2,.055,1.986],[x,.17,z],.006);
      for(const end of [-.9,.9]) g.add(new THREE.CylinderGeometry(.009,.009,.004,6),dark,[x,.2,z+end]);
    }
    for(let line=0;line<2;line++) g.box(dark,[.0015,.001,7.96],[x-.06+line*.08,.199,-.02],0);
  }
  for(const z of TRAILER.axleZ) {
    g.rod(dark,[-1.13,-.72,z],[1.13,-.72,z],.085);
    for(const side of [-1,1]) {
      const tire=createYardTire(TRAILER.wheelRadius,.3);
      tire.rotation.z=Math.PI/2;tire.position.set(side*1.13,-.72,z);model.add(tire);
      g.disc(steel,.27,.09,[side*1.3,-.72,z],'x');
      g.disc(dark,.11,.12,[side*1.33,-.72,z],'x');
      for(let n=0;n<8;n++) g.disc(dark,.027,.012,[side*1.351,-.72+Math.sin(n*Math.PI/4)*.19,z+Math.cos(n*Math.PI/4)*.19],'x',8);
      for(let n=0;n<4;n++) g.box(steel,[.09,.018,1.05-n*.14],[side*.78,-.55+n*.024,z],.003);
      g.rod(trim,[side*.8,-.24,z-.3],[side*.8,-.65,z+.15],.035);
    }
  }
  for(const side of [-1,1]) {
    g.box(dark,[.43,.5,.04],[side*1.08,-.78,-3.96],.008);
    g.box(steel,[.1,.48,.12],[side*.9,-.48,-4.02],.008);
    g.disc(red,.065,.035,[side*1.07,-.06,-4.115]);
    g.disc(amber,.065,.035,[side*.87,-.06,-4.115]);
  }
  g.box(steel,[2.3,.11,.12],[0,-.74,-4.02],.01);
  g.box(dark,[.42,.18,.025],[0,-.04,-4.12],.006);
  g.finish(model);
  const legs = new THREE.Group(); legs.name='Retractable landing gear';
  const support=new VehicleGeometry();
  for(const x of [-.9,.9]) {
    support.box(steel,[.15,.64,.15],[x,-.44,1.5],.012);
    support.box(trim,[.1,.48,.1],[x,-.91,1.5],.008);
    support.box(steel,[.38,.055,.32],[x,-1.17,1.5],.016);
    support.rod(steel,[x,-.24,1.5],[x,-.12,.72],.035);
  }
  support.rod(steel,[-.9,-.42,1.5],[.9,-.42,1.5],.025);
  support.rod(trim,[.92,-.42,1.5],[1.16,-.42,1.5],.025);
  support.rod(trim,[1.16,-.42,1.5],[1.16,-.57,1.5],.025);
  support.finish(legs);model.add(legs);
  const pin = new VehicleGeometry();pin.add(new THREE.CylinderGeometry(.065,.065,.2,12),steel,[0,-.2,TRAILER.hitchZ]);pin.finish(model);
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
