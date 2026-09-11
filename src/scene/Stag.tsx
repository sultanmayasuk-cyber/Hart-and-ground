import { useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  Mesh,
  NearestFilter,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three'
import { pointer } from './pointer'
import { cupsWorld } from './cups'
import { P_CENTER, pageOffset, scroll } from './scroll'
import { shedState } from './shed'

// ~40k grains simulated on the GPU (ping-pong position/velocity textures).
// Home A = the stag mark (world space). Home B = piles inside the two cups. Scroll morphs A → B.
const SIZE = 200 // 200*200 = 40000 grains
// Where the stag stands and how big it is. Read every frame, so a page can move it; defaults to the hero spot.
export type StagLayout = { x: number; y: number; scale: number }
const HERO_LAYOUT: StagLayout = { x: 1.05, y: 0.05, scale: 0.95 }

// Shared by the simulation and the renderer: which grains shed (antlers and leaves; u runs base → tips),
// and when each one regrows, the base of the antler first, the leaf tips last.
const shedGlsl = /* glsl */ `
  float shedAntler(float u, float leaf) { return max(smoothstep(0.55, 0.7, u), leaf); }
  float shedRegrow(float u, float leaf, float seed) { return 1.1 + (u - 0.55) * 2.4 + leaf * 0.4 + seed * 0.3; }
`

const simVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`

const velFrag = /* glsl */ `
  uniform sampler2D tPos, tVel, tHomeA, tHomeB, tData;
  uniform float uTime, uSim, uDt, uScroll, uScrollRaw, uCursorOn, uRot, uMatchaScale, uCoffeeScale, uDir, uPageY, uDiveStart, uDiveSpan, uStagScale, uShedT;
  uniform vec3 uCursor, uCursorVel, uMatchaPos, uCoffeePos, uPivot;
  varying vec2 vUv;
  ${shedGlsl}
  void main() {
    vec3 p = texture2D(tPos, vUv).xyz;
    vec3 v = texture2D(tVel, vUv).xyz;
    // home A is the raw mark: scale it, rotate it about its vertical axis, place it, and scroll it with the page
    vec3 rel = texture2D(tHomeA, vUv).xyz * uStagScale; float cs = cos(uRot), sn = sin(uRot);
    vec3 hA = uPivot + vec3(rel.x * cs + rel.z * sn, rel.y + uPageY, -rel.x * sn + rel.z * cs);
    vec4 sp = texture2D(tHomeB, vUv); // start angle, radius jitter, height jitter, cold
    vec4 dat = texture2D(tData, vUv);
    float seed = dat.z, order = dat.w;
    vec3 cupC = mix(uCoffeePos, uMatchaPos, sp.w);
    float cupS = mix(uCoffeeScale, uMatchaScale, sp.w);

    // phase 1: the stag breaks apart as soon as you scroll (small per-grain stagger)
    float leave = smoothstep(0.0, 1.0, (uScrollRaw - seed * 0.012) / 0.045);
    // phase 2: a tight tornado above each cup — narrow near the rim, wider at the top, spinning fast
    // then, in order, each grain slides down the funnel into the cup (m); reverse scroll brings it back out
    float m = smoothstep(0.0, 1.0, (uScroll - uDiveStart - order * uDiveSpan) / 0.05);
    float hN = sp.z;                                   // 0 = just above the rim, 1 = top of the funnel
    float ang = sp.x + uSim * 1.8 + hN * 4.0;
    float rad = mix(0.14 + 0.62 * hN, 0.06, m) * sp.y * cupS;
    float hgt = mix(1.06 + hN * 0.6, 0.5, m) * cupS;
    vec3 tornado = cupC + vec3(cos(ang) * rad, hgt, sin(ang) * rad * 0.7);
    vec3 target = mix(hA, tornado, leave);

    // entrance: springs switch on one by one over the first ~2s; hovering grains are held loosely
    float on = step(seed * 2.0, uTime);
    float k = mix(12.0, 8.0, leave) * on;
    // shed (uShedT = seconds since the tap): the antlers come away almost whole and fall,
    // then regrow in order from the base out to the tips
    float antler = shedAntler(dat.x, dat.y);
    float regrow = shedRegrow(dat.x, dat.y, seed);
    float loose = antler * step(0.0, uShedT) * (1.0 - smoothstep(regrow, regrow + 0.5, uShedT));
    k *= 1.0 - loose;
    vec3 f = (target - p) * k;
    vec3 rnd = normalize(vec3(fract(seed * 13.0) - 0.5, fract(seed * 29.0) - 0.5, fract(seed * 47.0) - 0.5) + 1e-3);
    float kick = step(0.0, uShedT) * exp(-uShedT * 12.0);
    f += normalize(vec3(p.x - uPivot.x, 0.5, 0.0) + rnd * 0.35) * antler * kick * 26.0;
    f += rnd * (1.0 - antler) * kick * 8.0;            // the body flinches
    f.y -= loose * mix(5.0, 1.6, dat.y);               // antlers drop, leaves float down
    f.x += loose * dat.y * sin(uTime * 2.6 + seed * 30.0) * 1.4;
    // burst outward as the stag shatters
    f += rnd * leave * (1.0 - leave) * 40.0 * uDir;
    // drift in the cloud
    f += vec3(sin(uTime * 0.9 + seed * 20.0), cos(uTime * 0.7 + seed * 30.0), sin(uTime * 0.8 + seed * 40.0)) * 0.6 * leave * (1.0 - m);

    // cursor: push away and drag along, only while the stag is assembled
    vec3 c = p - uCursor;
    float r = length(c);
    float fall = exp(-(r * r) / 0.09) * uCursorOn * (1.0 - leave);
    f += normalize(c + 1e-4) * fall * 32.0;
    f += uCursorVel * fall * 7.0;

    // swirl only while a grain is away from home, so the body settles still
    float away = clamp(length(target - p) * 2.0, 0.0, 1.0);
    vec3 n = vec3(sin(p.y * 3.0 + uTime * 1.5 + seed * 6.0), sin(p.z * 4.0 + uTime * 1.1 + seed * 3.0), sin(p.x * 3.5 + uTime * 1.3));
    f += n * away * 2.5 * (1.0 - leave) * (1.0 - loose);

    // idle breathing (tiny)
    f += 0.06 * vec3(sin(uTime * 0.7 + seed * 6.28), cos(uTime * 0.6 + seed * 8.0), 0.0);

    v += f * uDt;
    v *= exp(-6.0 * uDt);
    gl_FragColor = vec4(v, 1.0);
  }
`
const posFrag = /* glsl */ `
  uniform sampler2D tPos, tVel, tStart;
  uniform float uDt, uReset;
  varying vec2 vUv;
  void main() {
    if (uReset > 0.5) { gl_FragColor = vec4(texture2D(tStart, vUv).xyz, 1.0); return; }
    vec3 p = texture2D(tPos, vUv).xyz;
    vec3 v = texture2D(tVel, vUv).xyz;
    gl_FragColor = vec4(p + v * uDt, 1.0);
  }
`

const vert = /* glsl */ `
  uniform sampler2D tPos, tData, tNormal;
  uniform float uTime, uScroll, uScrollRaw, uScale, uGrain, uRot, uMatchaScale, uCoffeeScale, uShedT;
  uniform vec3 uMatchaPos, uCoffeePos;
  uniform vec3 uPlum, uCoffee, uGold, uMatcha, uGrounds, uCrema, uFoam;
  attribute vec2 aUv;
  varying float vAlpha, vSeed; varying vec3 vColor;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  ${shedGlsl}
  void main() {
    vec3 p = texture2D(tPos, aUv).xyz;
    vec4 d = texture2D(tData, aUv); // u, leaf, seed, fill order
    float u = d.x, leaf = d.y, seed = d.z, order = d.w;
    float alpha = 1.0;
    // shed: falling antlers crumble to dust, then fade back in as they regrow
    float rg = shedRegrow(u, leaf, seed);
    alpha *= 1.0 - 0.85 * shedAntler(u, leaf) * smoothstep(0.25, 0.85, uShedT) * (1.0 - smoothstep(rg, rg + 0.6, uShedT));

    float leave = smoothstep(0.0, 1.0, (uScrollRaw - seed * 0.012) / 0.045);
    // a few grains lift off the body like steam while the stag is whole
    if (seed < 0.045) {
      float rise = fract(uTime * 0.06 + seed * 40.0);
      p.y += rise * 1.1 * (1.0 - leave);
      p.x += sin(uTime * 0.8 + seed * 90.0) * 0.12 * rise;
      alpha *= 1.0 - rise * (1.0 - leave);
    }

    // stag colours: plum base → coffee body → gold antlers, matcha leaves
    vec3 c = mix(uPlum, uCoffee, smoothstep(0.0, 0.45, u));
    c = mix(c, uGold, smoothstep(0.45, 0.9, u));
    c = mix(c, uMatcha, leaf);
    // as they land: right-bound grains become the matcha, left-bound become the coffee;
    // the last grains to land form the crema / foam on top
    float m = smoothstep(0.0, 1.0, (uScroll - 0.1 - order * 0.34) / 0.14);
    float cold = leaf;
    c = mix(c, mix(uGrounds, uMatcha, cold), leave * 0.5);
    vec3 cupC = mix(uCoffeePos, uMatchaPos, cold);
    float cupS = mix(uCoffeeScale, uMatchaScale, cold);
    float aboveRim = smoothstep(0.92 * cupS, 1.06 * cupS, p.y - cupC.y);
    alpha *= mix(1.0, aboveRim, leave);
    c *= 0.85 + 0.3 * hash(seed * 13.0);
    // sculptural lighting while the stag is whole: key from the upper left, soft rim from behind
    vec3 n = texture2D(tNormal, aUv).xyz;
    float cs = cos(uRot), sn = sin(uRot);
    n = vec3(n.x * cs + n.z * sn, n.y, -n.x * sn + n.z * cs);
    vec3 L = normalize(vec3(-0.55, 0.7, 0.75));
    float lambert = max(dot(n, L), 0.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.0) * 0.35;
    float spec = pow(max(dot(normalize(L + vec3(0.0, 0.0, 1.0)), n), 0.0), 24.0) * 0.5;
    float lit = 0.55 + 0.85 * lambert + rim + spec;
    // grains at the back sit in shadow; front ones catch the light
    lit *= 0.75 + 0.25 * smoothstep(-0.4, 0.4, p.z);
    c *= mix(lit, 1.0, leave);
    vColor = c; vAlpha = alpha; vSeed = seed;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = (1.7 + 1.3 * hash(seed * 17.0)) * (1.0 + 0.35 * leaf) * (1.0 + 0.3 * m);
    gl_PointSize = sz * uScale * uGrain / -mv.z;
  }
`
const frag = /* glsl */ `
  varying float vAlpha, vSeed; varying vec3 vColor;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float a = atan(q.y, q.x);
    float r = length(q);
    // irregular bead outline, lit from the top-left
    float edge = 0.40 + 0.06 * sin(a * 3.0 + vSeed * 20.0) + 0.04 * sin(a * 5.0 + vSeed * 40.0);
    if (r > edge) discard;
    float shade = 0.8 + 0.45 * dot(normalize(q + 1e-4), vec2(-0.6, 0.8)) * (r / edge);
    float al = smoothstep(edge, edge - 0.1, r) * vAlpha;
    gl_FragColor = vec4(vColor * shade, al);
  }
`

type Textures = { homeA: DataTexture; homeB: DataTexture; pile: Float32Array; data: DataTexture; normal: DataTexture; start: DataTexture; geo: BufferGeometry }

function makeTex(arr: Float32Array) {
  const t = new DataTexture(arr, SIZE, SIZE, RGBAFormat, FloatType)
  t.minFilter = t.magFilter = NearestFilter
  t.needsUpdate = true
  return t
}


function useStagTextures(): Textures | null {
  const [tex, setTex] = useState<Textures | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/stag-points.bin')
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!alive) return
        const f = new Float32Array(buf)
        const n = SIZE * SIZE
        const homeA = new Float32Array(n * 4)
        const homeB = new Float32Array(n * 4)
        const data = new Float32Array(n * 4)
        const start = new Float32Array(n * 4)
        const normal = new Float32Array(n * 4)
        const uvs = new Float32Array(n * 2)
        let rs = 1
        const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647)
        for (let i = 0; i < n; i++) {
          const o = i * 9
          normal[i * 4] = f[o + 6]
          normal[i * 4 + 1] = f[o + 7]
          normal[i * 4 + 2] = f[o + 8]
          const seed = f[o + 5]
          homeA[i * 4] = f[o]
          homeA[i * 4 + 1] = f[o + 1]
          homeA[i * 4 + 2] = f[o + 2]
          data[i * 4] = f[o + 3]
          data[i * 4 + 1] = f[o + 4]
          data[i * 4 + 2] = seed
          // second home: a pile inside a cup. seed > .5 → cold cup (matcha), else hot cup (grounds)
          const cold = f[o + 4] > 0.5 // leaf grains are matcha
          const h = Math.pow(rnd(), 0.85) // 0..1 of the fill height
          data[i * 4 + 3] = h
          // spiral parameters: start angle, radius jitter, height jitter, cup
          homeB[i * 4] = rnd() * Math.PI * 2
          homeB[i * 4 + 1] = 0.8 + rnd() * 0.4
          homeB[i * 4 + 2] = rnd()
          homeB[i * 4 + 3] = cold ? 1 : 0
          // entrance: scattered above and to the right, off screen
          start[i * 4] = 0.5 + rnd() * 4
          start[i * 4 + 1] = 2.5 + rnd() * 4
          start[i * 4 + 2] = (rnd() - 0.5) * 2
          uvs[i * 2] = (i % SIZE) / SIZE + 0.5 / SIZE
          uvs[i * 2 + 1] = Math.floor(i / SIZE) / SIZE + 0.5 / SIZE
        }
        const geo = new BufferGeometry()
        geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
        geo.setAttribute('aUv', new BufferAttribute(uvs, 2))
        setTex({ homeA: makeTex(homeA), homeB: makeTex(homeB), pile: homeB, data: makeTex(data), normal: makeTex(normal), start: makeTex(start), geo })
      })
      .catch((e) => console.error('[stag] load failed', e))
    return () => {
      alive = false
    }
  }, [])
  return tex
}

const rt = { type: FloatType, minFilter: NearestFilter, magFilter: NearestFilter, format: RGBAFormat, depthBuffer: false, stencilBuffer: false }

export default function Stag({ layout = HERO_LAYOUT }: { layout?: StagLayout }) {
  const tex = useStagTextures()
  const shedAt = useRef(-1)
  const { gl, camera, size } = useThree()
  const pos0 = useFBO(SIZE, SIZE, rt)
  const pos1 = useFBO(SIZE, SIZE, rt)
  const vel0 = useFBO(SIZE, SIZE, rt)
  const vel1 = useFBO(SIZE, SIZE, rt)
  const flip = useRef(false)
  const reset = useRef(true)
  const simTime = useRef(0)
  const renderMat = useRef<ShaderMaterial>(null)
  const lastHit = useRef(new Vector3())
  const cursorVel = useRef(new Vector3())

  const sim = useMemo(() => {
    const scene = new Scene()
    const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const velMat = new ShaderMaterial({
      vertexShader: simVert,
      fragmentShader: velFrag,
      uniforms: {
        tPos: { value: null }, tVel: { value: null }, tHomeA: { value: null }, tHomeB: { value: null }, tData: { value: null },
        uTime: { value: 0 }, uSim: { value: 0 }, uDt: { value: 0 }, uScroll: { value: 0 }, uCursorOn: { value: 0 },
        uCursor: { value: new Vector3() }, uCursorVel: { value: new Vector3() }, uMatchaPos: { value: new Vector3() }, uCoffeePos: { value: new Vector3() },
        uRot: { value: 0 }, uPivot: { value: new Vector3() }, uStagScale: { value: 1 }, uShedT: { value: 99 }, uMatchaScale: { value: 1.35 }, uCoffeeScale: { value: 1.35 }, uDir: { value: 1 }, uPageY: { value: 0 }, uDiveStart: { value: 0.1 }, uDiveSpan: { value: P_CENTER - 0.1 - 0.05 }, uScrollRaw: { value: 0 },
      },
    })
    const posMat = new ShaderMaterial({
      vertexShader: simVert,
      fragmentShader: posFrag,
      uniforms: { tPos: { value: null }, tVel: { value: null }, tStart: { value: null }, uDt: { value: 0 }, uReset: { value: 1 } },
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), posMat)
    scene.add(quad)
    return { scene, cam, velMat, posMat, quad }
  }, [])

  const uniforms = useMemo(
    () => ({
      tPos: { value: null as null | DataTexture },
      tData: { value: null as null | DataTexture },
      tNormal: { value: null as null | DataTexture },
      uRot: { value: 0 },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uScrollRaw: { value: 0 },
      uScale: { value: 1 },
      uGrain: { value: 1 },
      uShedT: { value: 99 },
      uMatchaPos: { value: new Vector3() },
      uCoffeePos: { value: new Vector3() },
      uMatchaScale: { value: 1.5 },
      uCoffeeScale: { value: 1.5 },
      uCrema: { value: new Color('#b98a55') },
      uFoam: { value: new Color('#b9d59a') },
      uPlum: { value: new Color('#7c3c62') },
      uCoffee: { value: new Color('#9a6640') },
      uGold: { value: new Color('#e2c078') },
      uMatcha: { value: new Color('#7a9c55') },
      uGrounds: { value: new Color('#3a2217') },
    }),
    [],
  )

  useFrame((state, rawDt) => {
    if (!tex || !renderMat.current) return
    const dt = Math.min(rawDt, 1 / 30)
    const t = state.clock.elapsedTime
    const morph = scroll.smooth
    const rot = Math.sin(t * 0.35) * 0.14 + pointer.sx * 0.3

    // cursor on the z=0 plane, with velocity
    const v = new Vector3(pointer.x, pointer.y, 0.5).unproject(camera)
    const dir = v.sub(camera.position).normalize()
    const hit = camera.position.clone().add(dir.multiplyScalar(-camera.position.z / dir.z))
    cursorVel.current.lerp(hit.clone().sub(lastHit.current).divideScalar(Math.max(dt, 1e-3)), 0.35)
    lastHit.current.copy(hit)

    const posRead = flip.current ? pos1 : pos0
    const posWrite = flip.current ? pos0 : pos1
    const velRead = flip.current ? vel1 : vel0
    const velWrite = flip.current ? vel0 : vel1

    const { velMat, posMat, quad, scene, cam } = sim
    Object.assign(velMat.uniforms.tPos, { value: posRead.texture })
    velMat.uniforms.tVel.value = velRead.texture
    velMat.uniforms.tHomeA.value = tex.homeA
    velMat.uniforms.tHomeB.value = tex.homeB
    velMat.uniforms.uRot.value = rot
    velMat.uniforms.uPivot.value.set(layout.x, layout.y, 0)
    velMat.uniforms.uStagScale.value = layout.scale
    if (shedState.queued) {
      shedState.queued = false
      shedAt.current = t
    }
    velMat.uniforms.uShedT.value = shedAt.current < 0 ? 99 : t - shedAt.current
    velMat.uniforms.uMatchaPos.value.copy(cupsWorld.matcha.center)
    velMat.uniforms.uCoffeePos.value.copy(cupsWorld.coffee.center)
    velMat.uniforms.uMatchaScale.value = cupsWorld.matcha.scale
    velMat.uniforms.uDir.value = scroll.dir > 0 ? 1 : 0
    velMat.uniforms.uPageY.value = pageOffset()
    velMat.uniforms.uCoffeeScale.value = cupsWorld.coffee.scale
    velMat.uniforms.tData.value = tex.data
    velMat.uniforms.uTime.value = t
    simTime.current += dt
    velMat.uniforms.uSim.value = simTime.current
    velMat.uniforms.uDt.value = dt
    velMat.uniforms.uScroll.value = morph
    velMat.uniforms.uScrollRaw.value = scroll.progress
    velMat.uniforms.uCursorOn.value = pointer.son
    velMat.uniforms.uCursor.value.copy(hit)
    velMat.uniforms.uCursorVel.value.copy(cursorVel.current).clampLength(0, 6)
    quad.material = velMat
    gl.setRenderTarget(velWrite)
    gl.render(scene, cam)

    posMat.uniforms.tPos.value = posRead.texture
    posMat.uniforms.tVel.value = velWrite.texture
    posMat.uniforms.tStart.value = tex.start
    posMat.uniforms.uDt.value = dt
    posMat.uniforms.uReset.value = reset.current ? 1 : 0
    quad.material = posMat
    gl.setRenderTarget(posWrite)
    gl.render(scene, cam)
    if (reset.current) {
      // seed both buffers so the first real step reads valid positions (bind the other texture to avoid a feedback loop)
      posMat.uniforms.tPos.value = posWrite.texture
      gl.setRenderTarget(posRead)
      gl.render(scene, cam)
      reset.current = false
    }
    gl.setRenderTarget(null)
    flip.current = !flip.current

    if (import.meta.env.DEV) (window as unknown as { __stag: unknown }).__stag = { gl, posWrite, velWrite, tex, morph, t }
    const u = renderMat.current.uniforms
    u.tPos.value = posWrite.texture as unknown as DataTexture
    u.tData.value = tex.data
    u.tNormal.value = tex.normal
    u.uRot.value = rot
    u.uMatchaPos.value.copy(cupsWorld.matcha.center)
    u.uCoffeePos.value.copy(cupsWorld.coffee.center)
    u.uMatchaScale.value = cupsWorld.matcha.scale
    u.uCoffeeScale.value = cupsWorld.coffee.scale
    u.uTime.value = t
    u.uScroll.value = morph
    u.uScrollRaw.value = scroll.progress
    u.uScale.value = (size.height * state.viewport.dpr) / 120
    u.uGrain.value = Math.pow(layout.scale / HERO_LAYOUT.scale, 0.75) // smaller stag, finer grains
    u.uShedT.value = velMat.uniforms.uShedT.value
  })

  if (!tex) return null
  return (
    <points geometry={tex.geo} frustumCulled={false}>
      <shaderMaterial
        ref={renderMat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={NormalBlending}
      />
    </points>
  )
}
