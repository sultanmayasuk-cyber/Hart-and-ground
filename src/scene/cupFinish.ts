import { Color, type MeshStandardMaterial } from 'three'

// Finishing touches on the Meshy cups' own baked material. Unit cup: base at y = 0, rim at about y = 0.93, radius 0.38.
// - ice (above the liquid line, inside the rim): crisp flat facets from the model's own lumps; looking straight into a
//   facet you see through to the drink, toward the edges bright cool reflection; the gaps low between cubes sit darker
// - condensation: glossy droplets beaded down the wall, two sizes, from 3D cells so there are no seams
// - the clear plastic lip gets a crisp highlight
const TINT = { coffee: '#5a3a22', matcha: '#4f7d2a' }

const COMMON = /* glsl */ `
varying vec3 vCupPos;
uniform vec3 uIceTint;
float iceZone() { return smoothstep(0.87, 0.91, vCupPos.y) * (1.0 - smoothstep(0.32, 0.35, length(vCupPos.xz))); }
float rimZone() { return smoothstep(0.905, 0.925, vCupPos.y) * (1.0 - smoothstep(0.955, 0.97, vCupPos.y)) * smoothstep(0.34, 0.37, length(vCupPos.xz)); }
float wallZone() { return smoothstep(0.05, 0.1, vCupPos.y) * (1.0 - smoothstep(0.74, 0.8, vCupPos.y)); }
vec3 cupHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
// one layer of droplets: 3D cells cut by the wall; returns the drop's height (0 between drops)
float dropLayer(vec3 p, float scale, float keep) {
  vec3 g = p * scale;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  vec3 h = cupHash3(id);
  if (h.x > keep) return 0.0;
  vec3 c = (cupHash3(id + 17.0) - 0.5) * 0.4;
  float r = 0.16 + 0.24 * h.y;
  float m = 1.0 - dot(f - c, f - c) / (r * r);
  return m > 0.0 ? sqrt(m) * r / scale : 0.0;
}
// bump the shading normal by a height field (screen-space derivatives, as three's bump map does)
vec3 cupBump(vec3 pos, vec3 n, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}`

export function finishCup(m: MeshStandardMaterial, drink: 'coffee' | 'matcha') {
  const tint = new Color(TINT[drink])
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uIceTint = { value: tint }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCupPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCupPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float cupDropH = (dropLayer(vCupPos, 34.0, 0.16) + dropLayer(vCupPos + 3.1, 85.0, 0.22)) * wallZone(); // a light dusting
float cupDrop = step(1e-5, cupDropH);
diffuseColor.rgb *= 1.0 - 0.05 * cupDrop;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.05, iceZone());
roughnessFactor = mix(roughnessFactor, 0.06, max(cupDrop, rimZone()));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec3 iceFlat = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
normal = normalize(mix(normal, iceFlat, 0.75 * iceZone()));
normal = cupBump(-vViewPosition, normal, cupDropH * 1.5);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float iz = iceZone();
if (iz > 0.0) {
  vec3 iceV = normalize(vViewPosition);
  float facing = clamp(dot(normal, iceV), 0.0, 1.0);
  float fres = pow(1.0 - facing, 3.0);
  float lum = dot(totalDiffuse, vec3(0.299, 0.587, 0.114));
  vec3 through = uIceTint * (0.3 + 0.7 * lum) * facing;
  vec3 ice = through + vec3(0.9, 0.95, 1.0) * fres * 0.85 + totalSpecular * 2.2 + totalDiffuse * 0.2;
  ice *= mix(1.0, 0.55, 1.0 - smoothstep(0.9, 0.95, vCupPos.y)); // the gaps down between cubes, in the drink
  outgoingLight = mix(outgoingLight, ice, iz);
}
outgoingLight += totalSpecular * (1.5 * rimZone() + 0.6 * cupDrop); // the lip and the droplets catch the light
#include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'cup-finish'
  m.needsUpdate = true
}

