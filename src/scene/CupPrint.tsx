import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, CanvasTexture, SRGBColorSpace } from 'three'

// The cup models (Meshy) are unit height, base at y = 0, with a straight tapered wall up to the ribs at y ≈ 0.7.
// Their baked logo came out chopped across the texture atlas, so it's painted out of the texture and printed here instead.
const wallRadius = (y: number) => 0.2525 + 0.0864 * y
const INK = '#74203f' // the burgundy Hart & Ground print their cups in

// A band hugging the wall between heights y0..y1, `span` radians wide, centred on local +z (the cup's front).
function band(y0: number, y1: number, span: number) {
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

// the full logo (traced from brand/logo.svg), on the front
function useLogo() {
  return useMemo(() => {
    const y0 = 0.2
    const y1 = 0.66
    const geo = band(y0, y1, (y1 - y0) / wallRadius((y0 + y1) / 2)) // the artwork is square
    const { canvas, tex } = canvasTexture(1024, 1024)
    const img = new Image()
    img.onload = () => {
      canvas.getContext('2d')!.drawImage(img, 0, 0, 1024, 1024)
      tex.needsUpdate = true
    }
    img.src = '/cup-logo.svg'
    return { geo, tex }
  }, [])
}

// the line they print on the back of the cup
function useLine(text: string) {
  return useMemo(() => {
    const y0 = 0.3
    const y1 = 0.36
    const span = 1.4
    const geo = band(y0, y1, span)
    const W = 2048
    const H = Math.round((W * (y1 - y0)) / (wallRadius((y0 + y1) / 2) * span))
    const { canvas, tex } = canvasTexture(W, H)
    const draw = () => {
      const g = canvas.getContext('2d')!
      g.clearRect(0, 0, W, H)
      g.font = '600 100px "Crimson Pro", Georgia, serif'
      const size = Math.min(H * 0.8, (W * 0.7 * 100) / g.measureText(text).width)
      g.font = `600 ${size}px "Crimson Pro", Georgia, serif`
      g.fillStyle = INK
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, W / 2, H * 0.55)
      tex.needsUpdate = true
    }
    draw()
    document.fonts.load('600 100px "Crimson Pro"').then(draw, () => {})
    return { geo, tex }
  }, [text])
}

export default function CupPrint() {
  const logo = useLogo()
  const line = useLine('Take the long way home.')
  useEffect(
    () => () => {
      logo.geo.dispose()
      logo.tex.dispose()
      line.geo.dispose()
      line.tex.dispose()
    },
    [logo, line],
  )
  return (
    <>
      <mesh geometry={logo.geo} renderOrder={2}>
        <meshStandardMaterial map={logo.tex} transparent roughness={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh geometry={line.geo} rotation-y={Math.PI} renderOrder={2}>
        <meshStandardMaterial map={line.tex} transparent roughness={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
    </>
  )
}
