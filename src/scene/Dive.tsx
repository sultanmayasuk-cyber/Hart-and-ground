import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Group,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import CupPrint from './CupPrint'
import { finishCup } from './cupFinish'
import { PHONE } from '../env'
import { QUOTES } from '../quotes'
import { DRACO } from './cups'
import { damp, pointer } from './pointer'
import { PointerRig } from './rigs'
import { page } from './scroll'

useGLTF.preload('/models/coffee.glb', DRACO)

// The hero: one iced latte on the cream counter, the name behind it with the cup standing in for the ampersand.
// Scrolling (page.dive, 0..1) lifts the camera over the rim and down through the ice into the drink: past the cubes
// near the top, through espresso clouding into milk, down to the base, where the light through the bottom of the cup
// turns into the cream of the page below.
//   0    .. 0.3   outside: the camera rises and tips over the cup (the cup turns to show its back line on the way)
//   0.24 .. 0.37  the surface breaks: a splash of foam hides the cut from the cup to the drink's inside
//   0.3  .. 0.86  inside: ice, bubbles, espresso billowing into milk, coffee falling through the milk below
//   0.86 .. 0.95  the base glows up into the page's cream
const S = 2 // the cup: unit model scaled to 2 units tall, base on the counter at y = 0
const O = new Vector3(0, -60, 0) // where the inside of the drink is built (its surface; the base is 24 below)
const DEPTH = 24
const CUT = 0.27 // the camera jumps from outside to inside here, as the coffee covers the lens
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)
const ramp = (x: number, a: number, b: number) => smooth(clamp01((x - a) / (b - a)))

// progress, damped a little more than Lenis already does, so the camera carries weight
const state = { p: 0, ready: false, born: 0, warm: 0 } // born: clock time when everything was ready and the entrance began
const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
// dev: ?snap puts the camera exactly where the page is (no easing), for checking frames one by one
const SNAP = import.meta.env.DEV && new URLSearchParams(location.search).has('snap')
if (SNAP) Object.assign(window, { __dive: state })

type Key = { p: number; pos: [number, number, number]; tgt: [number, number, number]; fov: number }
// Outside: the cup stands in the middle, the words either side of it, ice adrift around it. One move: the camera lifts
// in an arc over the cup and drops straight into it. (It used to push in until the stag on the
// wall fills the screen, climbs the wall past the ribs, tips over the rim and drops onto the ice. The lens widens on
// the way, so the cup grows faster than the camera moves: that's what makes it a dive and not a zoom.
const OUTSIDE = (aspect: number): Key[] => {
  // back far enough that the floating ice and the words fit round the cup; on a phone held upright the cup fills the
  // width between the two halves of the headline instead
  const z0 = aspect < 0.8 ? 8.8 : Math.max(6.4, 9.6 / aspect)
  return [
    { p: 0, pos: [0, 1.4, z0], tgt: [0, 1.12, 0], fov: 30 },
    { p: 0.07, pos: [0, 2.7, z0 * 0.74], tgt: [0, 1.3, 0], fov: 33 },
    { p: 0.14, pos: [0, 4.3, 2.6], tgt: [0, 1.6, 0], fov: 40 },
    { p: 0.2, pos: [0, 4.4, 0.9], tgt: [0, 1.7, 0], fov: 50 },
    { p: CUT, pos: [0, 1.98, 0.04], tgt: [0, 0, -0.02], fov: 62 }, // down among the ice: the coffee rises over the lens
  ]
}
const INSIDE: Key[] = [
  { p: CUT, pos: [0, -0.2, 0], tgt: [0, -6, -0.4], fov: 62 },
  { p: 0.38, pos: [0.4, -1.6, 2.2], tgt: [-0.3, -2.8, -6], fov: 52 },
  { p: 0.52, pos: [-0.3, -5.5, 1.6], tgt: [0.3, -7.8, -6], fov: 50 },
  { p: 0.66, pos: [0.3, -11, 0.8], tgt: [0, -14.5, -6], fov: 50 },
  { p: 0.8, pos: [0, -17, 0.4], tgt: [0, -23, -3], fov: 50 },
  { p: 0.93, pos: [0, -23.3, 0], tgt: [0, -30, -0.2], fov: 50 },
  { p: 1, pos: [0, -23.4, 0], tgt: [0, -30, -0.2], fov: 50 },
]
function path(keys: Key[], origin = new Vector3()) {
  const pos = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.pos).add(origin)), false, 'centripetal')
  const tgt = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.tgt).add(origin)), false, 'centripetal')
  // p → curve parameter, so each key is reached at its own p
  const u = (p: number) => {
    let i = 0
    while (i < keys.length - 2 && p > keys[i + 1].p) i++
    const a = keys[i]
    const b = keys[i + 1]
    return (i + clamp01((p - a.p) / (b.p - a.p))) / (keys.length - 1)
  }
  const fov = (p: number) => {
    let i = 0
    while (i < keys.length - 2 && p > keys[i + 1].p) i++
    return keys[i].fov + (keys[i + 1].fov - keys[i].fov) * clamp01((p - keys[i].p) / (keys[i + 1].p - keys[i].p))
  }
  return { pos, tgt, u, fov }
}
const inside = path(INSIDE, O)
let outside = { aspect: 1.6, leg: path(OUTSIDE(1.6)) }
const outsideFor = (aspect: number) => {
  if (Math.abs(outside.aspect - aspect) > 1e-3) outside = { aspect, leg: path(OUTSIDE(aspect)) }
  return outside.leg
}

// the canvas's pixel ratio is a prop of <Canvas> (set from here through this): set any other way, the next resize
// (a phone's toolbar sliding away is one) puts it back
const res = { set: (_: number) => {} }
const v = new Vector3()
function Rig() {
  const { camera } = useThree()
  const soft = useRef(false)
  const slow = useRef(1 / 60) // running average frame time
  const frames = useRef(0)
  const quality = useRef(1)
  const lines = useRef<HTMLElement | null>(null)
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    state.p = SNAP ? page.dive : damp(state.p, page.dive, 3.2, dt)
    // the first few frames are drawn from inside the drink, behind the cream veil: that compiles and uploads everything
    // the dive needs (the ice's refraction pass too), so breaking the surface later can't hitch
    const warming = state.warm < 4
    if (warming) state.warm++
    const p = warming ? 0.5 : state.p
    // sharp outside; inside the drink everything is soft, so it's drawn at one pixel per point (less than half the work)
    const inside_ = p >= CUT - 0.03
    // and it watches itself: if frames run long (an older phone, a busy laptop) it draws fewer pixels, step by step,
    // until they don't. Smooth comes before sharp. It never steps back up (that would only oscillate).
    // (not while things are still loading and landing: those hitches aren't the device's steady pace)
    if (state.ready && st.clock.elapsedTime - state.born > 4 && rawDt < 0.1) {
      slow.current = slow.current * 0.97 + rawDt * 0.03
      if (++frames.current > 90 && slow.current > 1 / 40 && quality.current > 0.7) {
        quality.current *= 0.85
        slow.current = 1 / 60
        frames.current = 0
        soft.current = !inside_ // (forces the size to be set again, below)
      }
    }
    if (inside_ !== soft.current) {
      soft.current = inside_
      res.set((inside_ ? (PHONE ? 0.7 : 1) : Math.min(devicePixelRatio, PHONE ? 1.6 : 1.5)) * quality.current)
    }
    // phones: the cup lines are page text; they ride the same eased progress as the camera, written every frame
    // (scroll events on iOS arrive in bursts, which is what made them jerk)
    if (PHONE) {
      lines.current ??= document.querySelector<HTMLElement>('.dive-quotes')
      lines.current?.style.setProperty('--p', state.p.toFixed(4))
    }
    const t = st.clock.elapsedTime
    const cam = camera as PerspectiveCamera
    const aspect = st.size.width / st.size.height
    const leg = p < CUT ? outsideFor(aspect) : inside
    const u = leg.u(p)
    leg.pos.getPoint(u, cam.position)
    leg.tgt.getPoint(u, v)
    if (p < CUT) {
      const free = 1 - ramp(p, 0.06, 0.15) // the cursor's parallax eases off as the camera closes in
      cam.position.x += pointer.sx * 0.3 * free
      cam.position.y += pointer.sy * 0.14 * free
    } else {
      // drifting in the drink, even when the page is still
      cam.position.x += Math.sin(t * 0.23) * 0.18
      cam.position.z += Math.cos(t * 0.19) * 0.12
      v.x += pointer.sx * 1.2
      v.y += pointer.sy * 0.8
    }
    cam.lookAt(v)
    const fov = leg.fov(p)
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}

// ---------- outside ----------

function Cup() {
  const gltf = useGLTF('/models/coffee.glb', DRACO)
  // its own copy: the menu's canvas (Landing.tsx) shows the same model, and an object can only live in one scene
  const scene = useMemo(() => {
    const c = gltf.scene.clone(true)
    c.traverse((o) => {
      if (o instanceof Mesh) o.material = (o.material as MeshStandardMaterial).clone()
    })
    return c
  }, [gltf])
  const g = useRef<Group>(null)
  const yaw = useRef(0)
  const drop = useRef({ y: 1.1, v: 0 }) // the entrance: the cup is set down on the counter
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material as MeshStandardMaterial
        m.envMapIntensity = 1.3
        m.roughness = Math.min(m.roughness, 0.55)
        finishCup(m, 'coffee')
      }
    })
  }, [scene])
  useFrame((st, rawDt) => {
    const o = g.current
    if (!o) return
    const dt = Math.min(rawDt, 1 / 30)
    // set down on a critically damped spring: it arrives with weight and doesn't bounce
    const d = drop.current
    if (state.ready && !STILL) {
      d.v += (-40 * d.y - 2 * Math.sqrt(40) * d.v) * dt
      d.y += d.v * dt
    } else if (STILL) d.y = 0
    // it stands turned a little away, and squares up to the camera as the camera comes in
    const target = 0.3 * (1 - ramp(state.p, 0.01, 0.12)) + pointer.sx * 0.3 * (1 - ramp(state.p, 0.06, 0.15)) + Math.sin(st.clock.elapsedTime * 0.4) * 0.04
    yaw.current = damp(yaw.current, target, 3, dt)
    o.position.y = d.y
    o.rotation.set(-d.v * 0.04, yaw.current, d.y * 0.05)
    o.scale.setScalar(state.ready ? S : 1e-4) // (hidden by scale, not .visible, so the warm-up still compiles it)
  })
  return (
    <group ref={g} scale={S}>
      <primitive object={scene} />
      <CupPrint />
      <Heap />
    </group>
  )
}

// The counter's wall: the page's cream with a warm pool of light behind the cup. Drawn in the scene (not by the page)
// so the clear ice has something to refract.
function Backdrop() {
  const { size } = useThree()
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: { uAspect: { value: 1 }, uAt: { value: 0.72 }, uCream: { value: new Color('#f3ebe1') }, uWarm: { value: new Color('#fdf4e6') } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 1.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uAspect, uAt; uniform vec3 uCream, uWarm; varying vec2 vUv;
          void main() {
            vec2 q = (vUv - vec2(uAt, 0.55)) * vec2(uAspect, 1.0);
            gl_FragColor = vec4(mix(uWarm, uCream, smoothstep(0.0, 0.62, length(q))), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    mat.uniforms.uAspect.value = size.width / size.height
    mat.uniforms.uAt.value = 0.5
  })
  return (
    <mesh material={mat} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry />
    </mesh>
  )
}

// ---------- inside ----------

const NOISE = /* glsl */ `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }`

// The drink itself, drawn on a sphere around the camera: for each view ray, the far colour (the lit surface overhead,
// or the depths), then five shells of milk/espresso cloud from far to near, so the clouds have parallax as you sink.
function Drink() {
  const mesh = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uCam: { value: new Vector3() },
          uTime: { value: 0 },
          uCrema: { value: new Color('#b8722f') },
          uCaramel: { value: new Color('#b27440') },
          uEspresso: { value: new Color('#2a1207') },
          uMilk: { value: new Color('#f5e6cf') },
          uCream: { value: new Color('#f3ebe1') },
          uSurface: { value: new Color('#fff0d8') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          #define SHELLS ${PHONE ? 1 : 3}
          uniform vec3 uCam, uCrema, uCaramel, uEspresso, uMilk, uCream, uSurface;
          uniform float uTime;
          varying vec3 vWorld;
          ${NOISE}
          // y: height from the surface (0) down to the base (-${DEPTH}.)
          // the drink at a point: espresso above, milk below, and between them the two billowing into each other
          float billow(vec3 p) {
            vec3 q = p * 0.3 + vec3(0.0, uTime * 0.04, 0.0); // round, cloud-like billows, slowly sinking
            float w = vnoise(q + vec3(0.0, 0.0, uTime * 0.03));
            return fbm(q + 1.8 * vec3(w, 1.0 - w, w * w));
          }
          vec3 drink(vec3 p) {
            float s = clamp(-p.y / ${DEPTH}.0, 0.0, 1.0);
            float m = smoothstep(-0.2, 0.2, (s - 0.44) * 1.8 + (billow(p) - 0.5) * 1.6); // how much milk is here
            // coffee falling through the milk: long threads, only down in the milk
            vec3 fp = p * vec3(0.55, 0.09, 0.55) + vec3(0.0, uTime * 0.12, 0.0);
            float fall = smoothstep(0.6, 0.72, vnoise(fp) * 0.65 + vnoise(fp * 2.1 + 3.7) * 0.35);
            m = min(m, 1.0 - 0.65 * fall * smoothstep(0.45, 0.7, s) * (1.0 - smoothstep(0.86, 0.97, s)));
            // espresso glows amber just under the surface; where it meets the milk it turns caramel, never grey
            vec3 esp = mix(uCrema, uEspresso, smoothstep(0.0, 0.2, s));
            vec3 wht = mix(uMilk, uCream, smoothstep(0.82, 1.0, s));
            vec3 c = mix(esp, uCaramel, smoothstep(0.0, 0.5, m));
            c = mix(c, wht, smoothstep(0.5, 1.0, m));
            float light = 1.0 + 0.6 * exp(-s * 6.0); // brightest just under the surface
            return c * light;
          }
          void main() {
            vec3 dir = normalize(vWorld - cameraPosition);
            vec3 ro = uCam;
            vec3 far = ro + dir * 20.0;
            far.y = clamp(far.y, -${DEPTH}.0, 0.0);
            vec3 col = drink(far);
            if (dir.y > 0.0) { // the surface overhead, lit, rippling
              float t = -ro.y / dir.y;
              vec3 h = ro + dir * t;
              float rip = vnoise(vec3(h.xz * 0.8, uTime * 0.45)) * 0.6 + vnoise(vec3(h.xz * 2.1, uTime * 0.7)) * 0.4;
              float seen = smoothstep(0.08, 0.45, dir.y) * exp(-t * 0.05);
              col = mix(col, uSurface * (0.7 + 0.5 * rip), seen);
            }
            // shells from far to near: each one veils what's behind it, so the billows have depth and parallax
            for (int i = 0; i < SHELLS; i++) {
              vec3 p = ro + dir * (2.2 * pow(2.3, float(2 - i)));
              if (p.y > 0.0 || p.y < -${DEPTH}.0) continue;
              col = mix(col, drink(p), 0.5);
              float rays = pow(vnoise(vec3(p.xz * 0.45, uTime * 0.05)), 4.0) * exp(p.y * 0.3);
              col += uSurface * rays * 0.3;
            }
            // light scattering down through the coffee: a warm glow toward the surface
            col += uCrema * pow(max(dir.y, 0.0), 1.5) * 0.45 * exp(ro.y * 0.18);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((st) => {
    mesh.current?.position.copy(st.camera.position).sub(O) // (the mesh lives in the drink's group, which sits at O)
    mat.uniforms.uCam.value.copy(st.camera.position).sub(O)
    mat.uniforms.uTime.value = st.clock.elapsedTime
  })
  return (
    <mesh ref={mesh} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[30, 48, 32]} />
    </mesh>
  )
}

// Ice floating near the top: rounded, a little melted out of true, clear (it refracts the drink behind it) with a
// cloudy core like real cubes from a tray.
const CUBES_ALL: [number, number, number, number][] = [
  [-1.6, -0.7, -1.3, 1.2],
  [1.5, -0.5, -2.1, 1.1],
  [0.3, -1.4, -3.4, 1.3],
  [-2.7, -1.7, -3.5, 1.15],
  [2.6, -2.0, -0.9, 1.0],
  [-1.0, -2.8, -1.9, 0.95],
  [1.3, -3.0, -4.7, 1.2],
  [-3.1, -0.8, 0.7, 1.1],
  [3.0, -0.9, 1.9, 1.05],
  [-0.4, -0.45, 1.6, 0.9],
]
const CUBES = PHONE ? CUBES_ALL.slice(0, 5) : CUBES_ALL // (a phone blends every see-through layer the hard way: fewer of them)
function useIce() {
  const geo = useMemo(() => {
    const g = new RoundedBoxGeometry(1, 1, 1, 8, 0.24)
    const pos = g.attributes.position
    const n = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i)
      const w = Math.sin(n.x * 7.1 + n.y * 3.3) * Math.sin(n.z * 5.7 - n.y * 4.1) * 0.09 + Math.sin(n.x * 2.3 - n.z * 3.1) * 0.07 + Math.sin(n.y * 9.0 + n.x * 5.0) * 0.025 - n.y * 0.07 // melted out of true, rounder underneath
      n.multiplyScalar(1 + w)
      pos.setXYZ(i, n.x, n.y, n.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(
    () =>
      (() => {
        // on a phone: no refraction (it costs a second render of the whole scene every frame); clear glass with
        // reflections and bright edges reads as ice at that size
        const m = new MeshPhysicalMaterial({
          ...(PHONE ? { transparent: true, opacity: 0.24, depthWrite: false } : {}),
          transmission: PHONE ? 0 : 1,
          thickness: 1.6,
          roughness: 0.0,
          clearcoat: PHONE ? 0 : 1,
          ior: 1.31,
          color: '#ffffff',
          attenuationColor: new Color('#fbf6ef'),
          attenuationDistance: 24,
          specularIntensity: 1,
          envMapIntensity: 2.6,
        })
        // bright edges: the faces seen side-on catch the light from the surface overhead
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `float iceRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
outgoingLight += vec3(1.0, 0.98, 0.94) * iceRim * 0.5;
#include <opaque_fragment>`,
          )
        }
        return m
      })(),
    [],
  )
  const core = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: new Color('#fff6ea') } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          ${NOISE}
          void main() {
            float face = abs(dot(normalize(vN), normalize(vV)));
            float a = pow(face, 2.0) * smoothstep(0.3, 0.75, fbm(vP * 3.5)) * 0.5; // thickest where you look through the middle
            gl_FragColor = vec4(uColor * a, a);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      core.dispose()
    },
    [geo, mat, core],
  )
  return { geo, mat, core }
}

function Ice() {
  const { geo, mat, core } = useIce()
  const group = useRef<Group>(null)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    group.current?.children.forEach((c, i) => {
      const [x, y, z] = CUBES[i]
      c.position.set(x, y + Math.sin(t * 0.5 + i * 1.7) * 0.07, z)
      c.rotation.set(0.3 * i + Math.sin(t * 0.21 + i) * 0.12, 0.7 * i + t * 0.03 * (i % 2 ? 1 : -1), 0.2 * i)
    })
  })
  return (
    <group ref={group}>
      {CUBES.map(([, , , s], i) => (
        <group key={i} scale={[s, s * 0.92, s * 1.04]}>
          <mesh geometry={geo} material={mat} />
          {!PHONE && <mesh geometry={geo} material={core} scale={0.62} renderOrder={2} />}
        </group>
      ))}
    </group>
  )
}

// The ice you see from outside: real clear cubes heaped on the drink (they cover the model's own baked ice, which
// doesn't hold up close). On arrival they drop in one after another. x, y, z in cup units (rim at 0.93), size, tilt.
const HEAP_ALL: [number, number, number, number, number][] = [
  [0.01, 0.875, 0.02, 0.16, 0.3], [-0.16, 0.868, 0.1, 0.15, 1.1], [0.15, 0.87, 0.12, 0.15, 2.0], [0.1, 0.868, -0.16, 0.155, 0.7],
  [-0.13, 0.866, -0.15, 0.15, 2.6], [-0.02, 0.925, -0.03, 0.13, 1.6], [0.22, 0.87, -0.04, 0.12, 3.0], [-0.23, 0.868, -0.04, 0.12, 0.2],
  [0.0, 0.862, 0.25, 0.11, 0.9], [0.25, 0.862, 0.16, 0.1, 1.9], [-0.26, 0.862, 0.15, 0.1, 2.4], [0.2, 0.862, -0.22, 0.1, 0.5],
  [-0.22, 0.862, -0.22, 0.1, 1.4], [0.0, 0.862, -0.27, 0.11, 2.9], [0.09, 0.93, 0.13, 0.11, 0.1], [-0.1, 0.928, -0.12, 0.11, 2.2],
]
const HEAP = PHONE ? HEAP_ALL.slice(0, 8) : HEAP_ALL
function Heap() {
  const { geo, mat: heavy, core } = useIce()
  // thinner than the ice inside: the camera ends up right among these, where heavy refraction smears into stripes
  const mat = useMemo(() => {
    const m = heavy.clone()
    m.onBeforeCompile = heavy.onBeforeCompile
    m.thickness = 0.35
    if (PHONE) m.opacity = 0.5
    return m
  }, [heavy])
  useEffect(() => () => mat.dispose(), [mat])
  const group = useRef<Group>(null)
  const drops = useRef(HEAP.map(() => ({ y: 1.6, v: 0 })))
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const age = st.clock.elapsedTime - state.born
    group.current?.children.forEach((c, i) => {
      const [x, y, z, , tilt] = HEAP[i]
      const d = drops.current[i]
      if (STILL) d.y = 0
      else if (state.ready && age > 0.55 + i * 0.07) {
        d.v += (-70 * d.y - 2 * Math.sqrt(70) * 0.8 * d.v) * dt // a touch under-damped: it lands, and settles once
        d.y += d.v * dt
      }
      c.visible = state.ready && (STILL || age > 0.55 + i * 0.07)
      c.position.set(x, y + d.y, z)
      c.rotation.set(tilt * 0.5 + d.y * 1.5, tilt, tilt * 0.3 - d.y)
    })
  })
  return (
    <group ref={group}>
      {HEAP.map(([, , , s], i) => (
        <group key={i} scale={s}>
          <mesh geometry={geo} material={mat} />
          {!PHONE && <mesh geometry={geo} material={core} scale={0.62} renderOrder={2} />}
        </group>
      ))}
    </group>
  )
}

// Ice adrift round the cup at the opening: slow, weightless, leaning away from the cursor. As the camera starts in,
// the cubes are drawn into the cup and gone. x, y, z (world), size.
const ADRIFT_ALL: [number, number, number, number][] = [
  [-2.5, 2.3, -0.6, 0.34], [2.3, 2.6, -1.0, 0.4], [-1.7, 0.6, 1.0, 0.26], [1.9, 0.9, 0.8, 0.3],
  [-3.3, 1.2, -1.6, 0.3], [3.2, 1.5, -1.4, 0.26], [0.9, 3.0, -0.8, 0.24], [-1.0, 2.9, 0.3, 0.2],
]
const ADRIFT = PHONE ? ADRIFT_ALL.slice(0, 5) : ADRIFT_ALL
function Adrift() {
  const { geo, mat: heavy, core } = useIce()
  const mat = useMemo(() => {
    const m = heavy.clone()
    // against the pale wall, clear ice shows by its edges going darker, not brighter
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float iceEdge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.0);
outgoingLight = outgoingLight * mix(1.0, 0.6, iceEdge) + totalSpecular * 1.5;
#include <opaque_fragment>`,
      )
    }
    m.customProgramCacheKey = () => 'ice-adrift'
    m.thickness = 0.25
    if (PHONE) m.opacity = 0.85
    m.envMapIntensity = 1.6
    m.attenuationColor = new Color('#ffffff')
    return m
  }, [heavy])
  useEffect(() => () => mat.dispose(), [mat])
  const group = useRef<Group>(null)
  useFrame((st) => {
    const t = st.clock.elapsedTime
    const age = t - state.born
    const gone = ramp(state.p, 0.004, 0.075)
    group.current?.children.forEach((c, i) => {
      const [x, y, z, s] = ADRIFT[i]
      const arrive = STILL ? 1 : smooth(clamp01((age - 0.3 - i * 0.08) / 1.6))
      const k = smooth(clamp01(gone * 1.4 - i * 0.05)) // each in its turn
      c.visible = state.ready && k < 0.999
      c.position.set(
        (x - pointer.sx * (0.12 + 0.05 * i)) * (1 - k),
        (y + Math.sin(t * 0.4 + i * 1.3) * 0.12 - pointer.sy * 0.08 + (1 - arrive) * 1.2) * (1 - k) + 2.1 * k,
        z * (1 - k),
      )
      c.rotation.set(t * 0.11 + i, t * 0.07 * (i % 2 ? 1 : -1) + i * 2, i)
      c.scale.setScalar(s * arrive * (1 - k))
    })
  })
  return (
    <group ref={group}>
      {ADRIFT.map((_, i) => (
        <group key={i}>
          <mesh geometry={geo} material={mat} />
          {!PHONE && <mesh geometry={geo} material={core} scale={0.62} renderOrder={2} />}
        </group>
      ))}
    </group>
  )
}

// Fine bubbles rising through the whole drink; the ones near the camera stream past as you sink.
const BUBBLES = PHONE ? 110 : 520
const lens = new Vector3()
const bubbles = Array.from({ length: BUBBLES }, () => {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * 5.5
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -Math.random() * DEPTH, v: 0.15 + Math.random() * 0.45, s: 0.012 + Math.random() ** 3 * 0.06, w: Math.random() * 6 }
})
function Bubbles() {
  const mesh = useRef<InstancedMesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: new Color('#fff4e4') } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main() {
            vec3 n = normalize(vN);
            float rim = pow(1.0 - abs(dot(n, normalize(vV))), 2.5);
            float glint = pow(max(dot(n, normalize(vec3(0.3, 1.0, 0.5))), 0.0), 36.0);
            float a = rim * 0.75 + glint * 1.4;
            gl_FragColor = vec4(uColor * a, a);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(() => {
    mesh.current?.instanceMatrix.setUsage(DynamicDrawUsage)
    return () => mat.dispose()
  }, [mat])
  const dummy = useMemo(() => new Object3D(), [])
  useFrame((st, rawDt) => {
    const m = mesh.current
    if (!m || !m.visible) return
    const dt = Math.min(rawDt, 1 / 30)
    const t = st.clock.elapsedTime
    lens.copy(st.camera.position).sub(O)
    bubbles.forEach((b, i) => {
      b.y += b.v * dt * (1 + 16 * (1 - ramp(state.p, CUT, CUT + 0.09)))
      if (b.y > -0.05) b.y -= DEPTH
      dummy.position.set(b.x + Math.sin(t * 1.3 + b.w) * 0.05, b.y, b.z + Math.cos(t * 1.1 + b.w) * 0.05)
      const k = b.s * smooth(clamp01((dummy.position.distanceTo(lens) - 0.4) / 0.8)) // none right at the lens, where they'd blur into blobs
      dummy.scale.set(k, k * 0.9, k)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, mat, BUBBLES]} frustumCulled={false} renderOrder={3}>
      <sphereGeometry args={[1, 12, 8]} />
    </instancedMesh>
  )
}

// The lines the café prints on its cups, afloat in the drink: each hangs at its own depth off to one side of the way
// down, swaying a little, and comes out of the murk as the camera sinks toward it. Cream in the coffee, plum in the milk.
const QUOTE_X = [-2.3, 2.5, -0.6, 2.9, -2.9, 0.9, -2.0, 2.6, -1.0, 2.2, -2.6, 0]
function quoteTexture(text: string, colour: string) {
  const canvas = document.createElement('canvas')
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  const draw = () => {
    const g = canvas.getContext('2d')!
    const font = '500 84px Cinzel, "Times New Roman", serif'
    g.font = font
    canvas.width = Math.ceil(g.measureText(text).width + 60)
    canvas.height = 130
    g.font = font // (resizing the canvas resets the context)
    g.fillStyle = colour
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, canvas.width / 2, 70)
    tex.needsUpdate = true
  }
  draw()
  document.fonts.load('500 84px Cinzel').then(draw, () => {})
  return tex
}
function Quotes() {
  const group = useRef<Group>(null)
  const items = useMemo(
    () =>
      QUOTES.map((q, i) => {
        const y = -3.2 - i * 1.62
        const tex = quoteTexture(q, -y / DEPTH > 0.6 ? '#3a1730' : '#f6ecdf')
        return { tex, pos: new Vector3(QUOTE_X[i], y, -5.6 - (i % 3) * 1.3), i }
      }),
    [],
  )
  useEffect(() => () => items.forEach((q) => q.tex.dispose()), [items])
  useFrame((st) => {
    const t = st.clock.elapsedTime
    lens.copy(st.camera.position).sub(O)
    // on a phone held upright the lines come down the middle, smaller, so none runs off the side
    const aspect = st.size.width / st.size.height
    const fit = Math.min(1, aspect * 0.95)
    const side = aspect < 0.8 ? 0.12 : 1
    group.current?.children.forEach((c, n) => {
      const q = items[n]
      c.position.set(q.pos.x * side + Math.sin(t * 0.23 + n * 1.9) * 0.18 * fit, q.pos.y + Math.sin(t * 0.31 + n) * 0.12, q.pos.z)
      c.quaternion.copy(st.camera.quaternion)
      c.rotateZ(Math.sin(t * 0.19 + n * 2.3) * 0.035)
      // out of the murk as it nears, gone again as the camera sinks past it
      const dy = lens.y - q.pos.y // how far above it the camera is
      const a = smooth(clamp01((5.2 - dy) / 2.2)) * smooth(clamp01((dy + 0.6) / 1.6))
      const m = (c as Mesh).material as MeshBasicMaterial
      m.opacity = a * 0.92
      c.visible = a > 0.01
      const w = ((2.6 * q.tex.image.width) / 700) * fit
      c.scale.set(w, (w * q.tex.image.height) / q.tex.image.width, 1)
    })
  })
  return (
    <group ref={group}>
      {items.map((q) => (
        <mesh key={q.i} renderOrder={4}>
          <planeGeometry />
          <meshBasicMaterial map={q.tex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- the cut and the way out ----------

// A screen-sized veil drawn over everything: the foam as the camera breaks the surface, then the cream at the end.
function Veil() {
  const { size } = useThree()
  const veil = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uFoam: { value: 0 },
          uVeil: { value: 0 },
          uOut: { value: 0 },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uLatte: { value: new Color('#a9662c') }, // the coffee just under the surface

          uCream: { value: new Color('#f3ebe1') },
        },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uFoam, uVeil, uOut, uTime, uAspect;
          uniform vec3 uLatte, uCream;
          varying vec2 vUv;
          ${NOISE}
          void main() {
            vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
            float r = length(q);
            // going under: the surface of the coffee climbs the lens, a bright wobbling meniscus with the dark drink below it
            float L = mix(-0.75, 0.75, uFoam) + 0.035 * sin(q.x * 5.0 + uTime * 2.6) + 0.018 * sin(q.x * 13.0 - uTime * 4.1) + 0.05 * (vnoise(vec3(q.x * 2.0, uTime * 0.8, 3.0)) - 0.5);
            float under = smoothstep(L + 0.006, L - 0.006, q.y);
            float depth = clamp((L - q.y) * 1.4, 0.0, 1.0);
            vec3 drink = mix(uLatte * 1.55, uLatte * 0.8, depth);
            drink *= 0.85 + 0.3 * vnoise(vec3(q * 2.2 + vec2(0.0, -uTime * 0.5), uTime * 0.3)); // the drink isn't flat: slow cloud in it
            drink += vec3(1.0, 0.93, 0.8) * (exp(-abs(q.y - L) * 70.0) * 0.9 + exp(-abs(q.y - L + 0.035) * 120.0) * 0.25); // light caught along the waterline
            float foamA = under * uVeil;
            // out: the glow through the cup's base opens from the middle into the page
            float ro = r + (vnoise(vec3(q * 2.5, uTime * 0.2)) - 0.5) * 0.3;
            float outA = smoothstep(ro - 0.4, ro, uOut * 1.9 - 0.2) * smoothstep(0.0, 0.03, uOut);
            vec3 col = mix(drink, uCream, outA);
            gl_FragColor = vec4(col, max(foamA, outA));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((st) => {
    const p = state.p
    mat.uniforms.uFoam.value = clamp01((p - (CUT - 0.045)) / 0.04) // the surface climbs the lens over the last stretch down
    mat.uniforms.uVeil.value = p < CUT - 0.05 ? 0 : 1 - ramp(p, CUT + 0.005, CUT + 0.05) // then it clears, and you're under
    mat.uniforms.uOut.value = !state.ready ? 1 : ramp(Math.max(p, page.dive), 0.9, 0.97) // never behind the page: the next section is cream
    mat.uniforms.uTime.value = st.clock.elapsedTime
    mat.uniforms.uAspect.value = size.width / size.height
    // (a full-screen pass: skipped whenever it would draw nothing)
    if (veil.current) veil.current.visible = mat.uniforms.uVeil.value > 0.001 || mat.uniforms.uOut.value > 0.001
  })
  return (
    <mesh ref={veil} material={mat} renderOrder={1000} frustumCulled={false}>
      <planeGeometry />
    </mesh>
  )
}

// Only the world the camera is in gets drawn (both, around the cut).
function Worlds() {
  const out = useRef<Group>(null)
  const inn = useRef<Group>(null)
  useFrame(() => {
    if (!state.ready) return
    if (out.current) out.current.visible = state.p < CUT + 0.02
    if (inn.current) inn.current.visible = state.p > CUT - 0.01 // (under full foam)
  })
  return (
    <>
      <group ref={out}>
        <Backdrop />
        <Cup />
        <Adrift />
        <ContactShadows frames={40} position={[0, 0.003, 0]} scale={9} blur={2.6} far={2.4} opacity={0.4} resolution={512} color="#3a1730" />
      </group>
      <group ref={inn} position={O}>
        <Drink />
        <Ice />
        <Bubbles />
        {!PHONE && <Quotes />}
        <pointLight position={[0, 1.5, 0]} intensity={40} distance={30} decay={1.4} color="#fff0d8" />
        <pointLight position={[0, -DEPTH - 2, 0]} intensity={25} distance={16} decay={1.4} color="#fff6ea" />
      </group>
    </>
  )
}

// Send every texture to the GPU and compile every shader with both worlds showing, then start.
function Warmup() {
  const { gl, scene, camera, clock } = useThree()
  useEffect(() => {
    let alive = true
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        for (const val of Object.values(mat)) if (val instanceof Texture) gl.initTexture(val)
    })
    Promise.race([gl.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 3000))]) // (never wait on the driver for ever)
      .catch(() => {})
      .finally(() => {
        if (!alive) return
        const t0 = performance.now()
        const go = () => {
          if (!alive) return
          if (state.warm < 4 && performance.now() - t0 < 1500) return void requestAnimationFrame(go)
          state.ready = true
          state.born = clock.elapsedTime
          window.dispatchEvent(new Event('hg-ready')) // (the page lifts its loader)
        }
        go()
      })
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  return null
}

// Frames only while there's something to draw: the whole time the dive is on screen, none once it's scrolled past
// (the drinks section's own canvas takes over from there).
function Pump() {
  const setFrameloop = useThree((st) => st.setFrameloop)
  useEffect(() => {
    // Runs every frame while the dive is on screen, not at all once it's scrolled past. (It used to ask for one frame
    // at a time from gsap's ticker; that raced the renderer's own loop and drew only every other frame: 30 a second.)
    let on: boolean | null = null
    const tick = () => {
      const want = page.dive < 0.999 || Math.abs(state.p - page.dive) > 1e-4
      if (want !== on) setFrameloop((on = want) ? 'always' : 'never')
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [setFrameloop])
  return null
}

export default function Dive() {
  const [dpr, setDpr] = useState(() => Math.min(devicePixelRatio, PHONE ? 1.6 : 1.5))
  useEffect(() => {
    res.set = setDpr
  }, [])
  return (
    <div className="absolute inset-0">
      <Canvas style={{ pointerEvents: 'none' }} frameloop="always" dpr={dpr} camera={{ position: [0, 1.4, 6.4], fov: 30, near: 0.03, far: 200 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: SNAP }} // (dev ?snap: lets a still be saved off the canvas)
        onCreated={({ gl }) => (gl.transmissionResolutionScale = 0.5)} // what the ice refracts is soft anyway: half the cost
      >
        <Pump />
        <PointerRig />
        <Rig />
        <directionalLight position={[-4, 5, 3]} intensity={2.0} color="#fff1dc" />
        <directionalLight position={[3, 2, 4]} intensity={0.7} color="#eef2ff" />
        <ambientLight intensity={0.8} />
        <Suspense fallback={null}>
          <Worlds />
          <Warmup />
        </Suspense>
        <Veil />
        <Environment resolution={256}>
          <Lightformer intensity={2.2} position={[0, 5, 0]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} color="#fff7ec" />
          <Lightformer intensity={1.8} color="#fff0d8" position={[-6, 2, 3]} scale={[1.5, 6, 1]} />
          <Lightformer intensity={1.2} color="#e8f0ff" position={[6, 1, 2]} scale={[1.5, 6, 1]} />
          <Lightformer intensity={0.8} color="#e9dccb" position={[0, -3, -4]} scale={[8, 2, 1]} />
        </Environment>
      </Canvas>
    </div>
  )
}
