import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  CustomBlending,
  LinearFilter,
  MeshPhysicalMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { PHONE } from '../env'

// Ice, the one material for every cube on the site (the hero's, the drink's inside, the matcha's). What makes a cube
// read as ice and not as white plastic:
// - a cube's shape: nearly square edges, a little taper and melt, a dimple pressed into one face (machine ice)
// - clear: what's behind shows through face-on; toward its edges the ice bends the room in instead, so the edges go
//   dark with bright streaks (it mirrors a contrasty studio of its own, see studio(), not the page's soft light)
// - inside it, drawn with parallax in the cube's own space: a frosty core with feathers running out to the corners,
//   a crack or two catching the light, trapped air bubbles
// - the surface isn't perfect: faint melt ripples and patches of frost break up the highlights
// Two ways to draw it. refract: real refraction of the scene behind (a second render: desktop only). layer: a
// see-through layer over whatever is behind (phones, and the menu's transparent canvas).

const H = /* glsl */ `
varying vec3 vIceP;
varying vec3 vIceN;
varying vec3 vIceCam;
varying float vIceSeed;
varying float vIceScale;
varying vec3 vIceM0;
varying vec3 vIceM1;
varying vec3 vIceM2;`

const FRAG = /* glsl */ `
float iceHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 iceHash3(float n) { return fract(sin(vec3(n, n + 1.37, n + 2.71) * vec3(12.9898, 78.233, 37.719)) * 43758.5453); }
float iceNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(iceHash(i), iceHash(i + vec3(1, 0, 0)), f.x), mix(iceHash(i + vec3(0, 1, 0)), iceHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(iceHash(i + vec3(0, 0, 1)), iceHash(i + vec3(1, 0, 1)), f.x), mix(iceHash(i + vec3(0, 1, 1)), iceHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float iceBoxExit(vec3 ro, vec3 rd, vec3 b) {
  vec3 m = 1.0 / rd;
  vec3 tf = max((-b - ro) * m, (b - ro) * m);
  return min(min(tf.x, tf.y), tf.z);
}
float iceSdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
vec3 iceBump(vec3 pos, vec3 n, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}`

// surround: instead of a studio, what's all round the cube, [above, below] (in the drink, the drink itself)
// under: the drink the cube sits in, which is what it shows looking down through it
type Opts = { refract: boolean; thickness?: number; studio?: boolean; tint?: string; surround?: [string, string]; under?: string }

function makeMaterial({ refract, thickness = 0.35, studio: ownRoom = true, tint = '#ffffff', surround, under }: Opts, room: CanvasTexture | null) {
  const bubbles = PHONE ? 6 : 10
  const m = new MeshPhysicalMaterial({
    color: refract ? '#ffffff' : '#000000', // (layer: nothing diffuse, it's all reflection and what comes through)
    roughness: 0.03,
    ior: 1.31,
    specularIntensity: 1,
    envMapIntensity: 1.25,
    ...(refract
      ? { transmission: 1, thickness, attenuationColor: new Color(tint), attenuationDistance: 6 }
      : {
          transparent: true,
          depthWrite: false,
          // premultiplied: the shader writes the light the ice adds, and how much of the background it hides
          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
        }),
  })
  // (the studio is read straight off its canvas in the shader, not handed to three as an envMap: three prefilters an
  // envMap with the same generator as the scene's own light, and that left the hero cup lit brighter, washed out)
  const studioRoom = ownRoom && room
  m.onBeforeCompile = (shader) => {
    if (studioRoom) shader.uniforms.uIceStudio = { value: room }
    if (under) shader.uniforms.uIceUnder = { value: new Color(under) }
    if (surround) {
      shader.uniforms.uIceAbove = { value: new Color(surround[0]) }
      shader.uniforms.uIceBelow = { value: new Color(surround[1]) }
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${H}\nattribute float aIceSeed;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vIceP = position;
vIceN = objectNormal;
vIceSeed = aIceSeed;
vIceCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
vIceScale = length(modelMatrix[0].xyz);
vIceM0 = normalize(modelMatrix[0].xyz);
vIceM1 = normalize(modelMatrix[1].xyz);
vIceM2 = normalize(modelMatrix[2].xyz);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${H}\n${FRAG}${surround ? '\nuniform vec3 uIceAbove;\nuniform vec3 uIceBelow;' : ''}${under ? '\nuniform vec3 uIceUnder;' : ''}${studioRoom ? '\nuniform sampler2D uIceStudio;' : ''}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float iceFrost = smoothstep(0.62, 0.85, iceNoise(vIceP * 5.0 + vIceSeed * 9.0)); // patches where the surface has frosted
roughnessFactor = mix(0.02, 0.22, iceFrost);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// melt: soft ripples over the faces, so highlights break up the way they do on real ice
float iceMelt = iceNoise(vIceP * 8.0 + vIceSeed * 5.0);
normal = iceBump(-vViewPosition, normal, iceMelt * 0.012 * vIceScale);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 V = normalize(vViewPosition);
  float facing = clamp(dot(normal, V), 0.0, 1.0);
  // into the cube, in its own space: the ray bends at the face
  vec3 rd = normalize(vIceP - vIceCam);
  vec3 ri = refract(rd, normalize(vIceN), 1.0 / 1.31);
  if (dot(ri, ri) < 0.01) ri = rd;
  ri = normalize(ri + 1e-4);
  float tx = max(iceBoxExit(vIceP, ri, vec3(0.5)), 0.0);
  // the frosty core, and the feathers running from it toward the corners: looked up once, where the ray passes
  // nearest the middle (it was marched through in steps; the look is the same at a fraction of the cost)
  vec3 q0 = vIceP + ri * clamp(-dot(vIceP, ri), 0.0, tx);
  float cd = iceSdBox(q0, vec3(0.08, 0.11, 0.08)) + (iceNoise(q0 * 6.0 + vIceSeed * 13.0) - 0.5) * 0.16;
  float fea = smoothstep(0.64, 0.9, iceNoise(normalize(q0 + 1e-3) * 7.0 + vIceSeed * 5.0)) * smoothstep(0.34, 0.06, length(q0));
  float core = clamp(smoothstep(0.1, -0.05, cd) * 0.85 + fea * 0.45, 0.0, 1.0) * 0.4 * smoothstep(0.0, 0.4, tx);
  // cracks: flat breaks across the cube, bright when you look along them (ragged edge and streaks from sines: no noise)
  float crack = 0.0;
  for (int i = 0; i < 2; i++) {
    vec3 h = iceHash3(vIceSeed * 7.0 + float(i) * 3.1);
    if (h.z < 0.35) continue;
    vec3 h2 = iceHash3(vIceSeed * 5.0 + float(i) * 11.3);
    vec3 n = normalize(h - 0.5 + 1e-3);
    vec3 c = (h2 - 0.5) * 0.4;
    float dn = dot(ri, n);
    float t = dot(c - vIceP, n) / (abs(dn) < 1e-4 ? 1e-4 : dn);
    if (t > 0.0 && t < tx) {
      vec3 q = vIceP + ri * t;
      float rag = sin(q.x * 23.0 + q.y * 7.0) * sin(q.z * 19.0 - q.y * 11.0) * 0.06;
      float m = smoothstep(0.2 + h2.x * 0.12, 0.08, length(q - c) + rag);
      float lines = 0.55 + 0.45 * sin(dot(q, h * 70.0));
      crack += m * lines * (0.2 + 0.8 * pow(1.0 - abs(dn), 3.0));
    }
  }
  // air trapped as it froze: small bubbles, most of them near the middle; a bright ring, a clear eye
  float bub = 0.0;
  for (int i = 0; i < ${bubbles}; i++) {
    vec3 h = iceHash3(vIceSeed * 3.7 + float(i) * 1.618);
    vec3 c = (h - 0.5) * vec3(0.62, 0.7, 0.62) * (0.35 + 0.65 * fract(h.x * 7.3));
    float r = 0.008 + 0.03 * h.z * h.z;
    vec3 oc = vIceP - c;
    float b = dot(oc, ri);
    float disc = b * b - dot(oc, oc) + r * r;
    if (disc > 0.0) {
      float t = -b - sqrt(disc);
      if (t > 0.0 && t < tx) {
        float k = sqrt(disc) / r; // 1 through the middle of the bubble, 0 at its edge
        bub += pow(1.0 - k, 2.0) * 1.2 + smoothstep(0.93, 1.0, k) * 0.25;
      }
    }
  }
  vec3 frost = vec3(0.94, 0.96, 0.98) * (0.72 + 0.28 * normalize(vIceN).y);
  // follow the ray on through the cube: out of the far face, or, past the critical angle, mirrored off it (up to
  // twice). Only where it comes out heading the way it went in do you see what's behind; everywhere else the cube
  // shows the room from some other direction. That's the prism look of real ice: sharp dark and bright patches.
  vec3 p = vIceP;
  vec3 d = ri;
  vec3 dOut = d;
  float hops = 0.0;
  for (int k = 0; k < 3; k++) {
    p += d * max(iceBoxExit(p, d, vec3(0.5)), 0.0);
    vec3 a = abs(p);
    vec3 fn = a.x > a.y && a.x > a.z ? vec3(sign(p.x), 0.0, 0.0) : a.y > a.z ? vec3(0.0, sign(p.y), 0.0) : vec3(0.0, 0.0, sign(p.z));
    fn = normalize(fn + sin(p.yzx * 9.0 + vIceSeed * vec3(1.3, 2.1, 3.7)) * 0.13); // melted faces aren't flat
    vec3 o = refract(d, -fn, 1.31);
    dOut = d;
    if (dot(o, o) > 0.01) { dOut = o; break; }
    d = reflect(d, fn);
    p -= fn * 1e-3;
    hops += 1.0;
  }
  mat3 toWorld = mat3(vIceM0, vIceM1, vIceM2);
  vec3 dW = normalize(toWorld * dOut);
  float through = smoothstep(0.9, 0.99, dot(dW, normalize(toWorld * rd))) * (hops > 0.5 ? 0.35 : 1.0);
  through *= smoothstep(0.03, 0.25, facing); // (and never at a glancing edge)
  vec3 dV = normalize((viewMatrix * vec4(dW, 0.0)).xyz);
  ${
    surround
      ? 'vec3 room = mix(uIceBelow, uIceAbove, smoothstep(-0.6, 0.8, dW.y));'
      : studioRoom
        ? 'vec3 room = texture2D(uIceStudio, equirectUv(dW)).rgb * 1.25;'
        : `#ifdef USE_ENVMAP
    vec3 room = getIBLRadiance(dV, dV, 0.03 + 0.15 * iceFrost);
  #else
    vec3 room = vec3(0.4);
  #endif`
  }
  ${under ? 'room = mix(room, uIceUnder, 0.6 * smoothstep(0.05, -0.35, dW.y));' : ''}
  // the softened edges: light runs along them, as it does round every real cube
  vec3 on = abs(normalize(vIceN));
  float bevel = smoothstep(0.93, 0.75, max(on.x, max(on.y, on.z)));
  ${
    refract
      ? `outgoingLight = mix(outgoingLight, room + totalSpecular, 1.0 - through);
  outgoingLight = mix(outgoingLight, frost, 0.07); // (ice is never quite as clear as glass)
  outgoingLight += frost * bevel * 0.35;
  outgoingLight = mix(outgoingLight, frost, core) + frost * (crack * 0.45 + bub * 0.5);`
      : `outgoingLight = totalSpecular + room * (1.0 - through) + frost * (core + crack * 0.45 + bub * 0.5 + 0.07 + bevel * 0.35);
  diffuseColor.a = clamp(1.0 - through * (1.0 - core) * 0.93 + bub * 0.2 + bevel * 0.2, 0.0, 1.0);`
  }
}
#include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => `ice-${refract ? 'r' : 'l'}-${surround ? 's' : ''}${under ? 'u' : ''}${studioRoom ? 't' : ''}`
  return m
}

// What the ice mirrors outside: a product studio of its own, a warm grey room with a dark band at the horizon and
// crisp bright softboxes, the cream counter below. (The page's own light is soft all round, which made the cubes
// look like white plastic.) Drawn once, as an equirectangular canvas.
function studio() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const g = canvas.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, '#b3a797')
  sky.addColorStop(0.36, '#6e6258')
  sky.addColorStop(0.49, '#3a302a')
  sky.addColorStop(0.55, '#51453c')
  sky.addColorStop(0.72, '#d4c6b2')
  sky.addColorStop(1, '#f1e7d8')
  g.fillStyle = sky
  g.fillRect(0, 0, 512, 256)
  const box = (x: number, y: number, w: number, h: number, a = 1) => {
    g.fillStyle = `rgba(255, 246, 232, ${a * 0.35})`
    g.fillRect(x - 4, y - 4, w + 8, h + 8)
    g.fillStyle = `rgba(255, 252, 245, ${a})`
    g.fillRect(x, y, w, h)
  }
  box(40, 38, 110, 58) // key, upper left
  box(180, 12, 190, 14, 0.9) // strip overhead
  box(412, 44, 34, 92, 0.85) // tall strip, right
  box(262, 70, 26, 44, 0.7) // a small one behind
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.generateMipmaps = false // (no seam where the picture wraps round)
  tex.minFilter = LinearFilter
  return tex
}

// A cube as it comes out of the machine: square with softened edges, a little wider one end, melted a touch out of
// true, the dimple pressed into one face. Three of them, so no two neighbours are the same (seed per vertex).
function cube(seed: number) {
  const g = new RoundedBoxGeometry(1, 1, 1, 8, 0.1)
  const pos = g.attributes.position
  const n = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i)
    const taper = 1 + n.y * 0.06
    n.x *= taper
    n.z *= taper
    n.z -= 0.045 * Math.exp(-(n.x * n.x + n.y * n.y) / 0.035) * Math.min(1, Math.max(0, (n.z - 0.38) / 0.08))
    const w = Math.sin(n.x * 4.3 + n.y * 2.1 + seed * 1.7) * Math.sin(n.z * 3.7 - n.y * 2.9 + seed) * 0.025 + Math.sin(n.y * 5.1 + n.x * 3.3 + seed * 2.3) * 0.012
    n.multiplyScalar(1 + w)
    pos.setXYZ(i, n.x, n.y, n.z)
  }
  g.computeVertexNormals()
  g.setAttribute('aIceSeed', new BufferAttribute(new Float32Array(pos.count).fill(seed), 1))
  return g
}

export function useIce(opts: Opts) {
  const { refract, thickness, studio: ownRoom, tint, under } = opts
  const [above, below] = opts.surround ?? []
  const geos = useMemo<BufferGeometry[]>(() => [cube(1.3), cube(2.9), cube(4.6)], [])
  const room = useMemo(() => (ownRoom === false ? null : studio()), [ownRoom])
  const mat = useMemo(
    () => makeMaterial({ refract, thickness, studio: ownRoom, tint, under, surround: above && below ? [above, below] : undefined }, room),
    [refract, thickness, ownRoom, tint, under, above, below, room],
  )
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose())
      mat.dispose()
      room?.dispose()
    },
    [geos, mat, room],
  )
  return { geos, mat }
}

// The cubes heaped in a cup's drink, in cup units (rim at 0.93): x, y, z, size, tilt. They cover the models' own
// baked ice, which doesn't hold up close.
export const HEAP: [number, number, number, number, number][] = [
  [0.01, 0.875, 0.02, 0.16, 0.3], [-0.16, 0.868, 0.1, 0.15, 1.1], [0.15, 0.87, 0.12, 0.15, 2.0], [0.1, 0.868, -0.16, 0.155, 0.7],
  [-0.13, 0.866, -0.15, 0.15, 2.6], [-0.02, 0.925, -0.03, 0.13, 1.6], [0.22, 0.87, -0.04, 0.12, 3.0], [-0.23, 0.868, -0.04, 0.12, 0.2],
  [0.0, 0.862, 0.25, 0.11, 0.9], [0.25, 0.862, 0.16, 0.1, 1.9], [-0.26, 0.862, 0.15, 0.1, 2.4], [0.2, 0.862, -0.22, 0.1, 0.5],
  [-0.22, 0.862, -0.22, 0.1, 1.4], [0.0, 0.862, -0.27, 0.11, 2.9], [0.09, 0.93, 0.13, 0.11, 0.1], [-0.1, 0.928, -0.12, 0.11, 2.2],
]
// where a cube of this size sits, kept in off the wall (the cup is 0.33 across the inside there)
export const inCup = (x: number, z: number, size: number): [number, number] => {
  const r = Math.hypot(x, z)
  const max = 0.322 - 0.62 * size
  return r > max ? [(x * max) / r, (z * max) / r] : [x, z]
}
export const heapRotation = (tilt: number, d = 0): [number, number, number] => [tilt * 0.5 + d * 1.5, tilt, tilt * 0.3 - d]
