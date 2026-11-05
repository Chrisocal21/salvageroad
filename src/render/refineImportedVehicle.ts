import * as THREE from 'three';
import { VehicleGeometry, type V3 } from './vehicleGeometry';
import { vehicleFinish } from './vehicleFinish';
import { createYardTire } from './yardTire';

/** Refine the supplied GLB's bodywork without changing repair groups or wheel pivots. */
export function refineImportedVehicle(model: THREE.Group, van: boolean) {
  const m = vehicleFinish(van ? 0xb5b9ac : 0x8b9b98);
  const replaced = /^(nose_front|cab_lower|cab_upper|cab_roof|cab_side_window|side_window_split|side_window_divider|front_sloped_upper|front_fenders|rusty_fender|wheel_arch_rear_fender|orange_repaint_cab_patch|orange_door_patch|windshield_divider|windshield_center_divider)$/;
  const remove: THREE.Mesh[] = [];
  const uncolored = new Map<string, THREE.MeshStandardMaterial>();
  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
    const name = o.name.replace(/^\d+_/, '');
    if (replaced.test(name) || /(?:front|rear)_(?:tire|sidewall)$/.test(name)) { remove.push(o); return; }
    if (/glass|window/.test(name)) o.material=m.glass;
    else if (/black|chassis|axle|frame|engine|seam/.test(name)) o.material=m.dark;
    else if (/rim|hub|lug|bumper|mirror|grille_bar|handle|rail|plate|beltline/.test(name)) o.material=m.steel;
    else if (/cab|cargo|hood|fender|nose|bed_remnant/.test(name)) o.material=m.paint;
    // GLB colors live on vertices. Preserve their tint when batching strips color attributes.
    const material = o.material;
    if(material instanceof THREE.MeshStandardMaterial && material.vertexColors) {
      const colors=o.geometry.getAttribute('color');
      const tint=new THREE.Color(1,1,1);
      if(colors) {
        tint.setRGB(0,0,0);
        for(let i=0;i<colors.count;i++) {tint.r+=colors.getX(i);tint.g+=colors.getY(i);tint.b+=colors.getZ(i);}
        tint.multiplyScalar(1/colors.count);
      }
      const key=material.uuid+':'+tint.getHexString();
      let replacement=uncolored.get(key);
      if(!replacement) {replacement=material.clone();replacement.vertexColors=false;replacement.color.multiply(tint);uncolored.set(key,replacement);}
      o.material=replacement;
    }
  });
  remove.forEach(mesh => {mesh.removeFromParent();mesh.geometry.dispose();});
  const g = new VehicleGeometry();
  const back = van ? 1.0 : -.23, front = van ? 3.12 : 1.7;
  const belt = van ? 1.9 : 1.83, roof = van ? 3.0 : 2.76, half = van ? 1.02 : .93;
  const topFront = front - .22, topHalf = half - .09;
  const axle = van ? 2.34 : 1.92, radius = van ? .52 : .55;
  const lower = (z: number) => {
    const d = z-axle, r=radius+.09;
    return Math.abs(d)<r ? Math.max(.76,radius+Math.sqrt(r*r-d*d)) : .76;
  };
  for (const side of [-1,1]) {
    // Curved door skins, with wheel openings instead of solid rectangular cab blocks.
    g.surface(m.paint,48,8,(u,v) => {
      const z=back+(front-back)*u, y=lower(z)+(belt-lower(z))*v;
      return [side*(half + Math.sin(v*Math.PI)*.025),y,z];
    },[side,0,0]);
    const outer: V3[] = [[side*half,belt,back],[side*half,belt,front],[side*topHalf,roof,topFront],[side*topHalf,roof,back]];
    const inner: V3[] = [[side*(half-.006),belt+.09,back+.12],[side*(half-.006),belt+.09,front-.12],[side*(topHalf+.007),roof-.1,topFront-.11],[side*(topHalf+.007),roof-.1,back+.12]];
    g.frame(m.paint,outer,inner,[side,0,0]);
    g.patch(m.glass,inner,[side,0,0]);
    g.line(m.dark,[...inner,inner[0]],.012);
    g.line(m.trim,[[side*(half+.018),belt-.08,back+.04],[side*(half+.018),belt-.08,front-.06]],.008);
    g.line(m.dark,[[side*(half+.03),.8,back+.08],[side*(half+.03),belt-.04,back+.08],[side*(half+.03),belt-.04,front-.1]],.006);
    for (const z of [van ? -2.12 : -1.57, axle]) {
      g.surface(m.paint,40,3,(u,v) => {const a=u*Math.PI, r=radius+.06+v*.08;return [side*(half+.1),radius+Math.sin(a)*r,z+Math.cos(a)*r];},[side,0,0]);
      g.surface(m.paint,40,3,(u,v) => {const a=u*Math.PI;return [side*(half-.03+v*.13),radius+Math.sin(a)*(radius+.14),z+Math.cos(a)*(radius+.14)];},[0,1,0]);
    }
    g.box(m.trim,[.16,.06,van?.9:.7],[side*(half+.05),.72,back+.45],.02);
    for(let n=0;n<5;n++) g.box(m.dark,[.13,.008,.025],[side*(half+.05),.754,back+.15+n*.12],0);
  }
  if (van) {
    g.box(m.paint,[2.03,1.06,.14],[0,1.33,3.22],.06);
    g.patch(m.paint,[[-half,belt,front],[half,belt,front],[1.015,belt,3.3],[-1.015,belt,3.3]],[0,1,0]);
  }
  for(const side of [-1,1]) g.box(m.paint,[.055,.075,topFront-back+.06],[side*(topHalf+.012),roof+.03,(back+topFront)/2],.012);
  // Crown the roof and form the raked windscreen as a repairable pane assembly.
  g.surface(m.paint,20,12,(u,v)=>[(u*2-1)*(topHalf+.035),roof+.07+Math.sin(u*Math.PI)*.035,back-.035+v*(topFront-back+.08)],[0,1,0]);
  const outer: V3[]=[[-half,belt,front],[half,belt,front],[topHalf,roof,topFront],[-topHalf,roof,topFront]];
  const inner: V3[]=[[-half+.075,belt+.08,front-.012],[half-.075,belt+.08,front-.012],[topHalf-.065,roof-.085,topFront+.018],[-topHalf+.065,roof-.085,topFront+.018]];
  g.frame(m.paint,outer,inner,[0,0,1]);g.line(m.dark,[...inner,inner[0]],.016);
  g.box(m.dark,[half*1.9,.14,.28],[0,belt-.05,front-.16],.04);
  for(const x of [-.4,.4]) g.rod(m.dark,[x-.19,belt+.095,front+.02],[x+.2,belt+.18,front+.003],.012);
  g.finish(model);
  const windshield = model.getObjectByName('truck_windshield')!;
  windshield.clear();const pane = new VehicleGeometry();pane.patch(m.glass,inner,[0,0,1]);pane.finish(windshield as THREE.Group);
  // Pleated seats are still installed independently, as before.
  const seats=model.getObjectByName('truck_seat')!;seats.clear();
  for(const x of [-.43,.43]) {
    const seat=new THREE.Group(), p=new VehicleGeometry(), z=van?1.7:.6;
    p.box(m.seat,[.58,.16,.61],[x,1.22,z],.055);
    p.box(m.seat,[.58,.72,.15],[x,1.57,z-.25],.055,[.08,0,0]);
    for(let i=-3;i<=3;i++) p.box(m.dark,[.009,.53,.008],[x+i*.064,1.58,z-.162],.003);
    p.box(m.steel,[.4,.25,.35],[x,1.02,z]);p.finish(seat);seats.add(seat);
  }
  const steering=model.getObjectByName('vehicle_steering')!;steering.clear();
  const controls=new VehicleGeometry();controls.ring(m.dark,.22,.024,[.43,belt+.13,front-.37]);
  controls.rod(m.steel,[.43,belt-.15,front-.2],[.43,belt+.13,front-.37],.028);
  controls.rod(m.steel,[.22,belt+.13,front-.37],[.64,belt+.13,front-.37],.012);controls.finish(steering as THREE.Group);
  for(let i=0;i<4;i++) {
    const wheel=model.getObjectByName(`Rig tire ${i}`)!;
    const tire=createYardTire(radius,.28);tire.rotation.z=Math.PI/2;wheel.add(tire);
  }
  if(van) {
    const details=new VehicleGeometry();
    for(const side of [-1,1]) {
      for(let i=0;i<9;i++) {
        const z=-2.9+i*.46;
        details.box(m.trim,[.023,2.12,.028],[side*1.075,2.06,z],.004);
        for(let j=0;j<8;j++) details.disc(m.steel,.009,.014,[side*1.092,1.1+j*.28,z],'x',6);
      }
      details.box(m.steel,[.035,.08,3.95],[side*1.09,1.08,-1],.008);
    }
    details.finish(model);
    const doors=model.getObjectByName('truck_box_door')!;
    doors.children.forEach((door,i)=>{
      const side=i===0?-1:1,p=new VehicleGeometry();
      p.rod(m.steel,[-side*.7,.12,-.07],[-side*.7,1.92,-.07],.017);
      for(const y of [.25,1,1.8]) p.box(m.trim,[.2,.07,.06],[-side*.12,y,-.08],.008);
      p.box(m.steel,[.24,.04,.05],[-side*.6,.8,-.1],.008);p.finish(door as THREE.Group);
    });
  } else {
    const hood=model.getObjectByName('truck_hood')!;hood.clear();const h=new VehicleGeometry();
    h.surface(m.paint,20,16,(u,v)=>[(u*2-1)*(.87-.035*v),1.82-.15*v+Math.sin(u*Math.PI)*.045,1.68+v*1.14],[0,1,0]);
    for(const side of [-1,1]) h.patch(m.paint,[[side*.87,1.25,1.68],[side*.835,1.25,2.82],[side*.835,1.67,2.82],[side*.87,1.82,1.68]],[side,0,0]);
    h.finish(hood as THREE.Group);
    const grille=model.getObjectByName('truck_grille')!;grille.clear();const r=new VehicleGeometry();
    r.box(m.dark,[1.25,.48,.09],[0,1.25,2.88],.025);
    for(let n=0;n<6;n++) r.box(m.steel,[1.18,.022,.035],[0,1.06+n*.075,2.94],.005);
    r.finish(grille as THREE.Group);
    const bed=model.getObjectByName('pickup_bed')!;bed.clear();const p=new VehicleGeometry();
    p.box(m.paint,[1.84,.1,2.5],[0,.98,-1.55],.035);
    for(let i=-5;i<=5;i++) p.box(m.trim,[.028,.012,2.4],[i*.15,1.037,-1.55],.004);
    for(const side of [-1,1]) {
      p.box(m.paint,[.085,.55,2.5],[side*.93,1.3,-1.55],.04);
      p.box(m.trim,[.13,.055,2.5],[side*.93,1.6,-1.55],.02);
      p.box(m.paint,[.27,.3,.82],[side*.79,1.18,-1.57],.1);
    }
    p.box(m.paint,[1.85,.55,.1],[0,1.3,-2.8],.04);
    p.box(m.paint,[1.45,.31,.035],[0,1.3,-2.865],.025);
    p.box(m.trim,[.24,.045,.03],[0,1.5,-2.89],.01);p.finish(bed as THREE.Group);
  }
  // Batch only fixed body meshes; repair assemblies and animated wheel groups stay separate.
  const fixed = new VehicleGeometry();
  for(const child of [...model.children]) {
    if(!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const geometry = child.geometry.clone().applyMatrix4(child.matrix);
    for(const attribute of Object.keys(geometry.attributes))
      if(!['position','normal','uv'].includes(attribute)) geometry.deleteAttribute(attribute);
    fixed.add(geometry,child.material);
    child.removeFromParent();child.geometry.dispose();
  }
  fixed.finish(model);

}
