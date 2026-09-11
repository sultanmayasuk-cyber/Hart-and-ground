import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, type ShaderMaterial } from 'three'
import { bg } from './Backdrop'
import { pageOffset } from './scroll'
import type { Mesh } from 'three'

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const frag = /* glsl */ `
  uniform vec3 uColor; uniform float uStrength;
  varying vec2 vUv;
  void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * 3.5) * uStrength; gl_FragColor = vec4(uColor * a, a); }
`
export default function Glow({ color, strength = 0.5, size = 3, position }: { color: string; strength?: number; size?: number; position?: [number, number, number] }) {
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uStrength: { value: strength } }), [color, strength])
  const mat = useRef<ShaderMaterial>(null)
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (mat.current) mat.current.uniforms.uStrength.value = strength * (1 - bg.blend)
    if (mesh.current && position) mesh.current.position.y = position[1] + pageOffset()
  })
  return (
    <mesh ref={mesh} position={position}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
    </mesh>
  )
}
