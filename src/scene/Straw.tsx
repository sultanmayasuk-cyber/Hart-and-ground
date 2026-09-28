import { useEffect, useMemo } from 'react'
import { BackSide, CylinderGeometry, type MeshStandardMaterial, Quaternion, RingGeometry, Vector3 } from 'three'

// The paper straw in the iced matcha (the owner's ask, 2026-09-28). Paper, as UK cafés use, in the cup's burgundy ink,
// wound from one strip so its seam spirals up it; open at the top, where you see down into it. It stands on the foot of
// the cup near the middle and leans back against the rim, so it rises behind the logo. Cup units (base at y = 0,
// rim at 0.93); the cup's own wall and drink hide the part that's in the drink.
const R = 0.03 // an 8 mm straw on a 15 cm cup
const FOOT = new Vector3(0.03, 0.1, 0.04)
const LEAN = 0.33 // radians from upright
const TOWARD = new Vector3(-0.55, 0, -0.83) // back and to the left
const TOP_Y = 1.24
const L = (TOP_Y - FOOT.y) / Math.cos(LEAN)
const WET = (0.95 - FOOT.y) / Math.cos(LEAN) // below here, along the straw, the paper has drunk some matcha
const INK = '#7a2544'

const paper = (m: MeshStandardMaterial) => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vStrawUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrawUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vStrawUv;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// the seam of the wound strip, a fine line spiralling up (one turn per ${(0.1).toFixed(2)} of height)
float along = vStrawUv.y * ${L.toFixed(4)};
float wind = fract(vStrawUv.x + along / 0.1);
float seam = 1.0 - smoothstep(0.0, fwidth(wind) * 1.5 + 0.012, min(wind, 1.0 - wind));
diffuseColor.rgb *= 1.0 - 0.28 * seam;
diffuseColor.rgb *= 0.94 + 0.06 * fract(sin(dot(floor(vStrawUv * vec2(90.0, 700.0)), vec2(12.9898, 78.233))) * 43758.5453); // paper tooth
diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(${(WET - 0.03).toFixed(4)}, ${(WET + 0.03).toFixed(4)}, along)); // wet where it's been in the drink`,
      )
  }
  m.customProgramCacheKey = () => 'straw-paper'
}

export default function Straw() {
  const geo = useMemo(() => {
    const outer = new CylinderGeometry(R, R, L, 40, 1, true).translate(0, L / 2, 0)
    const inner = new CylinderGeometry(R * 0.86, R * 0.86, L, 40, 1, true).translate(0, L / 2, 0)
    const lip = new RingGeometry(R * 0.86, R, 40).rotateX(-Math.PI / 2).translate(0, L, 0)
    return { outer, inner, lip }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const tilt = useMemo(() => {
    const axis = new Vector3(0, Math.cos(LEAN), 0).addScaledVector(TOWARD.clone().normalize(), Math.sin(LEAN))
    return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize())
  }, [])
  return (
    <group position={FOOT} quaternion={tilt}>
      <mesh geometry={geo.outer}>
        <meshStandardMaterial color={INK} roughness={0.72} envMapIntensity={0.7} onUpdate={paper} />
      </mesh>
      <mesh geometry={geo.inner}>
        <meshStandardMaterial color="#3c1222" roughness={0.9} side={BackSide} />
      </mesh>
      <mesh geometry={geo.lip}>
        <meshStandardMaterial color="#b56a84" roughness={0.85} />
      </mesh>
    </group>
  )
}
