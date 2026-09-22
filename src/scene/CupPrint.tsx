import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace } from 'three'

// The cup models (Meshy) are unit height, base at y = 0, with a straight tapered wall. Their baked logo came out chopped
// across the texture atlas, so it's painted out of the texture and printed here instead.
//   cold  the clear iced cup: wall up to the ribs at y ≈ 0.7, burgundy ink
//   hot   the paper cup built in PaperCup.tsx: the sleeve from y ≈ 0.1 to the rim bead at 0.94, gold foil
export type CupKind = 'cold' | 'hot'
const CUPS = {
  cold: { radius: (y: number) => 0.2525 + 0.0864 * y, ink: '#74203f', logo: [0.2, 0.66], line: [0.3, 0.36], foil: false },
  hot: { radius: (y: number) => 0.238 + 0.0899 * y, ink: '#e0b048', logo: [0.3, 0.69], line: [0.4, 0.46], foil: true },
} as const

// A band hugging the wall between heights y0..y1, `span` radians wide, centred on local +z (the cup's front).
function band(wallRadius: (y: number) => number, y0: number, y1: number, span: number) {
  const segU = 64
  const segV = 12
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= segV; j++) {
    const y = y0 + ((y1 - y0) * j) / segV
    const r = wallRadius(y) * 1.012
    for (let i = 0; i <= segU; i++) {
      const a = -span / 2 + (span * i) / segU
      pos.push(r * Math.sin(a), y, r * Math.cos(a))
      uv.push(i / segU, j / segV)
    }
  }
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      const b = a + segU + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function canvasTexture(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return { canvas, tex }
}

// the full logo (traced from brand/logo.svg), on the front, in the cup's ink
function useLogo(kind: CupKind) {
  return useMemo(() => {
    const { radius, ink, logo: [y0, y1] } = CUPS[kind]
    const geo = band(radius, y0, y1, (y1 - y0) / radius((y0 + y1) / 2)) // the artwork is square
    const { canvas, tex } = canvasTexture(1024, 1024)
    const img = new Image()
    img.onload = () => {
      const g = canvas.getContext('2d')!
      g.drawImage(img, 0, 0, 1024, 1024)
      g.globalCompositeOperation = 'source-in' // (the artwork is drawn in burgundy; recolour it)
      if (CUPS[kind].foil) {
        // foil: the gold's own tone, from amber to bright across the print, then a brushed mottle laid over it
        // (the shine itself comes from the metal mirroring the studio light, see FOIL_ENV)
        const grad = g.createLinearGradient(0, 0, 1024, 1024)
        grad.addColorStop(0, '#f0cc6a')
        grad.addColorStop(0.35, ink)
        grad.addColorStop(0.6, '#e9c257')
        grad.addColorStop(1, '#b07f2a')
        g.fillStyle = grad
        g.fillRect(0, 0, 1024, 1024)
        g.globalCompositeOperation = 'source-atop'
        let seed = 7
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
        for (let i = 0; i < 900; i++) {
          const x = rnd() * 1024
          const y = rnd() * 1024
          const w = 8 + rnd() * 60
          g.fillStyle = rnd() < 0.5 ? `rgba(255, 236, 170, ${0.05 + rnd() * 0.12})` : `rgba(120, 70, 10, ${0.04 + rnd() * 0.1})`
          g.beginPath()
          g.ellipse(x, y, w, 3 + rnd() * 6, -0.6, 0, Math.PI * 2)
          g.fill()
        }
      } else {
        g.fillStyle = ink
        g.fillRect(0, 0, 1024, 1024)
      }
      tex.needsUpdate = true
    }
    img.src = '/cup-logo.svg'
    return { geo, tex }
  }, [kind])
}

// the line they print on the back of the cup
function useLine(kind: CupKind, text: string) {
  return useMemo(() => {
    const { radius: wallRadius, ink, line: [y0, y1] } = CUPS[kind]
    const span = 1.4
    const geo = band(wallRadius, y0, y1, span)
    const W = 2048
    const H = Math.round((W * (y1 - y0)) / (wallRadius((y0 + y1) / 2) * span))
    const { canvas, tex } = canvasTexture(W, H)
    const draw = () => {
      const g = canvas.getContext('2d')!
      g.clearRect(0, 0, W, H)
      g.font = '600 100px "Crimson Pro", Georgia, serif'
      const size = Math.min(H * 0.8, (W * 0.7 * 100) / g.measureText(text).width)
      g.font = `600 ${size}px "Crimson Pro", Georgia, serif`
      g.fillStyle = ink
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, W / 2, H * 0.55)
      tex.needsUpdate = true
    }
    draw()
    document.fonts.load('600 100px "Crimson Pro"').then(draw, () => {})
    return { geo, tex }
  }, [kind, text])
}

// What the foil mirrors: a product-studio sky of its own, bright softboxes on a warm dark room, so the metal has
// something to shine with (the page's real environment is too dim from the cup's side and a true metal went muddy).
// Drawn once, as an equirectangular canvas.
function useFoilEnv() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const g = canvas.getContext('2d')!
    const sky = g.createLinearGradient(0, 0, 0, 256)
    sky.addColorStop(0, '#f4e4c0')
    sky.addColorStop(0.45, '#c9a86a')
    sky.addColorStop(0.7, '#a07a3c')
    sky.addColorStop(1, '#5a4020')
    g.fillStyle = sky
    g.fillRect(0, 0, 512, 256)
    const box = (x: number, y: number, w: number, h: number, a: number) => {
      const r = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h))
      r.addColorStop(0, `rgba(255, 250, 240, ${a})`)
      r.addColorStop(0.55, `rgba(255, 244, 225, ${a * 0.7})`)
      r.addColorStop(1, 'rgba(255, 240, 220, 0)')
      g.fillStyle = r
      g.save()
      g.translate(x, y)
      g.scale(w / Math.max(w, h), h / Math.max(w, h))
      g.translate(-x, -y)
      g.fillRect(x - Math.max(w, h), y - Math.max(w, h), Math.max(w, h) * 2, Math.max(w, h) * 2)
      g.restore()
    }
    box(150, 75, 220, 80, 1) // key softbox, upper left
    box(400, 100, 140, 110, 0.85) // fill, right
    box(256, 22, 480, 34, 0.8) // a strip light overhead
    const tex = new CanvasTexture(canvas)
    tex.mapping = EquirectangularReflectionMapping
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
}

export default function CupPrint({ kind = 'cold' }: { kind?: CupKind }) {
  const logo = useLogo(kind)
  const line = useLine(kind, 'Take the long way home.')
  const foilEnv = useFoilEnv()
  // ink soaks into the clear cup's print; foil is a metal, mirroring its own studio light with a brushed sheen
  const finish = CUPS[kind].foil ? { metalness: 1, roughness: 0.27, envMap: foilEnv, envMapIntensity: 1.9 } : { roughness: 0.45 }
  useEffect(
    () => () => {
      logo.geo.dispose()
      logo.tex.dispose()
      line.geo.dispose()
      line.tex.dispose()
      foilEnv.dispose()
    },
    [logo, line, foilEnv],
  )
  return (
    <>
      <mesh geometry={logo.geo} renderOrder={2}>
        <meshStandardMaterial map={logo.tex} transparent {...finish} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh geometry={line.geo} rotation-y={Math.PI} renderOrder={2}>
        <meshStandardMaterial map={line.tex} transparent {...finish} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </>
  )
}
