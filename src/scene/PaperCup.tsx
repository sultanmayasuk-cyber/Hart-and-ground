import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { CircleGeometry, LatheGeometry, type MeshStandardMaterial, SRGBColorSpace, Vector2 } from 'three'
import CupPrint from './CupPrint'
import Steam from './Steam'

// The hot cup, built here rather than scanned: a double-wall paper takeaway cup with a flat white in it, drawn to the
// proportions of the printed cup in the photographs (brand/gen/hot-b.png). Unit height, base at y = 0, like the other
// cups. Four parts, each a surface of revolution:
//   foot    the white inner cup showing below the sleeve, y 0 → 0.105
//   sleeve  the burgundy paper, y 0.105 → 0.945, with a small rolled lip at its foot; the logo prints on it (CupPrint)
//   rim     the white inner cup showing above the sleeve, curling over in a thin rolled lip (a real cup's is ~2 mm,
//           not a bead) and running down inside to the coffee
//   coffee  the crema, a disc a centimetre below the rim, its rosetta cut from the photograph
// The paper's grain, the sleeve's soft edges and the rim's shadow are in the sleeve's shader, so nothing is baked.
export const SLEEVE_R = (y: number) => 0.238 + 0.0899 * y // the sleeve's outer radius at height y (CupPrint uses it)
const COFFEE_Y = 0.918
const BEAD = { r: 0.317, y: 0.987, t: 0.013 } // the rolled lip: a small circle in the profile

const PAPER = '#96435c' // the raspberry-wine of the printed cup, sampled from the photographs (lit ≈ #8e3a56, shade ≈ #5e2038)
const WHITE = '#f8f5f0'

const arc = (n: number, a0: number, a1: number, cx: number, cy: number, r: number) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return new Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))
  })

function useGeometry() {
  return useMemo(() => {
    const foot = new LatheGeometry([new Vector2(0, 0), new Vector2(0.221, 0), new Vector2(0.223, 0.004), new Vector2(0.236, 0.105), new Vector2(0.236, 0.12)], 128)
    // the sleeve: a rolled lip at the bottom, then straight up to tuck under the bead
    const sleeve = new LatheGeometry(
      [new Vector2(0.237, 0.098), new Vector2(0.245, 0.101), new Vector2(0.2495, 0.108), new Vector2(0.2495, 0.118), ...Array.from({ length: 12 }, (_, i) => {
        const y = 0.118 + ((0.935 - 0.118) * (i + 1)) / 12
        return new Vector2(SLEEVE_R(y), y)
      }), new Vector2(SLEEVE_R(0.945), 0.945), new Vector2(SLEEVE_R(0.945) - 0.004, 0.949)],
      128,
    )
    // the rim: up the outside under the bead, over the bead, down the inside to the coffee
    const rim = new LatheGeometry(
      [new Vector2(0.316, 0.93), new Vector2(0.3205, 0.974), ...arc(16, -0.2, Math.PI + 0.5, BEAD.r, BEAD.y, BEAD.t), new Vector2(0.302, 0.97), new Vector2(0.297, COFFEE_Y + 0.01), new Vector2(0.296, COFFEE_Y - 0.01)],
      128,
    )
    const coffee = new CircleGeometry(0.298, 96)
    coffee.rotateX(-Math.PI / 2)
    return { foot, sleeve, rim, coffee }
  }, [])
}

// the sleeve's paper: an embossed leather grain (in the shading normal as well as the colour), the wall darkening as
// it turns from the eye, the bead's shadow down its top and the crease at its foot
const sleeveShader = (m: MeshStandardMaterial) => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCupP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCupP = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vCupP;
float cupHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cupNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cupHash(i), cupHash(i + vec3(1, 0, 0)), f.x), mix(cupHash(i + vec3(0, 1, 0)), cupHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cupHash(i + vec3(0, 0, 1)), cupHash(i + vec3(1, 0, 1)), f.x), mix(cupHash(i + vec3(0, 1, 1)), cupHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// the embossed paper: broad soft cells with a fine tooth over them
float cupGrain(vec3 p) { return cupNoise(p * 70.0) * 0.5 + cupNoise(p * 190.0 + 3.0) * 0.3 + cupNoise(p * 600.0) * 0.2; }
vec3 cupBump(vec3 pos, vec3 n, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float cupG = cupGrain(vCupP);
diffuseColor.rgb *= 0.9 + 0.2 * cupG;
diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.9, 0.945, vCupP.y); // a touch of shade under the lip
diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - smoothstep(0.1, 0.15, vCupP.y)); // the crease at the foot`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor += (cupG - 0.5) * 0.16;')
      // the room's fill counts for less on the paper, so the window light shapes it: lit on one side, deep on the other
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.8;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = cupBump(-vViewPosition, normal, cupG * 0.0022);')
      .replace(
        '#include <opaque_fragment>',
        `float cupFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
outgoingLight *= 0.82 + 0.18 * smoothstep(0.0, 0.6, cupFacing); // matte paper falls off at its edges
#include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'paper-sleeve'
}

// the white paper: a little tooth, and the inside of the rim darkening down toward the coffee
const whiteShader = (m: MeshStandardMaterial) => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCupP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCupP = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCupP;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float inside = step(length(vCupP.xz), 0.309) * step(vCupP.y, 0.985);
diffuseColor.rgb *= 1.0 - 0.34 * inside * (1.0 - smoothstep(0.915, 0.985, vCupP.y));
diffuseColor.rgb *= 1.0 - 0.12 * (1.0 - smoothstep(0.095, 0.105, vCupP.y)) * step(vCupP.y, 0.11); // under the sleeve's lip`,
      )
  }
  m.customProgramCacheKey = () => 'paper-white'
}

useTexture.preload('/crema.jpg')

export default function PaperCup() {
  const geo = useGeometry()
  const crema = useTexture('/crema.jpg')
  crema.colorSpace = SRGBColorSpace
  crema.anisotropy = 8
  return (
    <group>
      <mesh geometry={geo.foot}>
        <meshStandardMaterial color={WHITE} roughness={0.62} onUpdate={whiteShader} />
      </mesh>
      <mesh geometry={geo.sleeve}>
        <meshStandardMaterial color={PAPER} roughness={0.56} envMapIntensity={0.75} onUpdate={sleeveShader} />
      </mesh>
      <mesh geometry={geo.rim}>
        <meshStandardMaterial color={WHITE} roughness={0.62} onUpdate={whiteShader} />
      </mesh>
      <mesh geometry={geo.coffee} position-y={COFFEE_Y}>
        <meshStandardMaterial map={crema} roughness={0.3} envMapIntensity={0.7} />
      </mesh>
      <CupPrint kind="hot" />
      <Steam />
    </group>
  )
}
