import * as THREE from 'three';
import { VehicleGeometry, type V3 } from './vehicleGeometry';
import { createRustedMaterial } from './rust';
import { createYardTire } from './yardTire';
import { BOX_TRUCK, type RigPart } from '../rules/rigBuild';

/** Short-hood, two-axle delivery truck. The damaged cargo shell survives until repaired. */
export function createBoxTruck() {
  const root = new THREE.Group(); root.name = 'Salvaged box truck';
  const paint = createRustedMaterial('paint', 0xffffff, 0xd4d0c3);
  const body = new THREE.MeshStandardMaterial({ color: 0xcac8ba, roughness: .8, metalness: .15 });
  const damaged = createRustedMaterial('paint', 0xffffff, 0xa39b88);
  const alloy = new THREE.MeshStandardMaterial({ color: 0x92968f, roughness: .55, metalness: .65 });
  const steel = createRustedMaterial('chrome', 0x8b8b83);
  const dark = new THREE.MeshStandardMaterial({ color: 0x232723, roughness: .9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x75634b, roughness: .95 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x364b50, roughness: .22, metalness: .2, transparent: true, opacity: .8 });
  const light = new THREE.MeshStandardMaterial({ color: 0xdddcc3, roughness: .3 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xd8902e, roughness: .45 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9e332b, roughness: .45 });
  const fixed = new VehicleGeometry();
  for (const x of [-.65, .65]) fixed.box(dark, [.16, .25, 8.15], [x, .7, -.1]);
  for (const z of [-3.9, -2, 0, 1.15, 3.05]) fixed.box(steel, [1.5, .12, .14], [0, .7, z]);
  for (const x of [-1.25, 1.25]) {
    for (const z of [-4.17, 1.14]) fixed.box(alloy, [.075, 2.75, .075], [x, 2.55, z]);
    for (const y of [1.22, 3.92]) fixed.box(alloy, [.08, .1, 5.4], [x, y, -1.5]);
    for (let n = 0; n < 18; n++) for (const y of [1.22, 3.92])
      fixed.disc(steel, .012, .012, [x + Math.sign(x) * .045, y, -4.05 + n * .3], 'x', 6);
  }
  for (const z of [-4.2, 1.17]) {
    fixed.box(alloy, [2.6, .12, .12], [0, 3.92, z], .04);
    fixed.box(alloy, [2.6, .12, .12], [0, 1.22, z]);
  }
  fixed.box(body, [2.43, 2.62, .08], [0, 2.55, 1.15]);
  fixed.box(paint, [2.1, 1.45, .08], [0, 1.98, 1.32]);
  fixed.box(paint, [2.02, .14, 1.5], [0, 2.92, 1.98], .06);
  for (const side of [-1, 1]) {
    fixed.rod(paint, [side * 1.04, 1.9, 2.9], [side * .95, 2.87, 2.65], .055);
    fixed.rod(paint, [side * 1.04, 1.25, 1.32], [side * .95, 2.87, 1.32], .05);
    fixed.box(steel, [.32, .1, 1.25], [side * 1.12, .8, 2.03]);
    for (let n = 0; n < 5; n++) fixed.box(dark, [.25, .008, .035], [side * 1.12, .855, 1.55 + n * .23]);
    fixed.rod(dark, [side * 1.03, 2.65, 2.48], [side * 1.43, 2.65, 2.4], .023);
    fixed.rod(dark, [side * 1.03, 2.12, 2.48], [side * 1.43, 2.18, 2.4], .023);
    fixed.box(dark, [.12, .58, .24], [side * 1.44, 2.42, 2.4], .04);
    fixed.box(glass, [.014, .49, .19], [side * 1.505, 2.42, 2.4]);
    fixed.surface(paint, 18, 1, (u, v) => {
      const angle = u * Math.PI;
      return [side * (1.05 + v * .22), .49 + Math.sin(angle) * .73, BOX_TRUCK.frontAxle + Math.cos(angle) * .73];
    }, [0, 1, 0]);
    fixed.surface(paint, 18, 1, (u, v) => {
      const angle = u * Math.PI, radius = .6 + v * .15;
      return [side * 1.27, .49 + Math.sin(angle) * radius, BOX_TRUCK.frontAxle + Math.cos(angle) * radius];
    }, [side, 0, 0]);
    fixed.box(dark, [.43, .28, .12], [side * 1.02, 1.43, 3.87], .06);
    fixed.box(dark, [.62, .5, .06], [side * 1.02, .4, -2.72]);
    fixed.box(dark, [.5, .26, .12], [side * .87, .87, -4.17]);
    fixed.box(red, [.28, .13, .025], [side * .95, .88, -4.24]);
    fixed.box(amber, [.11, .13, .025], [side * .72, .88, -4.24]);
    fixed.box(amber, [.1, .08, .04], [side * 1.15, 3.88, 1.24]);
    fixed.box(red, [.1, .08, .04], [side * 1.15, 3.88, -4.27]);
    for (let n = 0; n < 14; n++)
      fixed.box(n % 2 ? red : light, [.014, .055, .24], [side * 1.299, 1.3, -4 + n * .38]);
  }
  let tireIndex = 0;
  for (const z of [BOX_TRUCK.rearAxle, BOX_TRUCK.frontAxle]) {
    fixed.rod(dark, [-1.05, .49, z], [1.05, .49, z], .12);
    for (const side of [-1, 1]) {
      for (const x of z < 0 ? [side * .88, side * 1.17] : [side * BOX_TRUCK.wheelX]) {
        const tire = createYardTire(BOX_TRUCK.wheelRadius, .27);
        tire.name = `Rig tire ${tireIndex++}`; tire.position.set(x, .49, z); tire.rotation.z = Math.PI / 2; root.add(tire);
      }
      const hubX = side * (z < 0 ? 1.315 : 1.19);
      fixed.disc(alloy, .265, .08, [hubX, .49, z], 'x');
      fixed.disc(dark, .11, .1, [hubX, .49, z], 'x');
      for (let n = 0; n < 8; n++) fixed.disc(dark, .025, .09,
        [hubX, .49 + Math.sin(n * Math.PI / 4) * .18, z + Math.cos(n * Math.PI / 4) * .18], 'x', 8);
    }
  }
  fixed.finish(root);

  function component(id: RigPart, count: number, draw: (part: VehicleGeometry, i: number) => void, worn = false) {
    const group = new THREE.Group(); group.name = `${worn ? 'Damaged ' : ''}${id}`; root.add(group);
    for (let i = 0; i < count; i++) {
      const part = new VehicleGeometry(); draw(part, i);
      const piece = new THREE.Group(); piece.name = `${group.name} ${i}`; part.finish(piece); group.add(piece);
    }
    return group;
  }
  component('rig_engine', 1, p => p.box(dark, [1.05, .5, .9], [0, 1.3, 3.2]));
  component('rig_transmission', 1, p => p.box(steel, [.6, .4, 1], [0, .8, 1.55]));
  component('rig_battery', 1, p => p.box(dark, [.35, .3, .35], [.74, 1.2, 2.8]));
  component('rig_fuel_tank', 1, p => p.box(steel, [.55, .4, 1.15], [1, .73, .4], .09));
  component('rig_steering', 1, p => p.ring(dark, .22, .025, [.5, 1.98, 2.58]));
  component('truck_radiator', 1, p => p.box(dark, [1.2, .65, .12], [0, 1.32, 3.84]));
  component('truck_brakes', 4, (p, i) => p.disc(steel, .24, .12,
    [i % 2 ? 1.04 : -1.04, .49, i < 2 ? BOX_TRUCK.frontAxle : BOX_TRUCK.rearAxle], 'x'));
  component('truck_exhaust', 1, p => p.rod(steel, [-.85, .58, 1.6], [-.85, .58, -2.9], .065));
  component('truck_dash', 1, p => {
    p.box(dark, [1.9, .25, .4], [0, 1.92, 2.62], .06);
    p.box(steel, [.45, .06, .16], [.5, 2.08, 2.57]);
  });
  component('truck_seat', 2, (p, i) => {
    p.box(dark, [.7, .18, .64], [i ? -.5 : .5, 1.55, 1.95], .05);
    p.box(dark, [.7, .78, .16], [i ? -.5 : .5, 1.92, 1.65], .05);
  });
  component('truck_windshield', 1, p => {
    const outer: V3[] = [[-.98, 2.05, 2.9], [.98, 2.05, 2.9], [.9, 2.82, 2.68], [-.9, 2.82, 2.68]];
    const inner: V3[] = [[-.93, 2.09, 2.894], [.93, 2.09, 2.894], [.86, 2.77, 2.694], [-.86, 2.77, 2.694]];
    p.frame(dark, outer, inner, [0, 0, 1]); p.patch(glass, inner, [0, 0, 1]);
    for (const x of [-.48, .48]) p.rod(dark, [x - .22, 2.09, 2.92], [x + .21, 2.18, 2.894], .012);
  });
  for (const [id, side] of [['truck_driver_door', 1], ['truck_passenger_door', -1]] as const) {
    component(id, 1, p => {
      p.box(paint, [.1, .85, 1.45], [side * 1.035, 1.58, 2.04], .035);
      const outer: V3[] = [[side * 1.09, 2, 1.35], [side * 1.09, 2, 2.83], [side * .97, 2.82, 2.63], [side * .97, 2.82, 1.35]];
      const inner: V3[] = [[side * 1.085, 2.06, 1.42], [side * 1.085, 2.06, 2.73], [side * .98, 2.75, 2.57], [side * .98, 2.75, 1.42]];
      p.frame(paint, outer, inner, [side, 0, 0]); p.patch(glass, inner, [side, 0, 0]);
      p.box(dark, [.035, .075, .23], [side * 1.095, 1.92, 1.57], .02);
    });
    component(id, 1, p => p.box(damaged, [.07, .55, 1.35], [side * 1.035, 1.44, 2]), true);
  }
  component('truck_hood', 1, p => {
    p.surface(paint, 10, 4, (u, v) => [(u * 2 - 1) * (.8 - v * .1),
      1.96 - v * .3 + Math.sin(u * Math.PI) * .055, 2.85 + v * 1.08], [0, 1, 0]);
    for (const side of [-1, 1]) p.patch(paint,
      [[side * .8, 1.18, 2.85], [side * .7, 1.18, 3.93], [side * .7, 1.66, 3.93], [side * .8, 1.96, 2.85]], [side, 0, 0]);
  });
  component('truck_hood', 1, p => p.box(damaged, [1.45, .12, .65], [0, 1.83, 3.13], .04, [.12, 0, .035]), true);
  component('truck_grille', 1, p => {
    p.box(dark, [1.42, .62, .1], [0, 1.36, 3.96], .07);
    for (const y of [1.12, 1.27, 1.42, 1.57]) p.box(alloy, [1.3, .045, .04], [0, y, 4.02]);
    p.box(alloy, [.035, .52, .03], [0, 1.36, 4.045]);
  });
  component('truck_headlight', 2, (p, i) => {
    const side = i ? -1 : 1;
    p.box(light, [.34, .18, .055], [side * 1.02, 1.47, 3.946], .045);
    p.box(amber, [.34, .055, .055], [side * 1.02, 1.33, 3.946], .015);
  });
  component('truck_front_bumper', 1, p => {
    p.box(steel, [2.52, .3, .24], [0, .81, 4.12], .075);
    p.box(dark, [.5, .15, .02], [0, .81, 4.245]);
  });
  component('truck_rear_bumper', 1, p => {
    p.box(dark, [2.45, .14, .3], [0, .54, -4.18]);
    for (const x of [-.9, .9]) p.box(steel, [.1, .45, .12], [x, .78, -4.12]);
  });
  component('truck_box_floor', 1, p => {
    p.box(steel, [2.48, .12, 5.3], [0, 1.15, -1.5]);
    for (let n = 0; n < 12; n++) p.box(wood, [.19, .035, 5.23], [-1.1 + n * .2, 1.23, -1.5]);
  });
  component('truck_box_floor', 1, p => {
    for (let n = 0; n < 7; n++) p.box(wood, [.16, .035, 4.6 - n % 3 * .4], [-1.05 + n * .31, 1.2, -1.5]);
  }, true);
  component('truck_box_panel', 4, (p, i) => {
    const side = i < 2 ? -1 : 1, z = i % 2 ? -.15 : -2.85;
    p.box(body, [.055, 2.62, 2.7], [side * 1.25, 2.55, z]);
    p.box(wood, [.025, 1.18, 2.64], [side * 1.205, 1.89, z]);
    for (const y of [1.6, 2.35, 3.1]) p.box(alloy, [.035, .055, 2.63], [side * 1.18, y, z]);
    p.box(alloy, [.018, 2.62, .024], [side * 1.285, 2.55, z - 1.31]);
    for (let n = 0; n < 15; n++) p.disc(alloy, .01, .012, [side * 1.302, 1.32 + n * .17, z - 1.31], 'x', 6);
  });
  component('truck_box_panel', 4, (p, i) => {
    const side = i < 2 ? -1 : 1, z = i % 2 ? -.15 : -2.85;
    p.box(damaged, [.045, 1.56, 2.65], [side * 1.25, 3.04, z]);
    p.patch(damaged, [[side * 1.25, 1.27, z - 1.3], [side * 1.25, 1.27, z - .3],
      [side * 1.28, 2.3, z + .2], [side * 1.25, 2.3, z - 1.3]], [side, 0, 0]);
    p.box(steel, [.035, .05, 2.6], [side * 1.29, 2.28, z]);
  }, true);
  component('truck_box_roof', 1, p => {
    p.box(body, [2.55, .075, 5.4], [0, 3.96, -1.5], .03);
    for (let n = 0; n < 8; n++) p.box(alloy, [2.4, .055, .045], [0, 3.89, -4 + n * .7]);
  });
  component('truck_box_roof', 1, p => {
    p.box(damaged, [2.48, .055, 4.7], [0, 3.93, -1.8]);
    p.box(damaged, [1.5, .045, .65], [.4, 3.91, .87], .01, [.04, 0, .04]);
  }, true);
  const doors = component('truck_box_door', 2, (p, i) => {
    const sign = i ? -1 : 1;
    p.box(body, [1.2, 2.59, .065], [sign * .61, 1.31, 0], .015);
    for (const x of [sign * .04, sign * 1.2]) p.box(alloy, [.055, 2.65, .1], [x, 1.31, -.015]);
    for (const y of [.025, 2.6]) p.box(alloy, [1.2, .055, .1], [sign * .61, y, -.015]);
    p.rod(steel, [sign * .85, .15, -.075], [sign * .85, 2.48, -.075], .018);
    p.box(steel, [.28, .045, .04], [sign * .72, .82, -.1]);
    for (const y of [.32, 1.3, 2.3]) p.box(alloy, [.25, .075, .1], [sign * .12, y, -.03]);
    for (let n = 0; n < 4; n++) p.box(n % 2 ? light : red, [.24, .055, .018], [sign * (.18 + n * .26), .14, -.06]);
  });
  doors.children.forEach((door, i) => door.position.set(i ? 1.23 : -1.23, 1.25, -4.22));
  component('truck_box_door', 2, (p, i) => {
    p.box(damaged, [.88, 1.85, .05], [i ? .68 : -.68, 2.45, -4.2], .01, [0, i ? -.06 : .04, i ? .04 : -.03]);
  }, true);
  return root;
}
