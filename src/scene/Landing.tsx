import { Environment, Lightformer, useGLTF } from '@react-three/drei'
import { onFrame } from '../frame'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { Mesh, ShaderMaterial, Texture, type Group, type MeshStandardMaterial } from 'three'
import CupPrint from './CupPrint'
import { finishCup } from './cupFinish'
import { CAM_Z, DRACO, HERO_FOV } from './cups'
import { damp, pointer } from './pointer'
import { CameraRig, PointerRig } from './rigs'
import { page, VIEW_H } from './scroll'
import PaperCup from './PaperCup'

useGLTF.preload('/models/matcha.glb', DRACO)

// The two real cups (the hot coffee in its paper cup, the iced matcha) on a cream counter, the only 3D on the site. The camera never moves; the cups glide between marks
// on springs as the page scrolls (page.act, driven by ScrollTriggers in App.tsx):
//   0  waiting   below the page, out of sight, while the hero dive (Dive.tsx) plays
//   1  centre    the pair in the middle of the menu stage, coffee in front
//   2  traded    they change places, matcha in front (one slow turn on the way)
//   3  parted    they step aside to either edge, facing in, round the door to the full menu
//   4  gone      both sink below the counter as the plum story block arrives
const FLOOR = -VIEW_H * 0.42
const CAM_HEIGHT = 1.35 // raised a little, looking down into the cups (the ice shows)
const SPRING = 14 // critically damped: weight, no wobble
// dev: ?snap puts the cups exactly on their marks (no springs), for checking frames one by one
const SNAP = import.meta.env.DEV && new URLSearchParams(location.search).has('snap')
const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number) => clamp(x, 0, 1)
const smooth = (x: number) => x * x * (3 - 2 * x)
const lerp = (a: number, b: number, w: number) => a + (b - a) * w

// viewport-derived layout, recomputed every frame. ready: textures uploaded and shaders compiled (see Warmup)
const stage = { size: 1.6, vw: 5, portrait: 0, act: 0, ready: false, frames: 0, loop: '' }
function Layout() {
  useFrame((state, dt) => {
    const vw = (VIEW_H * state.size.width) / state.size.height
    // 0 on landscape screens, 1 on a phone held upright (there the copy sits above the cups, not beside them)
    const portrait = clamp01((1 - state.size.width / state.size.height) / 0.45)
    stage.vw = vw
    stage.portrait = portrait
    stage.size = Math.min(VIEW_H * lerp(0.54, 0.34, portrait), vw * lerp(0.42, 0.6, portrait)) // (a phone's cups are sized to its width)
    stage.act = SNAP ? page.act : damp(stage.act, page.act, 6, Math.min(dt, 1 / 30))
    stage.frames++
    stage.loop = state.frameloop
  })
  return null
}

type Mark = { x: number; y: number; z: number; s: number; yaw: number }
const mix = (a: Mark, b: Mark, w: number): Mark => ({
  x: lerp(a.x, b.x, w),
  y: lerp(a.y, b.y, w),
  z: lerp(a.z, b.z, w),
  s: lerp(a.s, b.s, w),
  yaw: lerp(a.yaw, b.yaw, w),
})

// the pool of shadow under a cup: a soft dark disc, densest at the foot
const POOL = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6); gl_FragColor = vec4(0.05, 0.015, 0.04, a * 0.62); }',
})

// where each cup is, for the other one to keep clear of
const where = { hot: { x: -10, y: 0, z: 0, s: 1, floor: 0 }, matcha: { x: 10, y: 0, z: 0, s: 1, floor: 0 } }

// the matcha: the Meshy model, finished and printed (the hot coffee is built in code: PaperCup.tsx)
function Matcha() {
  const { scene } = useGLTF('/models/matcha.glb', DRACO)
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material as MeshStandardMaterial
        m.envMapIntensity = 1.3
        m.roughness = Math.min(m.roughness, 0.55)
        finishCup(m, 'matcha')
      }
    })
  }, [scene])
  return (
    <>
      <primitive object={scene} />
      <CupPrint />
    </>
  )
}

function Cup({ which }: { which: 'hot' | 'matcha' }) {
  const coffee = which === 'hot'
  const g = useRef<Group>(null)
  const pos = useRef({ x: 0, y: FLOOR + VIEW_H * 1.2, z: 0, s: 1 }) // where the cup is: it chases its mark on a spring
  const vel = useRef({ x: 0, y: 0, z: 0 })
  const look = useRef({ yaw: 0, bank: 0, pitch: 0.04 })
  const shadow = useRef<Mesh>(null)

  useFrame((state, rawDt) => {
    const o = g.current
    if (!o || !stage.ready) return // waits out of view (above the screen) until the warm-up is done
    const dt = Math.min(rawDt, 1 / 30)
    const t = state.clock.elapsedTime
    const { size: S, vw, portrait: P, act } = stage

    // the marks. Front cup faces the reader; the one behind stands a step back and turned away a little
    const floor = FLOOR - VIEW_H * 0.03 * P // on a phone the counter sits a little lower, under the copy
    const front = (x: number): Mark => ({ x, y: floor, z: 0.3, s: S * 1.1, yaw: 0 })
    const behind = (x: number): Mark => ({ x, y: floor, z: -1.6, s: S * 0.95, yaw: coffee ? 0.55 : -0.55 })
    // centre stage: the front cup a little left of the middle, the other a step back to the right
    const drinks1 = coffee ? front(lerp(-vw * 0.07, 0, P)) : behind(lerp(vw * 0.16, vw * 0.3, P))
    // waiting: under the page, so they come up into the menu stage as it arrives
    const hero: Mark = { ...drinks1, y: floor - VIEW_H * 1.3 }
    const drinks2 = coffee ? behind(lerp(-vw * 0.16, -vw * 0.3, P)) : front(lerp(vw * 0.07, 0, P))
    let m = mix(hero, drinks1, smooth(clamp01(act)))
    m = mix(m, drinks2, smooth(clamp01(act - 1)))
    // trading places they go round each other, never through: the one coming forward swings out toward the camera,
    // the one stepping back passes behind it, a full cup's width apart where their paths cross
    const round = Math.sin(Math.PI * smooth(clamp01(act - 1)))
    // (the one stepping back does most of the passing: coming too far forward it would grow over the words above)
    m.z += (coffee ? -2.1 : lerp(0.9, 0.35, P)) * round // (less on a phone: coming forward it would fill the screen)
    m.y += (coffee ? 0 : 1) * 0.05 * S * round // and the one in front lifts a little as it comes by
    // 3 · parted: each to its own edge, the same size, turned a little toward the door between them
    // (on a wide screen they don't go all the way to the edges: the door between them is only so wide)
    // (a phone has no room either side of the door: there they step down to the foot of the screen, side by side, and
    // the door stands above them)
    const parted: Mark = {
      x: (coffee ? -1 : 1) * lerp(Math.min(vw * 0.37, VIEW_H * 0.56), vw * 0.26, P),
      y: floor - VIEW_H * 0.1 * P,
      z: lerp(0.45, 0, P),
      s: S * lerp(1.05, 0.95, P),
      yaw: (coffee ? 0.32 : -0.32) * (1 - P * 0.4),
    }
    m = mix(m, parted, smooth(clamp01(act - 2)))
    // 4 · gone, under the page, as the story arrives
    const gone: Mark = { ...parted, y: FLOOR - VIEW_H * 1.8, s: S * 0.9 }
    m = mix(m, gone, smooth(clamp01(act - 3)))
    // the cup coming forward in the trade turns once, all the way round, on its way
    const trade = smooth(clamp01(act - 1))
    const twirl = (coffee ? -1 : 1) * 2 * Math.PI * trade
    const ty = m.y

    // follow on a critically damped spring: momentum and weight instead of moving on rails
    const p = pos.current
    const v = vel.current
    // while the dive plays they wait out of sight, parked on their mark (no flight across the dive)
    if (STILL || SNAP || act < 0.001) {
      Object.assign(p, { x: m.x, y: ty, z: m.z })
      Object.assign(v, { x: 0, y: 0, z: 0 })
    }
    const d = 2 * Math.sqrt(SPRING)
    v.x += (SPRING * (m.x - p.x) - d * v.x) * dt
    v.y += (SPRING * (ty - p.y) - d * v.y) * dt
    v.z += (SPRING * (m.z - p.z) - d * v.z) * dt
    p.x += v.x * dt
    p.y += v.y * dt
    p.z += v.z * dt
    p.s = damp(p.s, m.s, 4, dt)
    // two solid cups: whatever the springs and the scroll are doing, they can never overlap. If they'd come closer than
    // their rims allow, each is pushed back out along the line between them (the one in front toward the camera)
    const me = where[which]
    const other = where[coffee ? 'matcha' : 'hot']
    const min = (p.s + other.s) * 0.45 // rim radius is 0.386 of the height, plus a finger's gap
    let dx = p.x - other.x
    let dz = p.z - other.z
    let dist = Math.hypot(dx, dz)
    if (dist < min && Math.abs(p.y - other.y) < p.s) {
      if (dist < 1e-3) {
        dx = 0
        dz = coffee ? -1 : 1
        dist = 1
      }
      const push = (min - dist) * 0.5
      p.x += (dx / dist) * push
      p.z += (dz / dist) * push
    }
    Object.assign(me, { x: p.x, y: p.y, z: p.z, s: p.s, floor })

    // body language from the motion itself: bank into the turn, glance where it's heading, look toward the cursor
    const l = look.current
    l.bank = damp(l.bank, clamp(-v.x * 0.06, -0.1, 0.1) - pointer.sx * 0.05, 4, dt)
    l.yaw = damp(l.yaw, m.yaw + clamp(v.x * 0.1, -0.4, 0.4) + pointer.sx * 0.45 + Math.sin(t * 0.4 + (coffee ? 0 : 2)) * 0.04, 3, dt)
    l.pitch = damp(l.pitch, 0.04 - pointer.sy * 0.1, 3, dt)
    o.scale.setScalar(p.s)
    o.position.set(p.x + pointer.sx * S * 0.06, p.y, p.z)
    o.rotation.set(l.pitch, l.yaw + twirl, l.bank)
    // its shadow: a soft pool on the counter right under it, steady (it only follows the cup)
    const sh = shadow.current
    if (sh) {
      sh.position.set(o.position.x, Math.min(floor, p.y) + 0.002, p.z) // (it goes down with the cup when the cup leaves)
      sh.scale.setScalar(p.s * 1.25)
    }
  })

  return (
    <>
      <group ref={g} position={[0, 10, 0]}>
        {coffee ? <PaperCup /> : <Matcha />}
      </group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, -50, 0]} material={POOL} renderOrder={-1}>
        <planeGeometry />
      </mesh>
    </>
  )
}

// On load the camera settles in from a little further back, so the room arrives with the cups.
function Settle() {
  const { camera } = useThree()
  const started = useRef(false)
  useFrame((_, dt) => {
    if (!stage.ready) return
    if (!started.current) {
      started.current = true
      if (!STILL) camera.position.z = CAM_Z + 1.1
    }
    camera.position.z = damp(camera.position.z, CAM_Z, 1.1, Math.min(dt, 1 / 30))
  })
  return null
}

// Once the cups have loaded: upload every texture and compile every shader up front (the cups are parked above the
// screen), then let the entrance start, so the first visible frames can't hitch.
function Warmup() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        for (const v of Object.values(mat)) if (v instanceof Texture) gl.initTexture(v)
    })
    const dbg = (window as unknown as { __cups?: Record<string, unknown> })
    dbg.__cups = { stage, where, err: '' }
    gl.compileAsync(scene, camera)
      .catch((e: unknown) => { dbg.__cups!.err = String(e) })
      .finally(() => {
        if (alive) stage.ready = true
      })
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  return null
}


// Frames only once the drinks section is arriving: while the dive plays, the cups are parked below and nothing is drawn.
// Once they're sent below for the story it keeps drawing until both really are out of sight (a transparent canvas
// keeps its last frame: stopping on a timer left them hanging mid-air when the springs hadn't finished).
function Pump() {
  const setFrameloop = useThree((st) => st.setFrameloop)
  const invalidate = useThree((st) => st.invalidate)
  const get = useThree((st) => st.get)
  useEffect(() => {
    let rest = 0 // frames both cups have been out of sight below
    const tick = () => {
      const below = FLOOR - VIEW_H * 1.2
      rest = page.act > 3.999 && where.hot.y < below && where.matcha.y < below ? rest + 1 : 0
      const want = (page.act > 0.0005 || stage.act > 0.0005) && rest < 12
      // checked against the renderer's own state every frame, not remembered: the <Canvas frameloop="never"> prop is
      // re-applied whenever the canvas resizes (a phone's toolbar sliding), which silently put it back to 'never'; and
      // 'always' doesn't restart a loop that has already stopped, so it gets one kick (found on iOS, 2026-09-23)
      const loop = want ? 'always' : 'never'
      if (get().frameloop !== loop) {
        setFrameloop(loop) // (every frame while they're on screen, none otherwise)
        if (want) invalidate()
      }
    }
    return onFrame(tick)
  }, [setFrameloop, invalidate, get])
  return null
}

// Transparent canvas fixed over the page (under the header), so the cups can stand in front of the copy's edges.
export default function Landing() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <Canvas style={{ pointerEvents: 'none' }} frameloop="never" dpr={[1, 1.5]} camera={{ position: [0, CAM_HEIGHT, CAM_Z], fov: HERO_FOV }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: SNAP }}>
        <Pump />
        <Layout />
        <PointerRig />
        <CameraRig height={CAM_HEIGHT} lookY={-0.25} />
        <Settle />
        {/* daylight through a shop window: warm key from the left, cool fill, bright room */}
        <directionalLight position={[-4, 4, 3]} intensity={2.0} color="#fff1dc" />
        <directionalLight position={[3, 2, 4]} intensity={0.8} color="#eef2ff" />
        <ambientLight intensity={0.6} />
        <Suspense fallback={null}>
          <Cup which="hot" />
          <Cup which="matcha" />
          <Warmup />
        </Suspense>
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
