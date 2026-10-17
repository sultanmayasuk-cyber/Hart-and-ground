import { useEffect, useRef } from 'react'
import { onFrame } from '../frame'
import { DIVE, frameUrl } from '../framesSpec'
import { cover, damp, fit, Sequence } from './frames'
import { page } from './scroll'

// The phone's dive: the frames rendered off scene/Dive.tsx (public/frames/dive, `npm run frames`), scrubbed by the
// page. The first frame is a plain image under the canvas so the cup is there with the first paint; the canvas draws
// over it as soon as the frame is decoded. The camera's progress is eased the same way the live one is (Dive.tsx Rig),
// and written to the cup lines (.dive-quotes --p) as there.
export const diveFrames = { i: 0, drawn: -1, decoded: 0, fetched: 0 } // (read by the ?fps readout)
;((window as unknown as { __frames?: Record<string, unknown> }).__frames ??= {}).dive = diveFrames
export default function DiveFrames() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const seq = new Sequence(DIVE.dir, DIVE.n)
    const lines = document.querySelector<HTMLElement>('.dive-quotes')
    let p = 0
    let last = performance.now()
    let drawn = -1
    seq.focus(0)
    window.dispatchEvent(new Event('hg-ready'))
    const stop = onFrame(() => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      // asleep once the dive is scrolled past and the camera has caught up (the menu is over it by then)
      if (page.dive >= 0.999 && Math.abs(p - page.dive) < 1e-4) return
      p = damp(p, page.dive, 3.2, dt)
      lines?.style.setProperty('--p', p.toFixed(4))
      const i = Math.min(DIVE.n - 1, Math.round((p / DIVE.top) * (DIVE.n - 1)))
      diveFrames.i = i
      seq.focus(i)
      diveFrames.fetched = seq.fetched
      diveFrames.decoded = seq.decoded
      const resized = fit(c)
      if (i === drawn && !resized) return
      const got = seq.pick(i)
      if (!got) return
      if (got.i === drawn && !resized) return
      cover(ctx, got.img, false)
      drawn = got.i
      diveFrames.drawn = drawn
      diveFrames.decoded = seq.decoded
    })
    return stop
  }, [])
  return (
    <div className="absolute inset-0">
      <img className="absolute inset-0 h-full w-full object-cover" src={frameUrl(DIVE.dir, 0)} alt="" aria-hidden fetchPriority="high" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
