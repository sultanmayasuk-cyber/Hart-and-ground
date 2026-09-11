import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, Mesh, MeshStandardMaterial } from 'three'
import { cupsWorld } from './cups'
import { damp, pointer } from './pointer'
import { P_HOLD_END, pageOffset, scroll, VIEW_H } from './scroll'

useGLTF.preload('/models/coffee.glb')
useGLTF.preload('/models/matcha.glb')

const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function useCupRig(which: 'matcha' | 'coffee') {
  const ref = useRef<Group>(null)
  const phase = which === 'matcha' ? 0 : Math.PI
  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const p = scroll.smooth
    const t = state.clock.elapsedTime
    // p: 0→1/3 section two scrolls up to centre · 1/3→2/3 pinned · 2/3→1 section three
    const slide = ease(clamp01((p - P_HOLD_END - 0.02) / (1 - P_HOLD_END - 0.04)))
    const scale = 1.35
    const centreY = -0.8
    const offset = Math.min(pageOffset(), VIEW_H) // page-anchored until centred, then held
    const y = -VIEW_H + offset + centreY
    // the pair swaps places in a half circle while the group glides from right to left,
    // always keeping a margin from the screen edge (positions derive from the viewport width)
    const halfW = (VIEW_H / 2) * (state.size.width / state.size.height)
    const margin = 1.15
    const r = 0.65
    const cx = (halfW - margin - r) * (1 - 2 * slide)
    const ang = phase + slide * Math.PI
    const x = cx + Math.cos(ang) * r
    const z = Math.sin(ang) * r * 0.6 - 0.2
    g.position.x = damp(g.position.x, x + pointer.sx * 0.22, 5, dt)
    g.position.y = y + pointer.sy * 0.12
    g.position.z = damp(g.position.z, z, 4, dt)
    g.rotation.y = damp(g.rotation.y, -0.3 + slide * Math.PI * 2 + Math.sin(t * 0.3 + phase) * 0.1 + pointer.sx * 0.5, 3, dt)
    g.rotation.z = damp(g.rotation.z, (which === 'matcha' ? -0.05 : 0.04) + Math.sin(t * 0.7 + phase) * 0.015, 3, dt)
    g.rotation.x = damp(g.rotation.x, 0.42 + pointer.sy * 0.16, 3, dt)
    g.scale.setScalar(scale)
    const w = cupsWorld[which]
    w.center.set(g.position.x, g.position.y, g.position.z)
    w.scale = scale
  })
  return ref
}

function Cup({ which }: { which: 'matcha' | 'coffee' }) {
  const { scene } = useGLTF(`/models/${which}.glb`)
  const ref = useCupRig(which)
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material as MeshStandardMaterial
        m.envMapIntensity = 1.4
        m.roughness = Math.min(m.roughness, 0.55)
        o.castShadow = false
      }
    })
  }, [scene])
  return (
    <group ref={ref} position={[0, -5, 0]}>
      <primitive object={scene} />
    </group>
  )
}

export default function Cups3D() {
  return (
    <>
      <Cup which="matcha" />
      <Cup which="coffee" />
    </>
  )
}
