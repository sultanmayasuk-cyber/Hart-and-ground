import { FRAME_H, FRAME_W, frameUrl } from '../framesSpec'

// A scroll-scrubbed image sequence (the phone's dive and menu cups, framesSpec.ts). Every frame is fetched and decoded
// as soon as the sequence is wanted, the frame the page is on first, then ahead of it, then the rest: a few MB over
// HTTP/2, decoded a couple at a time through plain <img> elements (img.decode(); createImageBitmap was slow on iOS
// and a window of decoded bitmaps round the current frame never kept up with a scroll, 2026-10-17: it fell back to
// every eighth frame, which stepped). The browser keeps the decoded pictures and re-decodes one if it ever has to
// let it go. Until a frame is in, the nearest decoded one stands in for it.
const FETCHES = 12
const DECODES = 2

export class Sequence {
  private img: (HTMLImageElement | undefined)[]
  private bytes: (Blob | undefined)[]
  private fetching = new Set<number>()
  private decoding = new Set<number>()
  private failed = new Set<number>()
  private at = 0
  private dir = 1
  private started = false
  private path: string
  n: number
  constructor(path: string, n: number) {
    this.path = path
    this.n = n
    this.img = new Array(n)
    this.bytes = new Array(n)
  }

  // where the page is now (frame index, and which way it's going): what to fetch and decode next
  focus(i: number) {
    if (i !== this.at) this.dir = i > this.at ? 1 : -1
    this.at = i
    this.started = true
    this.pump()
  }

  // the best frame there is for i: the exact one, else the nearest decoded one
  pick(i: number): { img: HTMLImageElement; i: number } | null {
    const exact = this.img[i]
    if (exact) return { img: exact, i }
    for (let d = 1; d < this.n; d++) {
      const a = this.img[i + d]
      if (a) return { img: a, i: i + d }
      const b = this.img[i - d]
      if (b) return { img: b, i: i - d }
    }
    return null
  }

  get decoded() {
    return this.img.filter(Boolean).length
  }
  get fetched() {
    return this.bytes.filter(Boolean).length
  }

  private pump() {
    if (!this.started) return
    // the frame the page is on, then ahead of it (a little behind too), then everything else in index order
    const order: number[] = []
    const seen = new Set<number>()
    const add = (i: number) => { if (i >= 0 && i < this.n && !seen.has(i)) { seen.add(i); order.push(i) } }
    add(this.at)
    for (let d = 1; d <= 24; d++) { add(this.at + d * this.dir); if (d % 3 === 0) add(this.at - d * this.dir) }
    for (let k = 0; k < this.n; k++) add(k)
    for (const i of order) {
      if (this.fetching.size >= FETCHES) break
      if (!this.bytes[i] && !this.fetching.has(i) && !this.failed.has(i)) this.fetch(i)
    }
    for (const i of order) {
      if (this.decoding.size >= DECODES) break
      if (this.bytes[i] && !this.img[i] && !this.decoding.has(i) && !this.failed.has(i)) this.decode(i)
    }
  }

  private async fetch(i: number) {
    this.fetching.add(i)
    try {
      const res = await fetch(frameUrl(this.path, i))
      if (!res.ok) throw new Error(String(res.status))
      this.bytes[i] = await res.blob()
    } catch {
      this.failed.add(i)
    } finally {
      this.fetching.delete(i)
      this.pump()
    }
  }

  private async decode(i: number) {
    this.decoding.add(i)
    const url = URL.createObjectURL(this.bytes[i]!)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      this.img[i] = img
    } catch {
      this.failed.add(i)
    } finally {
      URL.revokeObjectURL(url)
      this.decoding.delete(i)
      this.pump()
    }
  }
}

// Draw a frame to cover the canvas, like object-fit: cover (the frames are 9:19.5; phones run 16:9 to 19.5:9, and
// the picture is composed for the middle of the screen).
export function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, clear: boolean) {
  const { width: W, height: H } = ctx.canvas
  const s = Math.max(W / FRAME_W, H / FRAME_H)
  const w = FRAME_W * s
  const h = FRAME_H * s
  if (clear) ctx.clearRect(0, 0, W, H)
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

// size the canvas to its box, at the device's pixels (capped: the frames are 720 across)
export function fit(c: HTMLCanvasElement) {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const w = Math.round(c.clientWidth * dpr)
  const h = Math.round(c.clientHeight * dpr)
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
    return true
  }
  return false
}

export const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))
