import { advance } from '@react-three/fiber'
import { CUPS, DIVE, FRAME_H, FRAME_W } from './framesSpec'
import { page } from './scene/scroll'

// Dev: ?render=dive|cups draws the phones' frame sequences (framesSpec.ts) off the live scenes and posts each to
// `npm run frames` (scripts/frames-receiver.mjs), which writes them under public/frames/. Open it in a window whose
// page is 360×780 CSS px at a device pixel ratio of 2 (the built-in browser's phone preset resized, or Chrome's
// device toolbar): the canvases then are 720×1560, the frames' own size. The scenes run in their ?snap posture
// (no easing, the cups on their marks, every entrance already landed), and the page's own text and header are hidden
// (index.css .render). The scenes' frame loops are off (frameloop never): each frame is stepped by hand, several
// scene ticks of simulated time per frame so what's damped by time (the cups' turn) has settled, and nothing depends
// on requestAnimationFrame (which a hidden window starves).
const RECEIVER = 'http://localhost:5180'
const TICKS = 16 // scene ticks per frame
const TICK = 0.05 // seconds each
let started = false

export async function render(seq: 'dive' | 'cups') {
  if (started) return // (StrictMode runs the effect twice)
  started = true
  document.documentElement.classList.add('render')
  const log = document.createElement('pre')
  log.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;font:12px monospace;background:#000c;color:#0f0;padding:4px 7px;border-radius:6px'
  document.body.append(log)
  const say = (s: string) => (log.textContent = s)
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // the live canvas to take frames off, once its scene is ready
  const ready = () => {
    if (seq === 'dive') return !!(window as unknown as { __dive?: { ready: boolean } }).__dive?.ready
    return !!(window as unknown as { __cups?: { stage: { ready: boolean } } }).__cups?.stage.ready
  }
  say(`waiting for the ${seq} scene`)
  while (!ready()) await wait(200)
  await wait(1500)
  const canvas = document.querySelector<HTMLCanvasElement>(seq === 'dive' ? '#dive canvas' : '.fixed canvas')
  if (!canvas) return say('no canvas')
  if (canvas.width !== FRAME_W || canvas.height !== FRAME_H) say(`canvas is ${canvas.width}x${canvas.height}, frames want ${FRAME_W}x${FRAME_H}: size the window to 360x780 @2`)

  // the dive's frames are composited on the page's cream: nothing in them is see-through, but it costs nothing
  const out = document.createElement('canvas')
  out.width = FRAME_W
  out.height = FRAME_H
  const ctx = out.getContext('2d')!
  const n = seq === 'dive' ? DIVE.n : CUPS.n
  let t = 1
  const tick = () => advance((t += TICK))
  for (let k = 0; k < 8; k++) tick() // (the dive's warm-up frames)
  for (let i = 0; i < n; i++) {
    if (seq === 'dive') page.dive = (i / (n - 1)) * DIVE.top
    else page.act = (i / (n - 1)) * 4
    for (let k = 0; k < TICKS; k++) tick()
    await wait(10)
    ctx.clearRect(0, 0, FRAME_W, FRAME_H)
    if (seq === 'dive') {
      ctx.fillStyle = '#f3ebe1'
      ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    }
    ctx.drawImage(canvas, 0, 0, FRAME_W, FRAME_H)
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', seq === 'dive' ? 0.8 : 0.85))
    if (!blob) return say(`frame ${i}: no webp`)
    const res = await fetch(`${RECEIVER}/frames/${seq}/${i}`, { method: 'POST', body: blob }).catch(() => null)
    say(`${seq} ${i + 1}/${n} · ${Math.round(blob.size / 1024)} KB · ${res?.ok ? 'saved' : 'NOT SAVED (is `npm run frames` running?)'}`)
  }
  say(`${seq}: done, ${n} frames`)
  document.title = 'frames done'
}
