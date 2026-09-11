import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useEffect, useRef, type RefObject } from 'react'
import type { Group } from 'three'
import Backdrop from './Backdrop'
import { CAM_Z, HERO_FOV } from './cups'
import Dust from './Dust'
import Glow from './Glow'
import { CameraRig, PointerRig } from './rigs'
import { VIEW_H } from './scroll'
import Stag, { type StagLayout } from './Stag'

// The stag fills whatever box the page gives it (the `stage` element), at any aspect ratio,
// so the 3D mark and the DOM lockup never collide.
const STAG_W = 2.7 // point-cloud extent at scale 1 (the stage box has the same aspect)
const STAG_H = 2.4
const layout: StagLayout = { x: 0, y: 0.3, scale: 0.8 }
const focus = { x: 0.5, y: 0.6 } // backdrop light pool, in screen uv

function StageFit({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const glow = useRef<Group>(null)
  const rect = useRef<DOMRect | null>(null)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => (rect.current = el.getBoundingClientRect())
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [stage])
  useFrame(({ size }) => {
    const r = rect.current
    if (!r || !r.height) return
    const unit = VIEW_H / size.height // world units per CSS pixel on the z=0 plane
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    layout.scale = Math.min((r.width * unit) / STAG_W, (r.height * unit) / STAG_H)
    layout.x = (cx - size.width / 2) * unit
    layout.y = (size.height / 2 - cy) * unit
    focus.x = cx / size.width
    focus.y = 0.5 + layout.y / VIEW_H
    glow.current?.position.set(layout.x, layout.y, 0)
    glow.current?.scale.setScalar(layout.scale / 0.95)
  })
  return (
    <group ref={glow}>
      {/* soft round glow behind the stag, like the lit shop sign */}
      <Glow color="#b3703c" strength={0.32} size={5.2} position={[0, 0, -0.6]} />
    </group>
  )
}

export default function ComingSoonScene({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, CAM_Z], fov: HERO_FOV }} gl={{ antialias: true }}>
        <PointerRig />
        <CameraRig />
        <Backdrop focus={focus} />
        <Dust />
        <StageFit stage={stage} />
        <Stag layout={layout} />
        <EffectComposer>
          <Bloom intensity={0.4} luminanceThreshold={0.9} mipmapBlur />
          <Noise opacity={0.045} />
          <Vignette darkness={0.34} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
