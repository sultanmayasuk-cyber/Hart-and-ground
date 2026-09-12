import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Mesh, SRGBColorSpace, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import CupPrint from './CupPrint'
import { finishCup } from './cupFinish'
import { CAM_Z, HERO_FOV } from './cups'
import { damp, pointer } from './pointer'
import { CameraRig, PointerRig } from './rigs'
import { VIEW_H } from './scroll'

useGLTF.preload('/models/coffee.glb')
useGLTF.preload('/models/matcha.glb')

const FLOOR = -VIEW_H * 0.4 // the counter the cups stand on
const CAM_HEIGHT = 1.5 // camera raised a little, looking down into the cups (the ice shows)
const TEXT_Z = -0.8 // the headline stands just behind the resting cups
const TEXT_TOP = 0.4 // world height the headline's top stays at, just under the logo
const FLY_SCALE = 0.75 // cups ease a little smaller in the air, so the circle clears the ends of the word
const FIRST_LOOP = 4 // seconds after load before the cups first go round the headline
const EVERY = 13 // then they go round again this often
const LOOP = 7 // one unhurried circle, lift-off to landing
const SPRING = 16 // how tightly the cups follow their path (critically damped: weight, no wobble)
const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number) => clamp(x, 0, 1)
const smooth = (x: number) => x * x * (3 - 2 * x)
const lerp = (a: number, b: number, w: number) => a + (b - a) * w

// A faint reflection of each cup in the counter: a mirrored copy drawn see-through, fading out below the floor.
const REFLECT = 0.14
function asReflection(m: MeshStandardMaterial) {
  m.transparent = true
  m.opacity = REFLECT
  m.depthWrite = false
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vReflY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReflY = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vReflY;')
      .replace('#include <opaque_fragment>', `diffuseColor.a *= smoothstep(${(FLOOR - 0.45).toFixed(3)}, ${FLOOR.toFixed(3)}, vReflY);\n#include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => 'cup-reflection'
  return m
}

// Layout shared by the headline and the cups, recomputed every frame from the viewport.
const stage = { size: 1, X: 0.5, textW: 3, textH: 1.2, textY: 0, textAspect: 2.2 }
function Layout() {
  useFrame((state) => {
    const vw = (VIEW_H * state.size.width) / state.size.height
    // 0 on landscape screens, 1 on a phone held upright: there the word sits lower and wider, the cups a bit bigger,
    // so word and cups read as one group instead of a word up top and small cups far below
    const portrait = clamp01((1 - state.size.width / state.size.height) / 0.45)
    stage.size = Math.min(VIEW_H * 0.38, (vw * lerp(0.34, 0.42, portrait)) / 0.78)
    stage.X = stage.size * 0.62
    stage.textH = Math.min(VIEW_H * 0.58, (vw * lerp(0.84, 0.92, portrait)) / stage.textAspect)
    stage.textW = stage.textH * stage.textAspect
    stage.textY = lerp(TEXT_TOP, 0.05, portrait) - stage.textH / 2
  })
  return null
}

// "Coming soon" in Cinzel, as a plane in the scene, so the cups can pass behind the letters.
function Headline() {
  const mesh = useRef<Mesh>(null)
  const born = useRef(-1)
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas')
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    const draw = () => {
      const f = 460
      const g = canvas.getContext('2d')!
      g.font = `500 ${f}px Cinzel, "Times New Roman", serif`
      const w = Math.max(g.measureText('COMING').width, g.measureText('SOON').width)
      canvas.width = Math.ceil(w + f * 0.1)
      canvas.height = Math.ceil(f * 0.84 * 2 + f * 0.1)
      g.font = `500 ${f}px Cinzel, "Times New Roman", serif` // resizing the canvas resets the context
      g.fillStyle = '#f3ede8'
      g.textAlign = 'center'
      g.textBaseline = 'alphabetic'
      g.fillText('COMING', canvas.width / 2, f * 0.05 + f * 0.8)
      g.fillText('SOON', canvas.width / 2, f * 0.05 + f * 0.8 + f * 0.84)
      stage.textAspect = canvas.width / canvas.height
      t.needsUpdate = true
    }
    draw()
    document.fonts.load('500 100px Cinzel').then(draw, () => {})
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    if (born.current < 0) born.current = t
    const k = STILL ? 1 : smooth(clamp01((t - born.current - 0.2) / 1.6))
    m.scale.set(stage.textW, stage.textH, 1)
    m.position.set(0, stage.textY - (1 - k) * 0.12, TEXT_Z)
    m.lookAt(state.camera.position)
    ;(m.material as MeshBasicMaterial).opacity = k
  })
  // drawn after the cups: letters cover a cup behind them, a cup in front fails the depth test and stays on top
  return (
    <mesh ref={mesh} renderOrder={10}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Cup({ which, start }: { which: 'coffee' | 'matcha'; start: -1 | 1 }) {
  const { scene } = useGLTF(`/models/${which}.glb`)
  const g = useRef<Group>(null)
  const born = useRef(-1)
  const pos = useRef({ x: start * 0.6, y: FLOOR + VIEW_H, z: 0, s: 1 }) // where the cup is: it chases its target on a spring
  const vel = useRef({ x: 0, y: 0, z: 0 })
  const look = useRef({ yaw: 0, bank: 0, pitch: 0.04 })
  const mirror = useRef<Group>(null)
  const reflection = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if (o instanceof Mesh) o.material = asReflection((o.material as MeshStandardMaterial).clone())
    })
    return c
  }, [scene])
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material as MeshStandardMaterial
        m.envMapIntensity = 1.4
        m.roughness = Math.min(m.roughness, 0.55)
        finishCup(m, which)
      }
    })
  }, [scene])

  useFrame((state, rawDt) => {
    const o = g.current
    if (!o) return
    const dt = Math.min(rawDt, 1 / 30)
    const t = state.clock.elapsedTime
    if (born.current < 0) born.current = t
    const age = t - born.current
    const { size, X } = stage

    // Every so often the two swap places, going round the headline in opposite directions: each sets off outward from
    // its spot, slips behind the word, and they pass each other back there, the one from the left gliding over the top,
    // the other slipping underneath. Then each comes round the far side and settles in the other's place, with one slow
    // mirrored pirouette on the way. Each starts from the point on the circle straight above where it stands, so nothing
    // reverses, and the letters' depth is only ever crossed beyond the ends of the word.
    const since = age - FIRST_LOOP
    let u = 1
    let rides = 0 // swaps completed so far
    if (!STILL && since >= 0) {
      const n = Math.floor(since / EVERY)
      u = clamp01((since - n * EVERY) / LOOP)
      rides = u < 1 ? n : n + 1
    }
    const from = rides % 2 === 0 ? start : -start // the spot this cup rests on, or is setting off from

    // where the cup wants to be. At rest: on the counter (it waits above the screen until its turn to come down).
    let tx = from * X
    let ty = !STILL && age < 0.4 + (start > 0 ? 0.3 : 0) ? FLOOR + VIEW_H : FLOOR
    let tz = 0
    let ts = size
    let twirl = 0
    if (u < 1) {
      const w = smooth(clamp01(u / 0.2)) * smooth(clamp01((1 - u) / 0.2)) // lift off, settle back
      const fly = size * FLY_SCALE
      const rx = stage.textW / 2 + fly * 0.55 + 0.2
      const dir = from < 0 ? 1 : -1 // the left cup goes left, behind, right; the right cup mirrors it
      const a0 = Math.acos(clamp((from * X) / rx, -1, 1))
      const a1 = Math.acos(clamp((-from * X) / rx, -1, 1)) + dir * 2 * Math.PI
      const p = 0.5 - 0.5 * Math.cos(Math.PI * u) // easing in and out
      const phi = a0 + (a1 - a0) * p
      const pass = dir * Math.sin(Math.PI * p) // over (+) or under (-) as they cross behind the word
      tx = lerp(from * X * (1 - 2 * smooth(u)), rx * Math.cos(phi), w) // resting spot slides to the other side
      ty = lerp(ty, stage.textY - fly * 0.5 + stage.textH * 0.3 * pass, w)
      tz = lerp(tz, TEXT_Z + 1.3 * Math.sin(phi) + 0.15 * pass, w * w) // depth lags, so a cup leaves and lands clear of the letters
      ts = lerp(ts, fly, w)
      twirl = dir * 2 * Math.PI * smooth(u)
    }

    // follow on a critically damped spring: momentum and weight instead of moving on rails
    const p = pos.current
    const v = vel.current
    if (STILL) Object.assign(p, { x: tx, y: ty, z: tz })
    const d = 2 * Math.sqrt(SPRING)
    v.x += (SPRING * (tx - p.x) - d * v.x) * dt
    v.y += (SPRING * (ty - p.y) - d * v.y) * dt
    v.z += (SPRING * (tz - p.z) - d * v.z) * dt
    p.x += v.x * dt
    p.y += v.y * dt
    p.z += v.z * dt
    p.s = damp(p.s, ts, 4, dt)

    // body language from the motion itself: bank into the turn, glance where it's heading,
    // and at rest turn a little toward the other cup and toward the cursor
    const l = look.current
    l.bank = damp(l.bank, clamp(-v.x * 0.1, -0.3, 0.3) - pointer.sx * 0.06, 4, dt)
    l.yaw = damp(l.yaw, -Math.tanh(p.x * 2) * 0.28 + clamp(v.x * 0.12, -0.45, 0.45) + pointer.sx * 0.6 + Math.sin(t * 0.5 + start) * 0.05, 3, dt)
    l.pitch = damp(l.pitch, 0.04 - pointer.sy * 0.14, 3, dt) // look up and down with the cursor too
    o.scale.setScalar(p.s)
    o.position.set(p.x + pointer.sx * size * 0.1, p.y, p.z) // and drift a touch toward it
    o.rotation.set(l.pitch, l.yaw + twirl, l.bank) // a finished pirouette is a whole turn, so it hands back seamlessly

    // its reflection: the cup mirrored through the counter (fades out as the cup lifts away)
    const r = mirror.current
    if (r) {
      r.position.set(o.position.x, 2 * FLOOR - o.position.y, o.position.z)
      r.rotation.set(-o.rotation.x, o.rotation.y, -o.rotation.z)
      r.scale.set(o.scale.x, -o.scale.y, o.scale.z)
    }
  })

  return (
    <>
      <group ref={g} position={[0, 10, 0]}>
        <primitive object={scene} />
        <CupPrint />
      </group>
      <group ref={mirror} position={[0, -10, 0]}>
        <primitive object={reflection} />
      </group>
    </>
  )
}

// Transparent canvas over the page's plum background: the headline and the two cups that circle it now and then.
export default function CupDuo() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, CAM_HEIGHT, CAM_Z], fov: HERO_FOV }} gl={{ antialias: true, alpha: true }}>
        <Layout />
        <PointerRig />
        <CameraRig height={CAM_HEIGHT} lookY={-0.3} />
        <directionalLight position={[-4, 3, 3]} intensity={2.2} color="#ffd9a0" />
        <directionalLight position={[3, 2, 4]} intensity={0.9} color="#eef2ff" />
        <ambientLight intensity={0.5} />
        <Headline />
        <Suspense fallback={null}>
          <Cup which="coffee" start={-1} />
          <Cup which="matcha" start={1} />
        </Suspense>
        {/* just under the counter, so a landing cup never cuts into its own shadow */}
        {/* wide enough to catch the cups out at the ends of their circle too */}
        <ContactShadows position={[0, FLOOR - 0.01, 0]} scale={12} blur={2.6} far={2} opacity={0.6} resolution={1024} color="#12060e" />
        <Environment resolution={256}>
          <Lightformer intensity={2.5} position={[0, 5, 0]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} color="#fff4e6" />
          <Lightformer intensity={1.6} color="#ffe2b8" position={[-6, 2, 3]} scale={[1.5, 6, 1]} />
          <Lightformer intensity={1.0} color="#e8f0ff" position={[6, 1, 2]} scale={[1.5, 6, 1]} />
          <Lightformer intensity={0.6} color="#b3703c" position={[0, -3, -4]} scale={[8, 2, 1]} />
        </Environment>
      </Canvas>
    </div>
  )
}
