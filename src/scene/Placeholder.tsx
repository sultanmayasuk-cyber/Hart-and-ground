import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useRef } from 'react'
import type { Mesh } from 'three'

// Temporary object to confirm the 3D pipeline works; replace with real models.
export default function Placeholder() {
  const ref = useRef<Mesh>(null)
  const { color, speed } = useControls('Placeholder', {
    color: '#6ee7b7',
    speed: { value: 0.4, min: 0, max: 2 },
  })

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * speed
    ref.current.rotation.y += delta * speed
  })

  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[1, 0.3, 200, 32]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
    </mesh>
  )
}
