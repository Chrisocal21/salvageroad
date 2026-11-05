import { refineImportedVehicle } from './refineImportedVehicle';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { partsForRig, rigRequirements, type RigKind, type RigPart } from '../rules/rigBuild';

export type ImportedVehicleKind = Extract<RigKind, 'salvage-pickup' | 'step-van'>;
export const IMPORTED_VEHICLES = {
  'salvage-pickup': { file: 'unfinished_pickup.glb', half: [1.3, 1.2, 3.15] as const, offset: 1.7, wheelX: .94, front: 1.92, rear: -1.57, radius: .55, mass: 2100, engine: 1.5, slots: 28 },
  'step-van': { file: 'delivery_step_van.glb', half: [1.5, 1.35, 3.7] as const, offset: 2, wheelX: 1.02, front: 2.34, rear: -2.12, radius: .52, mass: 3800, engine: 2.5, slots: 64 },
};

/** Source models use -X forward and Z up; the game uses +Z forward and Y up. */
export const IMPORTED_ROTATION = new THREE.Matrix4().makeRotationY(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

export function assembleImportedVehicle(source: THREE.Group, kind: ImportedVehicleKind) {
  const config = IMPORTED_VEHICLES[kind], model = new THREE.Group();
  model.name = kind;
  const parts = new Map<RigPart, THREE.Group>();
  for (const id of partsForRig(kind)) {
    if (id === 'tire') continue;
    const group = new THREE.Group(); group.name = id; parts.set(id, group); model.add(group);
  }
  const wheels = Array.from({ length: 4 }, (_, i) => {
    const group = new THREE.Group();
    group.name = `Rig tire ${i}`;
    group.position.set((i % 2 ? 1 : -1) * config.wheelX, config.radius, i < 2 ? config.front : config.rear);
    model.add(group); return group;
  });
  const add = (id: RigPart, child: THREE.Object3D) => {
    const group = parts.get(id);
    if (!group) throw new Error(`Unexpected ${kind} repair component: ${id}`);
    group.add(child);
  };
  source.updateMatrixWorld(true);
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld).applyMatrix4(IMPORTED_ROTATION);
    const mesh = new THREE.Mesh(geometry, object.material);
    mesh.name = object.name;
    mesh.castShadow = mesh.receiveShadow = true;
    geometry.computeBoundingBox();
    const centre = geometry.boundingBox!.getCenter(new THREE.Vector3());
    const name = object.name.replace(/^\d+_/, '');
    if (kind === 'step-van' && name === 'cargo_box') {
      const position = geometry.getAttribute('position');
      const indices: number[] = [];
      const count = geometry.index?.count ?? position.count;
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map(n => geometry.index ? geometry.index.getX(i + n) : i + n);
        const cap = triangle.every(n => position.getY(n) > 3.14) ||
          triangle.every(n => position.getY(n) < .96) || triangle.every(n => position.getZ(n) < -2.99);
        if (!cap) indices.push(...triangle);
      }
      geometry.setIndex(indices);
    }
    if (/(?:front|rear)_(?:tire|sidewall|steel_rim|hub|lug_\d+)$/.test(name)) {
      const index = (name.includes('front') ? 0 : 2) + (centre.x > 0 ? 1 : 0);
      geometry.translate(-wheels[index].position.x, -wheels[index].position.y, -wheels[index].position.z);
      wheels[index].add(mesh);
    } else if (name.startsWith('engine_')) add('motor', mesh);
    else if (name.startsWith('radiator_')) add('truck_radiator', mesh);
    else if (kind === 'salvage-pickup' && name.startsWith('hood_')) add('truck_hood', mesh);
    else if (name.includes('windshield')) add('truck_windshield', mesh);
    else if (name === 'front_bumper') add('truck_front_bumper', mesh);
    else if (kind === 'salvage-pickup' && name.startsWith('grille_')) add('truck_grille', mesh);
    else if (name === 'cargo_roof') add('truck_box_roof', mesh);
    else if (name === 'headlight_lens') {
      mesh.geometry.translate(-centre.x, -centre.y, -centre.z);
      mesh.position.copy(centre); add('truck_headlight', mesh);
    } else if (name !== 'rear_end' || kind !== 'step-van') model.add(mesh);
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x77796e, roughness: .85 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xb77b44, roughness: .8 });
  function box(id: RigPart, size: [number, number, number], at: [number, number, number], material = steel) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; add(id, mesh);
    return mesh;
  }
  if (!parts.get('motor')!.children.length) box('motor', [.65, .5, .8], [0, 1, 2]);
  if (!parts.get('truck_radiator')!.children.length) box('truck_radiator', [.9, .55, .12], [0, 1.25, 2.8]);
  box('vehicle_battery', [.28, .3, .4], [.65, 1.3, 2]);
  box('vehicle_transmission', [.4, .4, .65], [0, .8, .4]);
  box('vehicle_steering', [.5, .15, .2], [.4, 1.7, 1.1]);
  for (const x of [-.43, .43]) box('truck_seat', [.5, .65, .5], [x, 1.35, kind === 'step-van' ? 1.7 : .6]);
  for (const wheel of wheels) box('truck_brakes', [.1, .32, .32], [wheel.position.x * .85, config.radius, wheel.position.z]);
  if (!parts.get('truck_headlight')!.children.length) for (const x of [-.68, .68])
    box('truck_headlight', [.24, .24, .14], [x, 1.28, 2.91], new THREE.MeshStandardMaterial({ color: 0xf1dfac, emissive: 0x44351a }));
  if (kind === 'salvage-pickup') {
    box('truck_grille', [1.25, .48, .14], [0, 1.25, 2.88]);
    const bed = new THREE.Group();
    const panel = (size: [number, number, number], at: [number, number, number]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), paint); mesh.position.set(...at); mesh.castShadow = true; bed.add(mesh);
    };
    panel([1.85, .12, 2.5], [0, 1, -1.55]);
    for (const x of [-.93, .93]) panel([.1, .55, 2.5], [x, 1.3, -1.55]);
    panel([1.85, .55, .1], [0, 1.3, -2.8]);
    add('pickup_bed', bed);
  } else {
    box('truck_box_floor', [2, .12, 3.8], [0, 1.03, -1]);
    for (const side of [-1, 1]) {
      const door = new THREE.Group();
      door.position.set(side, 1.03, -3.03);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.98, 2.05, .09), paint);
      panel.position.set(-side * .49, 1.025, 0); panel.castShadow = true; door.add(panel);
      add('truck_box_door', door);
    }
  }
  for (const [id, group] of parts) {
    if (!group.children.length) throw new Error(`No visual repair component for ${kind}: ${id}`);
    const required = rigRequirements(kind)[id]!;
    if (required === 1 && group.children.length > 1) {
      const assembly = new THREE.Group();
      assembly.add(...[...group.children]); group.add(assembly);
    }
  }
  refineImportedVehicle(model, kind === 'step-van');
  return model;
}

export async function createImportedVehicle(kind: ImportedVehicleKind) {
  const url = `${import.meta.env.BASE_URL}models/salvage-vehicles/${IMPORTED_VEHICLES[kind].file}`;
  const gltf = await new GLTFLoader().loadAsync(url);
  return assembleImportedVehicle(gltf.scene, kind);
}
