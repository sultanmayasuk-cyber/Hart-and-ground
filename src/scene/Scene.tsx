import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Leva } from 'leva'
import Placeholder from './Placeholder'

export default function Scene() {
  return (
    <>
      <Leva hidden={!import.meta.env.DEV} collapsed />
      <div className="fixed inset-0 -z-10">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 4, 5]} intensity={2} />
          <Placeholder />
          <EffectComposer>
            <Bloom intensity={0.6} luminanceThreshold={0.6} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
    </>
  )
}
