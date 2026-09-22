import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'
import Hours from '../Hours'
import { LINKS } from '../links'

// The Visit section's map: drawn by hand on a canvas from OpenStreetMap data baked by scripts/build-map.mjs
// (public/map/map.json; coordinates are metres east/north of the door). Scrolling zooms from the whole of west London,
// the Thames winding through it, down past Richmond Park and its deer to the door on Sheen Lane, with "the long way
// home" drawn in gold from the park to the café. One colour family: plum ink on the page's cream, gold for us.
type Line = number[]
type MapData = {
  route: Line
  wide: { river: Line[]; roads: Line[]; parks: Line[] }
  mid: { major: Line[]; minor: Line[]; paths: Line[]; rail: Line[]; green: Line[]; water: Line[]; stations: { name: string; p: number[] }[]; names: { name: string; p: number[]; a: number }[] }
  near: { buildings: Line[] }
}
type Boxed = { l: Line; x0: number; y0: number; x1: number; y1: number }

const PLUM = '58,23,48'
const GOLD = '#b08a4a'
const FAR = 15000 // metres from the centre to the screen's short edge, zoomed out
const CLOSE = 120 // and zoomed right in
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)
const fade = (v: number, a: number, b: number) => smooth(clamp01((v - a) / (b - a)))

const box = (ls: Line[]): Boxed[] =>
  ls.map((l) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < l.length; i += 2) {
      x0 = Math.min(x0, l[i]); x1 = Math.max(x1, l[i])
      y0 = Math.min(y0, l[i + 1]); y1 = Math.max(y1, l[i + 1])
    }
    return { l, x0, y0, x1, y1 }
  })

// deer in the park (metres from the door): the herds graze round Pen Ponds and the Sheen side
const DEER = [[-700, -1500], [-1350, -2300], [-250, -2500], [-1900, -3200], [-900, -3600], [-2100, -1900]]

export default function MapZoom() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ring = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const cv = canvas.current!
    const g = cv.getContext('2d')!
    let data: Record<string, Boxed[]> | null = null
    let raw: MapData | null = null
    let target = 0
    let p = -1
    let W = 0, H = 0, dpr = 1
    const stag = new Image()
    stag.src = '/brand-stag.svg'

    // (580 KB: fetched when the section is a couple of screens away, not with the page)
    const load = () => fetch('/map/map.json')
      .then((r) => r.json())
      .then((d: MapData) => {
        raw = d
        data = {
          river: box(d.wide.river), roads: box(d.wide.roads),
          parks: box(d.wide.parks.filter((l) => Math.hypot(l[0] - l[l.length - 2], l[1] - l[l.length - 1]) < 60)), // closed rings only
          major: box(d.mid.major), minor: box(d.mid.minor), paths: box(d.mid.paths), rail: box(d.mid.rail),
          green: box(d.mid.green), water: box(d.mid.water), buildings: box(d.near.buildings),
        }
        p = -1
      })

    const resize = () => {
      dpr = Math.min(devicePixelRatio, 1.5)
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = W * dpr; cv.height = H * dpr
      p = -1
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      if (!data || !raw) return
      // ease toward the scroll position, so the zoom carries weight
      const next = p < 0 ? target : p + (target - p) * 0.09
      if (Math.abs(next - p) < 2e-5) return
      p = next
      const z = smooth(clamp01(p / 0.86)) // the last stretch of scroll holds on the door
      const half = FAR * Math.pow(CLOSE / FAR, z) // metres to the short edge: exponential, so the zoom feels even
      const k = Math.min(W, H) / 2 / half // px per metre
      // the door sits right of centre on wide screens (the words have the left), and the view starts up-river, toward town
      const px = W * (W > 760 ? 0.64 : 0.5), py = H * (W > 760 ? 0.52 : 0.7)
      const drift = fade(half, 4500, 15000) // (only while the whole city is in view)
      // on the way down the view leans over to the park, then follows the walk back up to the door
      const park = fade(half, 9000, 3800) * (1 - fade(half, 1700, 500))
      const cx = 5200 * drift - 300 * park, cy = 2400 * drift - 1500 * park
      const X = (x: number) => px + (x - cx) * k
      const Y = (y: number) => py - (y - cy) * k
      const vx0 = cx - px / k, vx1 = cx + (W - px) / k, vy0 = cy - (H - py) / k, vy1 = cy + py / k

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      g.lineJoin = g.lineCap = 'round'
      const path = (set: Boxed[], close = false) => {
        g.beginPath()
        for (const b of set) {
          if (b.x1 < vx0 || b.x0 > vx1 || b.y1 < vy0 || b.y0 > vy1) continue
          const l = b.l
          g.moveTo(X(l[0]), Y(l[1]))
          for (let i = 2; i < l.length; i += 2) g.lineTo(X(l[i]), Y(l[i + 1]))
          if (close) g.closePath()
        }
      }
      const stroke = (set: Boxed[], a: number, w: number, dash?: number[]) => {
        if (a < 0.004) return
        path(set)
        g.setLineDash(dash ?? [])
        g.strokeStyle = `rgba(${PLUM},${a})`
        g.lineWidth = w
        g.stroke()
      }
      const fill = (set: Boxed[], a: number) => {
        if (a < 0.004) return
        path(set, true)
        g.fillStyle = `rgba(${PLUM},${a})`
        g.fill()
      }
      const label = (text: string, x: number, y: number, size: number, a: number, rot = 0, spacing = 0.22) => {
        if (a < 0.01) return
        g.save()
        g.translate(X(x), Y(y))
        g.rotate(rot)
        g.font = `500 ${size}px Cinzel, "Times New Roman", serif`
        g.letterSpacing = `${spacing}em`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillStyle = `rgba(${PLUM},${a})`
        g.fillText(text.toUpperCase(), 0, 0)
        g.restore()
      }

      const wide = 1 - fade(half, 900, 2600) // how much the city-scale drawing shows
      const mid = 1 - fade(half, 2600, 6000) // streets arrive
      const near = 1 - fade(half, 260, 700) // buildings arrive

      // the ground: parks and the park's woods, the river, then streets from faint to firm
      fill(data.parks, 0.11 * (1 - mid * 0.35))
      fill(data.green, 0.055 * mid)
      fill(data.water, 0.12 * mid)
      stroke(data.river, 0.16, Math.max(3, 190 * k))
      stroke(data.roads, 0.26 * wide, 1)
      fill(data.buildings, 0.14 * near)
      stroke(data.paths, 0.1 * mid * (1 - near), 0.7, [2, 3])
      stroke(data.minor, 0.2 * mid, Math.max(0.7, 7 * k))
      stroke(data.major, 0.34 * mid, Math.max(1.1, 11 * k))
      stroke(data.rail, 0.3 * mid, 1, [7, 5])

      // the deer, in the park
      const deerA = fade(half, 14000, 8000) * (1 - fade(half, 500, 900) * 0 - near)
      if (deerA > 0.01 && stag.complete) {
        const s = Math.max(13, Math.min(34, 260 * k))
        g.globalAlpha = deerA * 0.85
        for (const [dx, dy] of DEER) g.drawImage(stag, X(dx) - s / 2, Y(dy) - s / 2, s, s * (470 / 505))
        g.globalAlpha = 1
      }

      // the long way home, drawn out from the park to the door as the streets arrive
      const routeA = fade(half, 5200, 3600)
      if (routeA > 0.01) {
        const r = raw.route
        let total = 0
        for (let i = 2; i < r.length; i += 2) total += Math.hypot(r[i] - r[i - 2], r[i + 1] - r[i - 1])
        const shown = total * fade(half, 4200, 700)
        g.beginPath()
        g.moveTo(X(r[0]), Y(r[1]))
        let run = 0
        for (let i = 2; i < r.length && run < shown; i += 2) {
          const seg = Math.hypot(r[i] - r[i - 2], r[i + 1] - r[i - 1])
          const t = Math.min(1, (shown - run) / seg)
          g.lineTo(X(r[i - 2] + (r[i] - r[i - 2]) * t), Y(r[i - 1] + (r[i + 1] - r[i - 1]) * t))
          run += seg
        }
        g.setLineDash([1, 7])
        g.strokeStyle = GOLD
        g.globalAlpha = routeA
        g.lineWidth = 2.6
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
      }

      // names: few, and only while they help
      label('London', 9500, 4600, 13, 0.5 * fade(half, 7000, 11000))
      label('River Thames', 3300, 1500, 11, 0.45 * fade(half, 3500, 6000) * (1 - fade(half, 11000, 14000)), -0.5)
      label('Richmond Park', -1300, -2900, 12, 0.6 * fade(half, 9000, 6000) * (1 - fade(half, 1500, 900) * 0) * fade(half, 1100, 1900))
      label('Mortlake', -47, 210, 10, 0.5 * fade(half, 1500, 900) * (1 - near * 0.5))
      label('Sheen Lane', -22, -130, 10, 0.55 * near, -Math.PI / 2 + 0.08, 0.3)
      for (const n of raw.mid.names) {
        if (n.name === 'Sheen Lane' || Math.hypot(n.p[0], n.p[1]) > 330) continue
        let a = -n.a
        if (a > Math.PI / 2) a -= Math.PI
        if (a < -Math.PI / 2) a += Math.PI
        label(n.name, n.p[0], n.p[1], 8.5, 0.34 * near, a, 0.16)
      }

      // the door: a plum seal with the stag on it
      const pinS = 15 + 13 * fade(half, 2500, 200)
      g.beginPath()
      g.arc(X(0), Y(0), pinS, 0, Math.PI * 2)
      g.fillStyle = '#3a1730'
      g.fill()
      if (cream.complete) g.drawImage(cream, X(0) - pinS * 0.62, Y(0) - pinS * 0.6, pinS * 1.24, pinS * 1.24 * (470 / 505))
      // the gold ring breathing round it is a DOM element (CSS animation), so the map only redraws when it moves
      ring.current?.style.setProperty('translate', `${X(0)}px ${Y(0)}px`)
      ring.current?.style.setProperty('--s', `${pinS * 2}px`)
    }

    // the stag in cream, for the pin (the svg is plum)
    const cream = new Image()
    fetch('/brand-stag.svg')
      .then((r) => r.text())
      .then((s) => (cream.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(s.replace(/fill="#[0-9a-fA-F]+"/g, 'fill="#f3ebe1"'))))

    let visible = false
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(cv)
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); load() } }, { rootMargin: '200% 0px' })
    near.observe(wrap.current!)
    const tick = () => {
      if (visible) draw()
    }
    gsap.ticker.add(tick)
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => {
        target = s.progress
        wrap.current?.style.setProperty('--zoom', s.progress.toFixed(4))
      },
    })
    return () => {
      st.kill()
      io.disconnect()
      near.disconnect()
      gsap.ticker.remove(tick)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <section id="visit" ref={wrap} className="visit relative h-[420svh]">
      <div className="sticky top-0 h-lvh overflow-hidden">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
        <span ref={ring} className="pin-ring" aria-hidden />
        <div className="visit-copy pointer-events-none absolute inset-0 flex flex-col justify-start px-6 pt-[13svh] md:justify-center md:px-[7vw] md:pt-0">
          <div className="visit-step" style={{ '--a': -0.2, '--b': 0.3 } as React.CSSProperties}>
            <h2 className="display text-[10vw] md:text-[4.6vw]">Somewhere in<br />west London,</h2>
          </div>
          <div className="visit-step" style={{ '--a': 0.34, '--b': 0.62 } as React.CSSProperties}>
            <h2 className="display text-[10vw] md:text-[4.6vw]">a walk from<br />the deer,</h2>
            <p className="prose mt-6 max-w-[24rem]">Richmond Park is a short walk from the door. Come out by Sheen Gate and keep going. That is the long way home.</p>
          </div>
          <div className="visit-step pointer-events-auto" style={{ '--a': 0.7, '--b': 1.4 } as React.CSSProperties}>
            <h2 className="display text-[10vw] md:text-[4.6vw]">on Sheen Lane.</h2>
            <address className="prose mt-6 not-italic">
              Hart &amp; Ground<br />Sheen Lane, London SW14 8AD<br />Two minutes from Mortlake station
            </address>
            <Hours className="mt-5" />
            <p className="prose mt-5 flex flex-wrap gap-x-7 gap-y-2">
              <a className="link" href={LINKS.maps} target="_blank" rel="noreferrer">Directions</a>
              <a className="link" href={LINKS.phone}>{LINKS.phoneText}</a>
              <a className="link" href={LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
              <a className="link" href={LINKS.reviews} target="_blank" rel="noreferrer">Reviews</a>
            </p>
          </div>
        </div>
        <p className="absolute bottom-3 right-4 text-[10px] opacity-40">Map data © OpenStreetMap contributors</p>
      </div>
    </section>
  )
}
