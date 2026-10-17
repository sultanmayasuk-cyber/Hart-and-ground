import { useEffect, useRef } from 'react'
import { onFrame } from '../frame'
import { CUPS } from '../framesSpec'
import { cover, damp, fit, Sequence } from './frames'
import { page } from './scroll'

// The phone's menu cups: the frames rendered off scene/Landing.tsx (public/frames/cups, `npm run frames`; alpha, the
// cups alone), on a transparent canvas fixed over the page like the live one, scrubbed by page.act (0 parked below
// .. 4 gone under the story), eased as the live stage eases it. Off the page entirely (display none, nothing drawn)
// while the cups are out of sight: a fixed full-screen layer costs the phone every frame it's there.
export const cupFrames = { i: 0, drawn: -1, decoded: 0, on: false } // (read by the ?fps readout)
;((window as unknown as { __frames?: Record<string, unknown> }).__frames ??= {}).cups = cupFrames
export default function CupFrames() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const seq = new Sequence(CUPS.dir, CUPS.n, CUPS.keep)
    let act = 0
    let last = performance.now()
    let drawn = -1
    let on = false
    const stop = onFrame(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      act = damp(act, page.act, 6, dt)
      const want = (page.act > 0.0005 || act > 0.0005) && (page.act < 3.999 || act < 3.999)
      if (want !== on) {
        on = want
        cupFrames.on = on
        c.style.display = on ? '' : 'none'
      }
      if (!on) return
      const i = Math.min(CUPS.n - 1, Math.round((act / 4) * (CUPS.n - 1)))
      cupFrames.i = i
      seq.focus(i)
      const resized = fit(c)
      if (i === drawn && !resized) return
      const got = seq.pick(i)
      if (!got) return
      if (got.i === drawn && !resized) return
      cover(ctx, got.bmp, true)
      drawn = got.i
      cupFrames.drawn = drawn
      cupFrames.decoded = seq.decoded
    })
    // the first frames come in while the dive still plays, so the cups' arrival can't wait on the network
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); seq.focus(0) } }, { rootMargin: '150% 0px' })
    const menu = document.getElementById('menu')
    if (menu) near.observe(menu)
    else seq.focus(0)
    return () => {
      stop()
      near.disconnect()
    }
  }, [])
  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-10 h-full w-full" style={{ display: 'none' }} />
}
