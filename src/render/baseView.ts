import { worldMaterial } from './worldMaterials';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHIPPING, type ShippingKind } from '../data/shippingContainers';
import { footprint, heightLevels, type Layout, type Piece, type PieceKind, type PieceSpec } from '../rules/baseBuild';

// Draws a base layout. All pieces of one kind are ONE instanced mesh, so thousands of pieces cost
// a handful of draw calls (plus shadows).
//  - Containers use the real model (public/models/shipping-container.glb, a 20 ft container with
//    about 4,200 triangles). A 40 ft container is drawn as two of them end to end.
//  - Level of detail: only containers that are close AND on screen get the full model. Every other
//    container is drawn as a plain box of the same size, so a big base stays cheap.
//    Until the model has loaded, everything is boxes.
//  - Picking and aiming use simple invisible boxes, which are far cheaper to ray test than the model.
//  - Pillars are plain concrete posts.

export const CONTAINER_MODEL_URL = '/models/shipping-container.glb';
/** Containers within this many metres of the camera (and on screen) are drawn with the full model. */
export const DETAIL_RADIUS = 45;

const RIB_PITCH = 0.3; // metres between corrugation ribs (distant boxes only)

function corrugationTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 4;
  const g = canvas.getContext('2d')!;
  for (let x = 0; x < 64; x++) {
    const v = 0.86 + 0.14 * (0.5 + 0.5 * Math.cos((x / 64) * Math.PI * 2));
    const c = Math.round(v * 255);
    g.fillStyle = `rgb(${c},${c},${c})`;
    g.fillRect(x, 0, 1, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A box of the container's size. Texture coordinates run along the ribs at real-world scale. */
function containerBoxGeometry(kind: ShippingKind): THREE.BoxGeometry {
  const def = SHIPPING.kinds[kind];
  const lx = def.long * SHIPPING.cell;
  const lz = def.wide * SHIPPING.cell;
  const g = new THREE.BoxGeometry(lx, SHIPPING.height, lz);
  const uv = g.attributes.uv;
  // BoxGeometry faces, 4 vertices each: +x, -x, +y, -y, +z, -z. u runs across the face's width.
  const widths = [lz, lz, lx, lx, lx, lx];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) uv.setX(f * 4 + v, (uv.getX(f * 4 + v) * widths[f]) / RIB_PITCH);
  }
  uv.needsUpdate = true;
  return g;
}

export interface Pick {
  piece: Piece;
  point: THREE.Vector3;
  /** World-space surface direction at the hit. */
  normal: THREE.Vector3;
}

export interface BaseView {
  group: THREE.Group;
  /** Rebuild what is drawn from the layout. Call after any change. */
  sync(layout: Layout): void;
  /** Call every frame: picks which containers get the full model, based on the camera. */
  update(camera: THREE.Camera): void;
  pick(raycaster: THREE.Raycaster): Pick | null;
  /** Show or hide the placement preview, including any pillars that would be added. */
  setGhost(spec: PieceSpec | null, ok: boolean, pillars?: PieceSpec[]): void;
  drawnCount(): number;
  /** How many container models are drawn in full detail right now. */
  detailCount(): number;
  /** Resolves true when the container model has loaded, false if it failed (boxes stay). */
  modelReady: Promise<boolean>;
}

const PICK_KINDS: PieceKind[] = ['ft20', 'ft40', 'pillar'];
const SHIP_KINDS: ShippingKind[] = ['ft20', 'ft40'];

interface Item {
  id: number;
  kind: ShippingKind;
  x: number;
  y: number;
  z: number;
  /** One matrix for the box, and one or two for the model. */
  box: THREE.Matrix4;
  model: THREE.Matrix4[];
}

export function createBaseView(capacity = 8000): BaseView {
  const group = new THREE.Group();
  const boxMaterial = worldMaterial('metal', { map: corrugationTexture(), color: 0x46607c, roughness: 0.78, metalness: 0.2 });
  const pillarMaterial = worldMaterial('concrete', { color: 0x8d8c85 });
  const invisible = new THREE.MeshBasicMaterial();
  const pw = SHIPPING.pillarWidth;
  const boxGeometry = {
    ft20: containerBoxGeometry('ft20'),
    ft40: containerBoxGeometry('ft40'),
  } satisfies Record<ShippingKind, THREE.BoxGeometry>;
  const pillarGeometry = new THREE.BoxGeometry(pw, 1, pw); // one metre tall; stretched to the pillar's height

  function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number, shadows: boolean) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.count = 0;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.frustumCulled = false; // one bounding sphere for the whole base would be useless
    return mesh;
  }

  // Aiming boxes: never drawn, only ray tested. The pillars are drawn as well as ray tested.
  const pickMeshes = {
    ft20: instanced(boxGeometry.ft20, invisible, capacity, false),
    ft40: instanced(boxGeometry.ft40, invisible, capacity, false),
    pillar: instanced(pillarGeometry, pillarMaterial, capacity * 2, true),
  } satisfies Record<PieceKind, THREE.InstancedMesh>;
  pickMeshes.ft20.visible = false;
  pickMeshes.ft40.visible = false;
  const pickIds = { ft20: [] as number[], ft40: [] as number[], pillar: [] as number[] };
  // Distant containers, drawn as boxes.
  const farMeshes = {
    ft20: instanced(boxGeometry.ft20, boxMaterial, capacity, true),
    ft40: instanced(boxGeometry.ft40, boxMaterial, capacity, true),
  };
  for (const k of PICK_KINDS) group.add(pickMeshes[k]);
  for (const k of SHIP_KINDS) group.add(farMeshes[k]);

  // The real container model: one instanced mesh, created once the file has loaded.
  let modelMesh: THREE.InstancedMesh | null = null;
  const MODEL_CAPACITY = capacity * 2; // a 40 ft container takes two
  const modelReady = new Promise<boolean>((resolve) => {
    new GLTFLoader().load(
      CONTAINER_MODEL_URL,
      (gltf) => {
        let source: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh;
        });
        if (!source) return resolve(false);
        const src = source as THREE.Mesh;
        // Centre the model on its middle and fit it to exactly 5 by 2 cells and one level high.
        const geometry = src.geometry.clone();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        geometry.applyMatrix4(
          new THREE.Matrix4()
            .makeScale(
              (SHIPPING.kinds.ft20.long * SHIPPING.cell) / size.x,
              SHIPPING.height / size.y,
              (SHIPPING.kinds.ft20.wide * SHIPPING.cell) / size.z,
            )
            .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)),
        );
        modelMesh = instanced(geometry, src.material as THREE.Material, MODEL_CAPACITY, true);
        group.add(modelMesh);
        lodDirty = true;
        resolve(true);
      },
      undefined,
      () => resolve(false),
    );
  });

  // The placement preview. It has to be easy to read from a distance and from behind other pieces:
  // a translucent block, a bright outline that shows through anything in front of it, and a flat
  // patch on the ground under it, so you can see where it lands and where an overhang reaches.
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.5, depthWrite: false });
  const ghost = new THREE.Mesh(boxGeometry.ft40, ghostMaterial);
  ghost.visible = false;
  ghost.renderOrder = 10;
  group.add(ghost);
  const edgeGeometry = {
    ft20: new THREE.EdgesGeometry(boxGeometry.ft20),
    ft40: new THREE.EdgesGeometry(boxGeometry.ft40),
    pillar: new THREE.EdgesGeometry(pillarGeometry),
  } satisfies Record<PieceKind, THREE.BufferGeometry>;
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xa8ffbc, transparent: true, opacity: 0.95, depthTest: false });
  const ghostEdges = new THREE.LineSegments(edgeGeometry.ft40, edgeMaterial);
  ghostEdges.renderOrder = 11;
  ghost.add(ghostEdges);
  const footprintMaterial = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.4, depthWrite: false });
  const ghostFootprint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), footprintMaterial);
  ghostFootprint.visible = false;
  ghostFootprint.renderOrder = 9;
  group.add(ghostFootprint);
  const ghostPillars = Array.from({ length: 4 }, () => {
    const mesh = new THREE.Mesh(pillarGeometry, ghostMaterial);
    mesh.visible = false;
    mesh.renderOrder = 10;
    group.add(mesh);
    return mesh;
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const offset = new THREE.Vector3();
  const lookup = new Map<number, Piece>();
  let records: Item[] = [];
  let lodDirty = true;
  let detailDrawn = 0;
  const half = (SHIPPING.kinds.ft20.long * SHIPPING.cell) / 2; // half the length of a 20 ft model

  function placement(spec: PieceSpec, out: THREE.Matrix4) {
    const { w, d } = footprint(spec.kind, spec.rot);
    const levels = heightLevels(spec);
    pos.set(
      (spec.gx + w / 2) * SHIPPING.cell,
      (spec.level + levels / 2) * SHIPPING.height,
      (spec.gz + d / 2) * SHIPPING.cell,
    );
    q.setFromAxisAngle(up, spec.kind === 'pillar' ? 0 : spec.rot * (Math.PI / 2));
    scale.set(1, spec.kind === 'pillar' ? levels * SHIPPING.height : 1, 1);
    out.compose(pos, q, scale);
  }

  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const lastCamera = new THREE.Matrix4();
  let lastCameraSet = false;

  function updateLod(camera: THREE.Camera) {
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    const cx = camera.matrixWorld.elements[12];
    const cy = camera.matrixWorld.elements[13];
    const cz = camera.matrixWorld.elements[14];
    const r2 = DETAIL_RADIUS * DETAIL_RADIUS;
    let near = 0;
    let far20 = 0;
    let far40 = 0;
    for (const r of records) {
      const dx = r.x - cx;
      const dy = r.y - cy;
      const dz = r.z - cz;
      let detailed = false;
      if (modelMesh && dx * dx + dy * dy + dz * dz < r2) {
        sphere.center.set(r.x, r.y, r.z);
        sphere.radius = r.kind === 'ft40' ? 7.5 : 4.2; // half the diagonal of the box
        detailed = frustum.intersectsSphere(sphere);
      }
      if (detailed) {
        for (const mat of r.model) if (near < MODEL_CAPACITY) modelMesh!.setMatrixAt(near++, mat);
      } else if (r.kind === 'ft20') {
        farMeshes.ft20.setMatrixAt(far20++, r.box);
      } else {
        farMeshes.ft40.setMatrixAt(far40++, r.box);
      }
    }
    farMeshes.ft20.count = far20;
    farMeshes.ft40.count = far40;
    farMeshes.ft20.instanceMatrix.needsUpdate = true;
    farMeshes.ft40.instanceMatrix.needsUpdate = true;
    if (modelMesh) {
      modelMesh.count = near;
      modelMesh.instanceMatrix.needsUpdate = true;
    }
    detailDrawn = near;
  }

  return {
    group,
    modelReady,
    sync(layout) {
      lookup.clear();
      for (const k of PICK_KINDS) pickIds[k].length = 0;
      records = [];
      for (const piece of layout.pieces.values()) {
        const ids = pickIds[piece.kind];
        if (ids.length >= pickMeshes[piece.kind].instanceMatrix.count) continue;
        placement(piece, m);
        pickMeshes[piece.kind].setMatrixAt(ids.length, m);
        ids.push(piece.id);
        lookup.set(piece.id, piece);
        if (piece.kind === 'pillar') continue;
        const kind = piece.kind;
        const { w, d } = footprint(kind, piece.rot);
        const x = (piece.gx + w / 2) * SHIPPING.cell;
        const y = (piece.level + 0.5) * SHIPPING.height;
        const z = (piece.gz + d / 2) * SHIPPING.cell;
        q.setFromAxisAngle(up, piece.rot * (Math.PI / 2));
        // A 40 ft container is two 20 ft models end to end, along its length.
        const shifts = kind === 'ft40' ? [-half, half] : [0];
        records.push({
          id: piece.id,
          kind,
          x,
          y,
          z,
          box: m.clone(),
          model: shifts.map((s) => {
            offset.set(s, 0, 0).applyQuaternion(q);
            pos.set(x, y, z).add(offset);
            return new THREE.Matrix4().compose(pos, q, one);
          }),
        });
      }
      for (const k of PICK_KINDS) {
        pickMeshes[k].count = pickIds[k].length;
        pickMeshes[k].instanceMatrix.needsUpdate = true;
        pickMeshes[k].computeBoundingSphere();
      }
      lodDirty = true;
    },
    update(camera) {
      camera.updateMatrixWorld();
      if (!lodDirty && lastCameraSet && lastCamera.equals(camera.matrixWorld)) return;
      lastCamera.copy(camera.matrixWorld);
      lastCameraSet = true;
      lodDirty = false;
      updateLod(camera);
    },
    pick(raycaster) {
      const hits = raycaster.intersectObjects(PICK_KINDS.map((k) => pickMeshes[k]), false);
      for (const hit of hits) {
        if (hit.instanceId === undefined || !hit.face) continue;
        const kind = PICK_KINDS.find((k) => pickMeshes[k] === hit.object)!;
        const piece = lookup.get(pickIds[kind][hit.instanceId]);
        if (!piece) continue;
        (hit.object as THREE.InstancedMesh).getMatrixAt(hit.instanceId, m);
        const normal = hit.face.normal.clone().transformDirection(m);
        return { piece, point: hit.point.clone(), normal };
      }
      return null;
    },
    setGhost(spec, ok, pillars = []) {
      ghostMaterial.color.setHex(ok ? 0x55ff77 : 0xff5544);
      footprintMaterial.color.setHex(ok ? 0x55ff77 : 0xff5544);
      edgeMaterial.color.setHex(ok ? 0xa8ffbc : 0xffb0a4);
      for (const p of ghostPillars) p.visible = false;
      if (!spec) {
        ghost.visible = false;
        ghostFootprint.visible = false;
        return;
      }
      ghost.geometry = spec.kind === 'pillar' ? pillarGeometry : boxGeometry[spec.kind];
      ghostEdges.geometry = edgeGeometry[spec.kind];
      placement(spec, m);
      m.decompose(ghost.position, ghost.quaternion, ghost.scale);
      ghost.visible = true;
      const { w, d } = footprint(spec.kind, spec.rot);
      ghostFootprint.position.set((spec.gx + w / 2) * SHIPPING.cell, 0.05, (spec.gz + d / 2) * SHIPPING.cell);
      ghostFootprint.scale.set(w * SHIPPING.cell, 1, d * SHIPPING.cell);
      ghostFootprint.visible = true;
      pillars.slice(0, ghostPillars.length).forEach((p, i) => {
        placement(p, m);
        m.decompose(ghostPillars[i].position, ghostPillars[i].quaternion, ghostPillars[i].scale);
        ghostPillars[i].visible = true;
      });
    },
    drawnCount() {
      return PICK_KINDS.reduce((n, k) => n + pickMeshes[k].count, 0);
    },
    detailCount() {
      return detailDrawn;
    },
  };
}
