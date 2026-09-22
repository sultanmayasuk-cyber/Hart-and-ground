import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, Mesh, Quaternion, ShaderMaterial } from 'three'

// Steam off the hot cup: one quad standing over the coffee, turned to face the camera, with a few wisps of noise
// drifting up through it and thinning out. Cheap on purpose (a single plane, three octaves of value noise).
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uFade;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 7.1) + 0.125 * noise(p * 4.1 - 3.3); }
void main() {
  float y = vUv.y;
  float x = vUv.x - 0.5;
  // the wisps: rising, swaying more the higher they get
  float sway = (fbm(vec2(y * 1.6 - uTime * 0.25, 2.0)) - 0.5) * y * 0.5;
  vec2 p = vec2((x + sway) * 3.0, y * 2.2 - uTime * 0.55);
  float n = fbm(p) * 0.65 + fbm(p * 2.1 + vec2(4.0, uTime * 0.1)) * 0.35;
  // a column that spreads and thins on the way up
  float width = 0.1 + 0.36 * y;
  float column = 1.0 - smoothstep(0.0, width, abs(x + sway));
  float rise = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.3, 1.0, y));
  // and nothing reaches the quad's edges, so it never shows as a rectangle
  float edge = (1.0 - smoothstep(0.3, 0.48, abs(x))) * (1.0 - smoothstep(0.8, 0.98, y));
  float a = smoothstep(0.36, 0.8, n) * column * rise * edge;
  // over the light latte paper steam reads by its shade: a warm-grey body, whiter where the wisps are thickest
  vec3 col = mix(vec3(0.5, 0.42, 0.38), vec3(1.0, 0.98, 0.95), smoothstep(0.5, 0.92, n));
  gl_FragColor = vec4(col, a * 0.78 * uFade);
}`

export default function Steam({ strength = 1 }: { strength?: number }) {
  const mesh = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uFade: { value: strength } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [strength],
  )
  const q = useMemo(() => new Quaternion(), [])
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    mat.uniforms.uTime.value = state.clock.elapsedTime
    // face the camera whatever the cup is doing (the cup turns; the steam doesn't turn with it)
    m.parent!.getWorldQuaternion(q)
    m.quaternion.copy(q.invert()).multiply(state.camera.quaternion)
  })
  // unit cup: the coffee sits at y ≈ 0.95; the steam stands from just above it
  return (
    <mesh ref={mesh} position={[0, 0.94 + 0.55, 0]} material={mat} renderOrder={3}>
      <planeGeometry args={[0.9, 1.1]} />
    </mesh>
  )
}
