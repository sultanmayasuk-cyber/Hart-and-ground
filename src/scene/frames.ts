import { FRAME_H, FRAME_W, frameUrl } from '../framesSpec'

// A scroll-scrubbed image sequence (the phone's dive and menu cups, framesSpec.ts). All the bytes come down as soon
// as the sequence is wanted (a few MB, many requests at once over HTTP/2: on a real connection fetching only round the
// current frame fell behind a flick and showed every eighth frame, 2026-10-17), and are kept as blobs. Decoding is
// what's rationed: a 720×1560 bitmap is 4.5 MB, so only a window of frames round the current one is kept decoded
// (createImageBitmap, off the main thread), decoding ahead in the direction of travel; plus every eighth frame at
// half size, decoded as soon as its bytes land and kept, so a flick past the window always has something near to show.
const COARSE = 8
const FETCHES = 12
const DECODES = 3

export class Sequence {
  private bytes: (Blob | undefined)[]
  private full: (ImageBitmap | undefined)[]
  private half: (ImageBitmap | undefined)[]
  private fetching = new Set<number>()
  private decoding = new Set<string>()
  private failed = new Set<number>()
  private at = 0
  private dir = 1
  private started = false
  private path: string
  n: number
  private keep: number
  constructor(path: string, n: number, keep: number) {
    this.path = path
    this.n = n
    this.keep = keep
    this.bytes = new Array(n)
    this.full = new Array(n)
    this.half = new Array(n)
  }

  // where the page is now (frame index, and which way it's going): keeps the window of decoded frames round it
  focus(i: number) {
    if (i !== this.at) this.dir = i > this.at ? 1 : -1
    this.at = i
    this.started = true
    for (let k = 0; k < this.n; k++) {
      const b = this.full[k]
      if (b && Math.abs(k - i) > this.keep) {
        b.close()
        this.full[k] = undefined
      }
    }
    this.pump()
  }

  // the best frame there is for i: the exact one, else the nearest decoded one (half size if that's all there is)
  pick(i: number): { bmp: ImageBitmap; i: number } | null {
    const exact = this.full[i]
    if (exact) return { bmp: exact, i }
    let best: { bmp: ImageBitmap; i: number } | null = null
    let dist = Infinity
    for (let k = 0; k < this.n; k++) {
      const b = this.full[k] ?? this.half[k]
      if (!b) continue
      const d = Math.abs(k - i)
      if (d < dist) {
        dist = d
        best = { bmp: b, i: k }
      }
    }
    return best
  }

  get decoded() {
    return this.full.filter(Boolean).length
  }
  get fetched() {
    return this.bytes.filter(Boolean).length
  }

  private pump() {
    if (!this.started) return
    // bytes: the frame the page is on, then ahead of it, then behind, then everything else, in index order
    const order: number[] = []
    const seen = new Set<number>()
    const add = (i: number) => { if (i >= 0 && i < this.n && !seen.has(i)) { seen.add(i); order.push(i) } }
    add(this.at)
    for (let d = 1; d <= this.keep * 2; d++) { add(this.at + d * this.dir); if (d % 2 === 0) add(this.at - d * this.dir) }
    for (let k = 0; k < this.n; k++) add(k)
    for (const i of order) {
      if (this.fetching.size >= FETCHES) break
      if (!this.bytes[i] && !this.fetching.has(i) && !this.failed.has(i)) this.fetch(i)
    }
    // decoding: the window round the current frame (ahead first), and the coarse set
    for (const i of order) {
      if (this.decoding.size >= DECODES) break
      if (Math.abs(i - this.at) > this.keep) continue
      if (this.bytes[i] && !this.full[i] && !this.decoding.has(`f${i}`)) this.decode(i, 'full')
    }
    for (let k = 0; k < this.n; k += COARSE) {
      if (this.decoding.size >= DECODES + 1) break
      if (this.bytes[k] && !this.half[k] && !this.decoding.has(`h${k}`)) this.decode(k, 'half')
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

  private async decode(i: number, kind: 'full' | 'half') {
    const key = `${kind[0]}${i}`
    this.decoding.add(key)
    try {
      const blob = this.bytes[i]!
      let bmp: ImageBitmap
      if (kind === 'half') {
        try {
          bmp = await createImageBitmap(blob, { resizeWidth: FRAME_W / 2, resizeHeight: FRAME_H / 2, resizeQuality: 'low' })
        } catch {
          bmp = await createImageBitmap(blob)
        }
      } else bmp = await createImageBitmap(blob)
      if (kind === 'half') this.half[i] = bmp
      else if (Math.abs(i - this.at) <= this.keep) this.full[i] = bmp
      else bmp.close() // (the page has moved on since this was asked for)
    } catch {
      this.failed.add(i)
    } finally {
      this.decoding.delete(key)
      this.pump()
    }
  }
}

// Draw a frame to cover the canvas, like object-fit: cover (the frames are 9:19.5; phones run 16:9 to 19.5:9, and
// the picture is composed for the middle of the screen).
export function cover(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, clear: boolean) {
  const { width: W, height: H } = ctx.canvas
  const s = Math.max(W / FRAME_W, H / FRAME_H)
  const w = FRAME_W * s
  const h = FRAME_H * s
  if (clear) ctx.clearRect(0, 0, W, H)
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h)
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
