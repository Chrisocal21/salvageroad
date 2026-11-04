import * as THREE from 'three';

let rubber: THREE.MeshStandardMaterial | undefined;
function tireMaterial(): THREE.MeshStandardMaterial {
  if (rubber) return rubber;
  rubber = new THREE.MeshStandardMaterial({ color: 0x30302c, roughness: 0.94 });
  rubber.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTire;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTire = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTire;
float tirePattern(vec3 p) {
  float angle = atan(p.x, p.z) / 6.2831853;
  float across = p.y / length(p.xz);
  float tread = 1.0 - smoothstep(0.22, 0.34, abs(across));
  float zig = abs(fract(angle * 52.0 + abs(across) * 3.0) - 0.5);
  float cuts = 1.0 - smoothstep(0.035, 0.08, zig);
  float groove = 1.0 - smoothstep(0.018, 0.035, abs(abs(across) - 0.12));
  float grain = fract(sin(dot(floor(p * 1700.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  float sideRings = sin(length(p.xz) * 480.0) * 0.025;
  return 0.66 + grain * 0.10 + sideRings * (1.0 - tread) - max(cuts, groove) * tread * 0.44;
}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float tireHeight = tirePattern(vTire);
diffuseColor.rgb *= tireHeight;
diffuseColor.rgb += vec3(0.018, 0.014, 0.009) * (0.5 + 0.5 * sin(vTire.x * 23.0 + vTire.z * 18.0));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 tx = dFdx(-vViewPosition), ty = dFdy(-vViewPosition);
vec3 ry = cross(ty, normal), rx = cross(normal, tx);
float det = dot(tx, ry);
normal = normalize(max(abs(det), 1e-8) * normal - sign(det) * 0.006 * (dFdx(tireHeight) * ry + dFdy(tireHeight) * rx));`);
  };
  rubber.customProgramCacheKey = () => 'yard-tire-tread-v1';
  return rubber;
}

/** Open bead, rounded sidewalls and a broad tread shoulder. Axle points along local Y. */
export function createYardTire(radius = 0.36, width = 0.22): THREE.Mesh {
  const r = radius, w = width / 2;
  const profile = [
    [r * 0.57, -w * 0.72], [r * 0.58, -w], [r * 0.73, -w * 1.06],
    [r * 0.89, -w], [r * 0.97, -w * 0.8], [r, -w * 0.5],
    [r, w * 0.5], [r * 0.97, w * 0.8], [r * 0.89, w],
    [r * 0.73, w * 1.06], [r * 0.58, w], [r * 0.57, w * 0.72],
    [r * 0.57, -w * 0.72],
  ];
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64), tireMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
