import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type ShaderMaterial } from 'three'
import { cupsWorld } from './cups'
import { scroll } from './scroll'

// Screen-space backdrop. Deep plum in the hero, warming to cream as the cups arrive,
// with a soft pool of light that follows the cups.
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`
const frag = /* glsl */ `
  uniform vec3 uPlum, uDeep, uCream, uCreamDeep, uWarm;
  uniform float uBlend, uTime, uAspect, uCups;
  uniform vec2 uPool, uFocus;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // dark world
    float r = distance(uv * vec2(uAspect, 1.0), uFocus * vec2(uAspect, 1.0));
    vec3 dark = mix(uPlum, uDeep, smoothstep(0.15, 1.1, r));
    float pool0 = exp(-r * r * 3.0) * (0.5 + 0.05 * sin(uTime * 0.4));
    dark += uWarm * pool0 * 0.16;
    float r3 = distance(uv * vec2(uAspect, 1.0), uPool * vec2(uAspect, 1.0));
    dark += uWarm * exp(-r3 * r3 * 2.5) * 0.10 * uCups;
    // light world
    float r2 = distance(uv * vec2(uAspect, 1.0), uPool * vec2(uAspect, 1.0));
    vec3 light = mix(uCream, uCreamDeep, smoothstep(0.2, 1.3, r2));
    light += vec3(1.0, 0.96, 0.9) * exp(-r2 * r2 * 4.0) * 0.06;
    vec3 col = mix(dark, light, uBlend);
    col += (hash(uv * 900.0 + uTime) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`

export const bg = { blend: 0 } // 0 = plum world, 1 = cream world (shared with the DOM via --b)

// `focus` (screen uv, read every frame) centres the dark world's warm pool; defaults to behind the hero stag.
export default function Backdrop({ focus }: { focus?: { x: number; y: number } }) {
  const mat = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uPlum: { value: new Color('#3a1a30') },
      uDeep: { value: new Color('#140810') },
      uCream: { value: new Color('#f4ece2') },
      uCreamDeep: { value: new Color('#e3d5c6') },
      uWarm: { value: new Color('#b8865a') },
      uBlend: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uCups: { value: 0 },
      uPool: { value: [0.7, 0.45] },
      uFocus: { value: [0.68, 0.62] },
    }),
    [],
  )
  useFrame((state) => {
    const m = mat.current
    if (!m) return
    const p = scroll.smooth
    bg.blend = 0
    m.uniforms.uBlend.value = 0
    // the warm pool drifts from behind the stag to behind the cups
    void p
    if (focus) m.uniforms.uFocus.value = [focus.x, focus.y]
    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uAspect.value = state.size.width / state.size.height
    m.uniforms.uCups.value = Math.min(1, Math.max(0, (p - 0.05) / 0.2))
    // light pool follows the midpoint between the cups (projected to screen space)
    const mid = cupsWorld.matcha.center.clone().add(cupsWorld.coffee.center).multiplyScalar(0.5)
    mid.y += 0.8
    mid.project(state.camera)
    m.uniforms.uPool.value = [mid.x * 0.5 + 0.5, mid.y * 0.5 + 0.5]
  })
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  )
}
