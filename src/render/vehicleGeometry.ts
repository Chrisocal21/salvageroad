import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];
export const lerp = THREE.MathUtils.lerp;
export const blend = (a: V3, b: V3, t: number): V3 => a.map((value, i) => lerp(value, b[i], t)) as V3;
export const quadPoint = (q: V3[], u: number, v: number): V3 => blend(blend(q[0], q[1], u), blend(q[3], q[2], u), v);

/** Fitted sheet-metal surfaces with explicit outward winding, baked into a few material batches. */
export class VehicleGeometry {
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(g: THREE.BufferGeometry, material: THREE.Material, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0]) {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const geometry = g.index ? g.toNonIndexed() : g;
    if (geometry !== g) g.dispose();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    const batch = this.batches.get(material) ?? [];
    batch.push(geometry); this.batches.set(material, batch);
  }

  box(material: THREE.Material, size: V3, position: V3, radius = 0.008, rotation: V3 = [0, 0, 0]) {
    this.add(radius > 0 && Math.min(...size) > 0.008
      ? new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) * 0.45))
      : new THREE.BoxGeometry(...size), material, position, rotation);
  }

  surface(material: THREE.Material, nu: number, nv: number, sample: (u: number, v: number) => V3, outward: V3) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let u = 0; u <= nu; u++) for (let v = 0; v <= nv; v++) {
      positions.push(...sample(u / nu, v / nv)); uv.push(u / nu, v / nv);
      if (u < nu && v < nv) {
        const a = u * (nv + 1) + v, b = a + nv + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const normal = geometry.attributes.normal;
    const average = new THREE.Vector3();
    for (let i = 0; i < normal.count; i++) average.add(new THREE.Vector3().fromBufferAttribute(normal, i));
    if (average.dot(new THREE.Vector3(...outward)) < 0) {
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      geometry.setIndex(indices); geometry.computeVertexNormals();
    }
    this.add(geometry, material);
  }

  patch(material: THREE.Material, q: V3[], outward: V3) {
    this.surface(material, 1, 1, (u, v) => quadPoint(q, u, v), outward);
  }

  frame(material: THREE.Material, outer: V3[], inner: V3[], outward: V3) {
    outer.forEach((p, i) => this.patch(material, [p, outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i]], outward));
  }

  line(material: THREE.Material, points: V3[], radius = 0.003) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    this.add(new THREE.TubeGeometry(path, Math.max(8, points.length * 2), radius, 6, false), material);
  }

  rod(material: THREE.Material, a: V3, b: V3, radius: number) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    this.add(g, material, from.add(to).multiplyScalar(0.5).toArray() as V3);
  }

  disc(material: THREE.Material, radius: number, depth: number, p: V3, axis: 'x' | 'z' = 'z', segments = 32) {
    this.add(new THREE.CylinderGeometry(radius, radius, depth, segments), material, p, axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]);
  }

  ring(material: THREE.Material, radius: number, thickness: number, p: V3, axis: 'x' | 'z' = 'z') {
    this.add(new THREE.TorusGeometry(radius, thickness, 8, 48), material, p, axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]);
  }

  finish(parent: THREE.Group) {
    for (const [material, parts] of this.batches) {
      const geometry = mergeGeometries(parts)!;
      parts.forEach(p => p.dispose());
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = material.name;
      mesh.castShadow = !material.transparent;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.batches.clear();
  }
}
