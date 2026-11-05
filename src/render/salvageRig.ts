import * as THREE from 'three';
import { VehicleGeometry, type V3 } from './vehicleGeometry';
import { vehicleFinish } from './vehicleFinish';
import { createYardTire } from './yardTire';

/** Stationary long-nose salvage tractor. Ground at Y=0, nose along +Z. */
export function createSalvageRig(): THREE.Group {
  const root = new THREE.Group(); root.name = 'Salvaged big rig';
  const g = new VehicleGeometry();
  const box = g.box.bind(g), rod = g.rod.bind(g), disc = g.disc.bind(g);
  const {paint,steel,dark,glass,trim,seat} = vehicleFinish(0x996d5d);
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
  box(paint, [2.14, 2.3, 1.5], [0, 2.08, -.55], .18);
  box(dark, [2.08,.08,1.5], [0,1.04,1]);
  box(paint, [2.12,.98,.06], [0,1.57,1.77],.025);
  g.surface(paint,24,12,(u,v)=>[(u*2-1)*1.06,3.13+Math.sin(u*Math.PI)*.1,.2+v*1.52],[0,1,0]);
  const frontOuter: V3[]=[[-1.09,2.08,1.8],[1.09,2.08,1.8],[.99,3.13,1.59],[-.99,3.13,1.59]];
  const frontInner: V3[]=[[-1.01,2.16,1.79],[1.01,2.16,1.79],[.91,3.04,1.61],[-.91,3.04,1.61]];
  g.frame(paint,frontOuter,frontInner,[0,0,1]);g.patch(glass,frontInner,[0,0,1]);
  g.line(dark,[...frontInner,frontInner[0]],.018);
  g.rod(steel,[0,2.15,1.81],[0,3.05,1.63],.018);
  box(paint,[2.18,.055,.26],[0,3.12,1.76],.02,[.09,0,0]);
  box(dark,[1.98,.18,.35],[0,2.04,1.56],.05);
  for(const x of [-.52,.52]) {
    box(seat,[.7,.18,.65],[x,1.45,.8],.065);
    box(seat,[.7,.85,.15],[x,1.88,.48],.065,[.08,0,0]);
    for(let n=-4;n<=4;n++) box(dark,[.009,.65,.01],[x+n*.065,1.88,.57],.002);
    g.rod(dark,[x-.23,2.18,1.83],[x+.22,2.25,1.815],.013);
  }
  for (const side of [-1, 1]) {
    g.surface(paint,18,8,(u,v)=>[side*(1.075+Math.sin(v*Math.PI)*.025),1.08+v, .22+u*1.55],[side,0,0]);
    const outer: V3[]=[[side*1.09,2.08,.22],[side*1.09,2.08,1.8],[side*.99,3.13,1.59],[side*.99,3.13,.22]];
    const inner: V3[]=[[side*1.085,2.17,.34],[side*1.085,2.17,1.68],[side*1,3.03,1.5],[side*1,3.03,.34]];
    g.frame(paint,outer,inner,[side,0,0]);g.patch(glass,inner,[side,0,0]);g.line(dark,[...inner,inner[0]],.013);
    g.line(trim,[[side*1.108,1.96,.29],[side*1.108,1.96,1.72]],.009);
    // Sleeper seams, a small vent window and pressed lower access hatch.
    box(dark,[.02,.42,.55],[side*1.075,2.65,-.53],.045);
    box(glass,[.023,.35,.47],[side*1.09,2.65,-.53],.035);
    box(steel,[.018,.38,.55],[side*1.079,1.37,-.65],.03);
    for(let n=0;n<5;n++) box(dark,[.022,.016,.42],[side*1.092,1.25+n*.055,-.65],.004);
    box(steel, [.04, .055, .24], [side * 1.13, 2.04, .55]);
    // Door seams, steps, fuel tanks and mirror brackets.
    for (const z of [.25, 1.73]) box(dark, [.015, 1.0, .015], [side * 1.105, 1.55, z]);
    for (const y of [.54, .85]) box(steel, [.4, .08, 1.2], [side * 1.12, y, .65]);

    rod(steel, [side * 1.1, 2.85, 1.55], [side * 1.5, 2.85, 1.55], .025);
    box(steel, [.12, .5, .25], [side * 1.5, 2.66, 1.55]);
    rod(steel, [side * 1.13, 1.0, -.9], [side * 1.13, 3.5, -.9], .07);
    disc(dark, .055, .04, [side * 1.13, 3.5, -.9], 'z');
    g.surface(paint,36,6,(u,v)=>{
      const a=.08+u*(Math.PI-.16),r=.66;
      return [side*(.82+v*.53),.56+Math.sin(a)*r,2.75+Math.cos(a)*r];
    },[0,1,0]);
    g.surface(paint,36,3,(u,v)=>{
      const a=.08+u*(Math.PI-.16),r=.6+v*.07;
      return [side*1.35,.56+Math.sin(a)*r,2.75+Math.cos(a)*r];
    },[side,0,0]);
    for(let n=0;n<8;n++) box(dark,[.04,.008,.055],[side*1.12,.895,.16+n*.13],.002);
    for(let n=0;n<7;n++) box(dark,[.018,.12,.025],[side*.83,1.64,2.25+n*.12],.004);
    box(steel,[.4,.22,.13],[side*1.05,1.4,3.5],.05);
    for(const dx of [-.095,.095]) {
      disc(dark,.084,.025,[side*1.05+dx,1.4,3.575]);
      disc(light,.067,.03,[side*1.05+dx,1.4,3.593]);
      g.ring(trim,.076,.009,[side*1.05+dx,1.4,3.605]);
    }
    box(amber, [.25, .09, .12], [side * 1.05, 1.22, 3.5]);
  }
  g.surface(paint,24,24,(u,v)=>{
    const x=(u*2-1)*(.83-.08*v);
    return [x,2.12-.13*v+Math.sin(u*Math.PI)*.07,1.8+v*1.86];
  },[0,1,0]);
  for(const side of [-1,1]) {
    g.surface(paint,24,8,(u,v)=>[side*(.83-.08*u),1.19+v*(.93-.13*u),1.8+u*1.86],[side,0,0]);
    g.line(trim,[[side*.84,1.9,1.84],[side*.765,1.77,3.6]],.008);
    for(const z of [2.08,3.39]) box(steel,[.03,.12,.055],[side*(.83-(z-1.8)/1.86*.08),1.31,z],.008);
  }
  box(steel, [1.38, 1.07, .12], [0, 1.58, 3.72], .05);
  box(dark, [1.22, .91, .025], [0, 1.59, 3.79]);
  for (let i = -8; i <= 8; i++) box(steel, [.035, .86, .035], [i * .066, 1.59, 3.81]);
  box(steel, [2.75, .24, .22], [0, .78, 3.97], .04);

  for (let i = -2; i <= 2; i++) box(amber, [.12, .09, .17], [i * .38, 3.29, 1.55]);
  g.finish(root);
  const component = (id: string, draw: (part: VehicleGeometry) => void) => {
    const group = new THREE.Group(); group.name = id;
    const part = new VehicleGeometry(); draw(part); part.finish(group); root.add(group);
  };
  component('rig_fuel_tank', part => {
    for (const side of [-1,1]) {
      part.disc(steel,.32,1.25,[side*1.03,.7,-.65],'z');
      for(const z of [-1.08,-.22]) part.ring(dark,.325,.028,[side*1.03,.7,z]);
      part.disc(trim,.055,.05,[side*1.03,1.02,-.2],'z');
    }
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
