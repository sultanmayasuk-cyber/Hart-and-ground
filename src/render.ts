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

  // The cups' frames are spaced by motion, not by scroll: the stage is sampled finely, how far the cups move on
  // screen (and turn) between samples is summed up, and the frames are placed at equal steps of that, so every
  // frame-to-frame change is about the same small one (spaced evenly over the scroll, the trade moved them a long
  // way in a few frames, and blending two frames showed two cups). The frames' act values go in cups.json for the
  // player (scene/CupFrames.tsx).
  let acts: number[] = []
  if (seq === 'cups') {
    const w = (window as unknown as { __cups: { where: Record<'hot' | 'matcha', { x: number; y: number; z: number; s: number }> } }).__cups.where
    const SAMPLES = 400
    const at = (k: number) => (k / SAMPLES) * 4
    const place = () => {
      const p = (c: { x: number; y: number; z: number; s: number }) => {
        const d = 5.2 - c.z // the camera stands at z 5.2 (cups.ts CAM_Z)
        return [c.x / d, c.y / d, c.s / d] // (screen position and size, in the camera's own units)
      }
      return [...p(w.hot), ...p(w.matcha)]
    }
    const twirl = (act: number) => { const u = Math.min(1, Math.max(0, act - 1)); return u * u * (3 - 2 * u) } // (Landing.tsx: smooth(clamp01(act - 1)))
    const dist: number[] = [0]
    let prev: number[] | null = null
    let prevTw = 0
    for (let k = 0; k <= SAMPLES; k++) {
      page.act = at(k)
      for (let j = 0; j < 6; j++) tick()
      const cur = place()
      const tw = twirl(at(k))
      if (prev) {
        let d = 0
        for (let q = 0; q < 2; q++) {
          const o = q * 3
          // only what's on screen counts: the cup stands s tall on its base, the screen's half-height is tan(35°/2) ≈ 0.32
          const on = (c: number[]) => c[o + 1] + c[o + 2] > -0.36 && c[o + 1] < 0.36
          const vis = on(cur) || on(prev)
          if (!vis) continue
          d += Math.hypot(cur[o] - prev[o], cur[o + 1] - prev[o + 1]) + Math.abs(cur[o + 2] - prev[o + 2]) * 0.5
          d += Math.abs(tw - prevTw) * 2 * Math.PI * cur[o + 2] * 0.35 // a full turn moves the print round the cup's girth
        }
        dist.push(dist[k - 1] + d)
      }
      prev = cur
      prevTw = tw
      if (k % 40 === 0) say(`measuring the cups' motion ${k}/${SAMPLES}`)
      await wait(0)
    }
    const total = dist[SAMPLES]
    acts = [0]
    for (let i = 1; i < n - 1; i++) {
      const want = (i / (n - 1)) * total
      let k = 0
      while (k < SAMPLES && dist[k + 1] < want) k++
      const f = dist[k + 1] > dist[k] ? (want - dist[k]) / (dist[k + 1] - dist[k]) : 0
      acts.push(at(k + f))
    }
    acts.push(4)
    const res = await fetch(`${RECEIVER}/frames/cups/manifest`, { method: 'POST', body: JSON.stringify({ acts: acts.map((a) => +a.toFixed(4)) }) }).catch(() => null)
    say(`cups.json ${res?.ok ? 'saved' : 'NOT SAVED'} · motion ${total.toFixed(3)} over ${n} frames`)
    await wait(500)
  }

  for (let i = 0; i < n; i++) {
    if (seq === 'dive') page.dive = (i / (n - 1)) * DIVE.top
    else page.act = acts[i]
    for (let k = 0; k < TICKS; k++) tick()
    await wait(10)
    ctx.clearRect(0, 0, FRAME_W, FRAME_H)
    if (seq === 'dive') {
      ctx.fillStyle = '#f3ebe1'
      ctx.fillRect(0, 0, FRAME_W, FRAME_H)
    }
    ctx.drawImage(canvas, 0, 0, FRAME_W, FRAME_H)
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', seq === 'dive' ? 0.8 : 0.72))
    if (!blob) return say(`frame ${i}: no webp`)
    const res = await fetch(`${RECEIVER}/frames/${seq}/${i}`, { method: 'POST', body: blob }).catch(() => null)
    say(`${seq} ${i + 1}/${n} · ${Math.round(blob.size / 1024)} KB · ${res?.ok ? 'saved' : 'NOT SAVED (is `npm run frames` running?)'}`)
  }
  say(`${seq}: done, ${n} frames`)
  document.title = 'frames done'
}
