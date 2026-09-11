import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type ShaderMaterial } from 'three'

// Warm dust hanging in the light: a few hundred soft motes drifting up through the scene,
// most behind the stag, a few close to the lens.
const N = 420

const vert = /* glsl */ `
  uniform float uTime, uScale;
  attribute float aSeed;
  varying float vA;
  void main() {
    vec3 p = position;
    // rise and wrap within a 5-unit column
    p.y = mod(p.y + uTime * (0.04 + 0.06 * fract(aSeed * 7.0)) + 2.5, 5.0) - 2.5;
    p.x += sin(uTime * 0.23 + aSeed * 40.0) * 0.18;
    p.z += cos(uTime * 0.19 + aSeed * 25.0) * 0.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.5 + 0.5 * sin(uTime * (0.5 + fract(aSeed * 3.0)) + aSeed * 20.0);
    vA = smoothstep(2.5, 1.6, abs(p.y)) * (0.15 + 0.85 * tw * tw);
    gl_PointSize = (1.2 + 4.0 * pow(fract(aSeed * 13.0), 3.0)) * uScale / -mv.z;
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor, a * a * vA * 0.6);
  }
`

export default function Dust() {
  const mat = useRef<ShaderMaterial>(null)
  const geo = useMemo(() => {
    let rs = 7
    const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * 9
      pos[i * 3 + 1] = (rnd() - 0.5) * 5
      pos[i * 3 + 2] = -3 + rnd() * 4.8
      seed[i] = rnd()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    return g
  }, [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uScale: { value: 1 }, uColor: { value: new Color('#e8c48a') } }), [])
  useFrame((state) => {
    if (!mat.current) return
    mat.current.uniforms.uTime.value = state.clock.elapsedTime
    mat.current.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / 120
  })
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
    </points>
  )
}
