import * as THREE from 'three';

// Weathered metal for wrecks. The look comes from a shader that works out rust and bare steel from where each
// point is on the object, so it needs no texture coordinates and every part of a model gets it.
//  - 'paint': the original paint is faded and chalky, gone in patches (bare dull steel), with rust spreading
//    from the patches and worst near the bottom of the body.
//  - 'chrome': dull and pitted, with rust freckles.
// Restoring a vehicle later swaps these for clean materials.

export type RustKind = 'paint' | 'chrome';

const HELPERS = /* glsl */ `
varying vec3 vRustPos;
float gRust = 0.0;
float rustHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float rustNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(rustHash(i), rustHash(i + vec3(1, 0, 0)), f.x), mix(rustHash(i + vec3(0, 1, 0)), rustHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(rustHash(i + vec3(0, 0, 1)), rustHash(i + vec3(1, 0, 1)), f.x), mix(rustHash(i + vec3(0, 1, 1)), rustHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float rustFbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * rustNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

const paintColour = (dark: string, light: string) => /* glsl */ `
{
  vec3 p = vRustPos;
  float big = rustFbm(p * 1.7);
  float mid = rustFbm(p * 6.0 + 11.0);
  float fine = rustFbm(p * 31.0 + 3.0);
  float low = 1.0 - smoothstep(-0.15, 0.45, p.y); // more rust towards the bottom of the body
  float gone = smoothstep(0.46, 0.64, big * 0.6 + mid * 0.28 + fine * 0.12 + low * 0.3); // where the paint has gone
  float rusty = smoothstep(0.38, 0.6, mid * 0.55 + fine * 0.45 + low * 0.3);
  vec3 chalk = mix(${dark}, ${light}, fine); // the faded, chalky old paint
  vec3 steel = mix(vec3(0.17, 0.16, 0.15), vec3(0.26, 0.23, 0.2), mid); // bare steel, dulled
  vec3 rust = mix(vec3(0.11, 0.05, 0.028), vec3(0.34, 0.15, 0.06), fine * 0.7 + mid * 0.3);
  gRust = clamp(gone * (0.3 + 0.7 * rusty) + low * rusty * 0.25, 0.0, 1.0);
  vec3 c = mix(chalk, steel, gone * 0.55);
  diffuseColor.rgb = mix(c, rust, gRust);
}
`;

const CHROME_COLOUR = /* glsl */ `
{
  vec3 p = vRustPos;
  float low = 1.0 - smoothstep(-0.15, 0.45, p.y);
  float spot = smoothstep(0.6, 0.76, rustFbm(p * 40.0) * 0.6 + rustFbm(p * 9.0 + 5.0) * 0.4 + low * 0.15);
  vec3 rust = mix(vec3(0.1, 0.045, 0.025), vec3(0.3, 0.13, 0.05), rustFbm(p * 60.0));
  gRust = spot;
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.45, rust, spot); // tarnished, with rust freckles
}
`;

const vec3 = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

/** paintColour sets the old paint's colour (in linear light); left out, it is the El Cajon's faded blue. */
export function createRustedMaterial(kind: RustKind, baseColour = 0xffffff, paint?: number): THREE.MeshStandardMaterial {
  const paintCode =
    paint === undefined
      ? paintColour('vec3(0.085, 0.13, 0.17)', 'vec3(0.17, 0.215, 0.24)')
      : paintColour(vec3(new THREE.Color(paint).multiplyScalar(0.55)), vec3(new THREE.Color(paint)));
  const material = new THREE.MeshStandardMaterial({
    color: baseColour,
    metalness: kind === 'paint' ? 0.4 : 0.8,
    roughness: kind === 'paint' ? 0.7 : 0.45,
  });
  material.onBeforeCompile = (shader: { vertexShader: string; fragmentShader: string }) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRustPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRustPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HELPERS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (kind === 'paint' ? paintCode : CHROME_COLOUR))
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = ' +
          (kind === 'paint' ? 'mix(0.6, 0.93, gRust);' : 'mix(0.4, 0.9, gRust);'),
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = ' + (kind === 'paint' ? 'mix(0.5, 0.12, gRust);' : 'mix(0.85, 0.15, gRust);'),
      );
  };
  material.customProgramCacheKey = () => `rusted-${kind}-${paint ?? 'blue'}`;
  return material;
}
