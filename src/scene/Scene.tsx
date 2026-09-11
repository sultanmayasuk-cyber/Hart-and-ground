import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { Leva } from 'leva'
import Backdrop from './Backdrop'
import { CAM_Z, HERO_FOV } from './cups'
import Glow from './Glow'
import { CameraRig, PointerRig } from './rigs'
import Stag from './Stag'
import Cups3D from './Cups3D'
import { Environment, Lightformer } from '@react-three/drei'
import { Suspense } from 'react'

export default function Scene() {
  return (
    <>
      <Leva hidden={!import.meta.env.DEV} collapsed />
      <div className="fixed inset-0 -z-10">
        <Canvas dpr={[1, 1.25]} camera={{ position: [0, 0, CAM_Z], fov: HERO_FOV }} gl={{ antialias: true }}>
          <PointerRig />
          <CameraRig />
          <Backdrop />
          <directionalLight position={[-4, 3, 3]} intensity={2.2} color="#ffd9a0" />
          <directionalLight position={[3, 2, 4]} intensity={0.9} color="#eef2ff" />
          <ambientLight intensity={0.5} />
          {/* soft round glow behind the stag, like the shop sign */}
          <Glow color="#b3703c" strength={0.28} size={5.2} position={[1.05, 0.1, -0.6]} />
          <Stag />
          <Suspense fallback={null}>
            <Cups3D />
          </Suspense>
          <Environment resolution={256}>
            <Lightformer intensity={2.5} position={[0, 5, 0]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} color="#fff4e6" />
            <Lightformer intensity={1.6} color="#ffe2b8" position={[-6, 2, 3]} scale={[1.5, 6, 1]} />
            <Lightformer intensity={1.0} color="#e8f0ff" position={[6, 1, 2]} scale={[1.5, 6, 1]} />
            <Lightformer intensity={0.6} color="#b3703c" position={[0, -3, -4]} scale={[8, 2, 1]} />
          </Environment>
          <EffectComposer>
            <Bloom intensity={0.35} luminanceThreshold={0.92} mipmapBlur />
            <Noise opacity={0.04} />
            <Vignette darkness={0.28} />
          </EffectComposer>
        </Canvas>
      </div>
    </>
  )
}
