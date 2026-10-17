import { FRAME_H, FRAME_W, frameUrl } from '../framesSpec'

// A scroll-scrubbed image sequence (the phone's dive and menu cups, framesSpec.ts). Frames are fetched and decoded off
// the main thread (createImageBitmap), a few at a time, closest to where the page is first; only a window of them
// round the current frame is kept decoded (a 720×1560 bitmap is 4.5 MB: keeping them all would sink an older
// phone). A coarse set, every eighth frame at half size, is fetched early and kept for good, so a flick through the
// page always has something near to show while the exact frames come in.
const COARSE = 8
const PARALLEL = 4

export class Sequence {
  private full: (ImageBitmap | undefined)[]
  private half: (ImageBitmap | undefined)[]
  private failed = new Set<number>()
  private loading = new Map<number, 'full' | 'half'>()
  private at = 0
  private dir = 1
  private path: string
  n: number
  private keep: number
  constructor(path: string, n: number, keep: number) {
    this.path = path
    this.n = n
    this.keep = keep
    this.full = new Array(n)
    this.half = new Array(n)
  }

  // where the page is now (frame index, and which way it's going): keeps the window of decoded frames round it
  focus(i: number) {
    if (i !== this.at) this.dir = i > this.at ? 1 : -1
    this.at = i
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

  private pump() {
    while (this.loading.size < PARALLEL) {
      const next = this.next()
      if (!next) return
      this.load(next[0], next[1])
    }
  }

  // what to fetch next: the frame the page is on, then the ones ahead of it in the direction of travel, then behind;
  // the coarse set is filled in between (first frame first, so the page opens on something)
  private next(): [number, 'full' | 'half'] | null {
    const want = (i: number, kind: 'full' | 'half') => i >= 0 && i < this.n && !this.failed.has(i) && !this.loading.has(i) && !(kind === 'full' ? this.full[i] : this.half[i]) && !(kind === 'half' && this.full[i])
    if (want(0, 'full')) return [0, 'full']
    if (want(this.at, 'full')) return [this.at, 'full']
    for (let d = 1; d <= this.keep; d++) {
      if (want(this.at + d * this.dir, 'full')) return [this.at + d * this.dir, 'full']
      if (d % 3 === 0 && want(this.at - d * this.dir, 'full')) return [this.at - d * this.dir, 'full']
    }
    for (let k = 0; k < this.n; k += COARSE) if (want(k, 'half')) return [k, 'half']
    if (want(this.n - 1, 'half')) return [this.n - 1, 'half']
    for (let d = 1; d <= this.keep; d++) if (want(this.at - d * this.dir, 'full')) return [this.at - d * this.dir, 'full']
    return null
  }

  private async load(i: number, kind: 'full' | 'half') {
    this.loading.set(i, kind)
    try {
      const res = await fetch(frameUrl(this.path, i))
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      let bmp: ImageBitmap
      if (kind === 'half') {
        try {
          bmp = await createImageBitmap(blob, { resizeWidth: FRAME_W / 2, resizeHeight: FRAME_H / 2, resizeQuality: 'low' })
        } catch {
          bmp = await createImageBitmap(blob)
        }
      } else bmp = await createImageBitmap(blob)
      if (kind === 'full') {
        if (Math.abs(i - this.at) <= this.keep || i === 0) this.full[i] = bmp
        else bmp.close() // (the page has moved on since this was asked for)
      } else this.half[i] = bmp
    } catch {
      this.failed.add(i)
    } finally {
      this.loading.delete(i)
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
