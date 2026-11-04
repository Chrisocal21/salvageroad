import * as THREE from 'three';

type Surface = 'sand' | 'grass' | 'rock' | 'bark' | 'asphalt' | 'concrete' | 'wood' | 'terrain' | 'metal' | 'brick-red' | 'brick-1' | 'brick-2';
const textures = new Map<string, THREE.Texture>();
function texture(name: string): THREE.Texture {
  let result = textures.get(name);
  if (!result) {
    result = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/world/${name}.jpg`);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    textures.set(name, result);
  }
  return result;
}

/** World-space projection keeps texel size consistent across boxes, cliffs and terrain LODs.
 * Shared images are owned by this module, not individual streamed terrain tiles. */
export function worldMaterial(surface: Surface, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.94, ...options });
  const terrain = surface === 'terrain';
  const brick = surface.startsWith('brick');
  const source = terrain ? 'sand' : surface === 'metal' ? 'asphalt' : surface;
  const scale = brick ? (surface === 'brick-2' ? 0.65 : 0.14) : surface === 'bark' || surface === 'wood' ? 0.7 : surface === 'concrete' ? 0.32 : 0.24;
  material.onBeforeCompile = shader => {
    shader.uniforms.surfaceMap = { value: texture(source) };
    if (terrain) {
      shader.uniforms.grassMap = { value: texture('grass') };
      shader.uniforms.rockMap = { value: texture('rock') };
    }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vSurfacePosition;`);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
vec4 surfacePosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
surfacePosition = instanceMatrix * surfacePosition;
#endif
vSurfacePosition = (modelMatrix * surfacePosition).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSurfacePosition;
uniform sampler2D surfaceMap;
${terrain ? 'uniform sampler2D grassMap; uniform sampler2D rockMap;' : ''}
vec3 surfaceSample(sampler2D tex, vec3 p, vec3 weights) {
  return texture2D(tex, ${brick ? 'p.zy' : 'p.yz'}).rgb * weights.x + texture2D(tex, p.xz).rgb * weights.y + texture2D(tex, p.xy).rgb * weights.z;
}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec3 surfaceNormal = normalize(cross(dFdx(vSurfacePosition), dFdy(vSurfacePosition)));
vec3 weights = pow(abs(surfaceNormal), vec3(6.0));
weights /= max(dot(weights, vec3(1.0)), 0.0001);
vec3 detail = surfaceSample(surfaceMap, vSurfacePosition * ${scale.toFixed(2)}, weights);
${terrain ? `
float greenery = smoothstep(0.02, 0.13, diffuseColor.g - diffuseColor.r);
detail = mix(detail, surfaceSample(grassMap, vSurfacePosition * 0.22, weights), greenery);
detail = mix(detail, surfaceSample(rockMap, vSurfacePosition * 0.18, weights), smoothstep(0.2, 0.65, 1.0 - abs(surfaceNormal.y)));
` : ''}
float detailFade = 1.0 - smoothstep(90.0, 650.0, length(vViewPosition));
float relief = dot(detail, vec3(0.299, 0.587, 0.114)) * detailFade;
${brick ? 'diffuseColor.rgb *= detail * 1.35;' : 'diffuseColor.rgb *= mix(vec3(1.0), clamp(vec3(0.48) + detail * 1.65, vec3(0.32), vec3(1.5)), detailFade);'}
`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Screen-space height derivatives provide fine relief without requiring UVs or tangent frames.
vec3 surfaceDx = dFdx(-vViewPosition);
vec3 surfaceDy = dFdy(-vViewPosition);
vec3 crossY = cross(surfaceDy, normal);
vec3 crossX = cross(normal, surfaceDx);
float determinant = dot(surfaceDx, crossY);
normal = normalize(max(abs(determinant), 0.00000001) * normal - sign(determinant) * 0.10 * (dFdx(relief) * crossY + dFdy(relief) * crossX));
`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (relief - 0.4) * 0.16, 0.08, 1.0);`);
  };
  material.customProgramCacheKey = () => `world-surface-v1-${surface}`;
  return material;
}
