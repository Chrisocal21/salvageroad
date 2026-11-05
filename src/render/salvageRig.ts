import * as THREE from 'three';
import { VehicleGeometry } from './vehicleGeometry';
import { createRustedMaterial } from './rust';
import { createYardTire } from './yardTire';

/** Stationary long-nose salvage tractor. Ground at Y=0, nose along +Z. */
export function createSalvageRig(): THREE.Group {
  const root = new THREE.Group(); root.name = 'Salvaged big rig';
  const g = new VehicleGeometry();
  const box = g.box.bind(g), rod = g.rod.bind(g), disc = g.disc.bind(g);
  const paint = createRustedMaterial('paint', 0xffffff, 0x805141);
  const steel = createRustedMaterial('chrome', 0x929793);
  const dark = new THREE.MeshStandardMaterial({ color: 0x222627, roughness: .85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x344a50, roughness: .3, metalness: .25 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xc78a37, roughness: .45 });
  const light = new THREE.MeshStandardMaterial({ color: 0xd3cbb3, roughness: .35 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8a3025, roughness: .5 });
  let tireIndex = 0;
  // Exposed ladder chassis and tandem axles, without a trailer.
  for (const x of [-.65, .65]) box(dark, [.16, .28, 8.2], [x, .8, -.1]);
  for (const z of [-3.7, -2.8, -1.5, 0, 2.7]) box(steel, [1.4, .12, .14], [0, .82, z]);
  for (const z of [-3.2, -1.9, 2.75]) {
    rod(dark, [-1.12, .56, z], [1.12, .56, z], .13);
    for (const side of [-1, 1]) {
      const positions = z < 0 ? [side * .92, side * 1.24] : [side * 1.13];
      for (const x of positions) {
        const tire = createYardTire(.56, .29);
        tire.name = `Rig tire ${tireIndex++}`;
        tire.rotation.z = Math.PI / 2; tire.position.set(x, .56, z); root.add(tire);
      }
      disc(steel, .32, .12, [side * (z < 0 ? 1.42 : 1.3), .56, z], 'x');
      disc(dark, .15, .13, [side * (z < 0 ? 1.49 : 1.37), .56, z], 'x');
      for (let n = 0; n < 8; n++) disc(dark, .035, .015, [side * (z < 0 ? 1.49 : 1.37), .56 + Math.sin(n * Math.PI / 4) * .23, z + Math.cos(n * Math.PI / 4) * .23], 'x', 8);
    }
  }
  // Fifth wheel coupling plate and rear mudflaps.
  box(steel, [1.3, .13, 1.35], [0, 1.12, -2.45], .15);
  box(dark, [.15, .015, .8], [0, 1.195, -2.8]);
  for (const side of [-1, 1]) {
    box(dark, [.66, .65, .055], [side * 1.1, .42, -3.85]);
    box(red, [.24, .13, .06], [side * .6, .87, -4.23]);
  }
  // Sleeper and cab lower body; separate window panes leave a clear truck silhouette.
  box(paint, [2.18, 2.3, 1.5], [0, 2.08, -.55], .1);
  box(paint, [2.2, 1.05, 1.55], [0, 1.55, 1.0], .08);
  box(paint, [2.26, .14, 1.65], [0, 3.18, 1.0], .045);
  box(dark, [2.07, .95, .07], [0, 2.64, 1.79]);
  for (const side of [-1, 1]) {
    box(glass, [.94, .78, .025], [side * .51, 2.67, 1.84]);
    box(paint, [.09, 1.05, .12], [side * 1.06, 2.65, 1.75]);
    box(glass, [.025, .8, 1.2], [side * 1.115, 2.66, 1.0]);
    box(paint, [.09, 1.05, .12], [side * 1.06, 2.65, .25]);
    box(steel, [.04, .055, .24], [side * 1.13, 2.04, .55]);
    // Door seams, steps, fuel tanks and mirror brackets.
    for (const z of [.25, 1.73]) box(dark, [.015, 1.0, .015], [side * 1.105, 1.55, z]);
    for (const y of [.54, .85]) box(steel, [.4, .08, 1.2], [side * 1.12, y, .65]);

    rod(steel, [side * 1.1, 2.85, 1.55], [side * 1.5, 2.85, 1.55], .025);
    box(steel, [.12, .5, .25], [side * 1.5, 2.66, 1.55]);
    rod(steel, [side * 1.13, 1.0, -.9], [side * 1.13, 3.5, -.9], .07);
    disc(dark, .055, .04, [side * 1.13, 3.5, -.9], 'z');
    box(paint, [.53, .13, 1.6], [side * 1.05, 1.2, 2.8], .06);
    box(light, [.35, .22, .12], [side * 1.05, 1.4, 3.5]);
    box(amber, [.25, .09, .12], [side * 1.05, 1.22, 3.5]);
  }
  box(paint, [1.6, .95, 1.85], [0, 1.64, 2.75], .12);
  box(steel, [1.38, 1.07, .12], [0, 1.58, 3.72], .05);
  box(dark, [1.22, .91, .025], [0, 1.59, 3.79]);
  for (let i = -8; i <= 8; i++) box(steel, [.035, .86, .035], [i * .066, 1.59, 3.81]);
  box(steel, [2.75, .24, .22], [0, .78, 3.97], .04);
  box(paint, [.1, .98, .1], [0, 2.65, 1.85]);
  for (let i = -2; i <= 2; i++) box(amber, [.12, .09, .17], [i * .38, 3.29, 1.55]);
  g.finish(root);
  const component = (id: string, draw: (part: VehicleGeometry) => void) => {
    const group = new THREE.Group(); group.name = id;
    const part = new VehicleGeometry(); draw(part); part.finish(group); root.add(group);
  };
  component('rig_fuel_tank', part => {
    for (const side of [-1,1]) part.disc(steel, .32, 1.25, [side * 1.03, .7, -.65], 'z');
  });
  component('rig_engine', part => {
    part.box(dark, [1.1,.55,1.3], [0,1.12,2.6]);
    for (const x of [-.4,.4]) part.box(steel, [.2,.18,1.15], [x,1.44,2.6]);
  });
  component('rig_transmission', part => part.box(steel, [.6,.45,1.0], [0,.88,.5]));
  component('rig_battery', part => part.box(dark, [.4,.3,.35], [1.08,1.12,-.1]));
  component('rig_steering', part => {
    part.ring(dark,.23,.025,[.52,2.12,1.38]);
    part.box(dark,[.48,.015,.025],[.52,2.12,1.38]);
  });
  return root;
}
