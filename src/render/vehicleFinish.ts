import { VehicleGeometry } from './vehicleGeometry';
import * as THREE from 'three';
import { createRustedMaterial } from './rust';

/** Ground-relative counterpart of the El Cajon's weathered paint and brightwork. */
export function vehicleFinish(color: number) {
  const paint = createRustedMaterial('paint', 0xffffff, color);
  const compile = paint.onBeforeCompile.bind(paint);
  paint.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('vRustPos = position;', 'vRustPos = position - vec3(0.0, 0.85, 0.0);');
  };
  paint.customProgramCacheKey = () => `commercial-paint-${color}`;
  paint.name = 'Faded paint and lower-panel corrosion';
  const steel = createRustedMaterial('chrome', 0xb3b9b6); steel.name = 'Pitted steel';
  const dark = new THREE.MeshStandardMaterial({color:0x1c2221,roughness:.87}); dark.name = 'Rubber seals and recesses';
  const glass = new THREE.MeshPhysicalMaterial({color:0xa5b8b7,roughness:.15,metalness:.05,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,clearcoat:1}); glass.name = 'Dusty glazing';
  const trim = new THREE.MeshStandardMaterial({color:0x89948f,roughness:.43,metalness:.75}); trim.name = 'Satin alloy trim';
  const seat = new THREE.MeshStandardMaterial({color:0x6b5946,roughness:.96}); seat.name = 'Worn seat upholstery';
  return {paint,steel,dark,glass,trim,seat};
}

/** Cross-stacked cribbing keeps an unfinished chassis visibly supported. */
export function createVehicleCrib() {
  const root = new THREE.Group(), g = new VehicleGeometry();
  const wood = new THREE.MeshStandardMaterial({color:0x70604a,roughness:.97});
  const end = new THREE.MeshStandardMaterial({color:0x403a30,roughness:1});
  for(let layer=0;layer<3;layer++) for(const side of [-1,1]) {
    const across=layer%2===0;
    g.box(wood,across?[.62,.21,.14]:[.14,.21,.62],[across?0:side*.2,.105+layer*.22,across?side*.2:0],.012);
    if(across) for(const x of [-.312,.312]) g.box(end,[.003,.09,.06],[x,.105+layer*.22,side*.2],.006);
  }
  g.finish(root);return root;
}
