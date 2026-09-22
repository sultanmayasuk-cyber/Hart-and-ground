import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LIVE3D, LIVE_CUPS, PHONE } from './env'
import { clock, HOURS } from './openingHours'
import { PHONE_QUOTES } from './quotes'
import { useLenis } from './hooks/useLenis'
import { LINKS } from './links'
import LogoLockup from './LogoLockup'
import { useScrollDriver } from './scene/scroll'
import Loyalty from './sections/Loyalty'
import MapZoom from './sections/MapZoom'
import Menu from './sections/Menu'
import Story from './sections/Story'

const Landing = lazy(() => import('./scene/Landing'))
const Dive = lazy(() => import('./scene/Dive'))

gsap.registerPlugin(ScrollTrigger)

// Always open at the top: a reload otherwise comes back part-way into the dive, with the headline already sliding off.
if (!location.hash) {
  history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
}

// The site, "Through the Glass": it opens on one iced latte and dives into it (scene/Dive.tsx), comes out on the
// counter with the whole menu (the two real cups beside it, scene/Landing.tsx), tells the name's story on the brand's
// purple and gold, stamps the wallet card, and zooms a hand-drawn map from London down to the door on Sheen Lane.
export default function App() {
  useLenis()
  useScrollDriver()
  const root = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(!LIVE3D) // the 3D is on screen (or there is none to wait for)

  useEffect(() => {
    document.title = 'Hart & Ground · Café & Roasters, London'
    document.fonts.ready.then(() => ScrollTrigger.refresh()) // (the fonts reflow the page; the scroll marks follow)
    const ticks: (() => void)[] = [] // (page-following work to unhook with the context)
    const ctx = gsap.context(() => {
      // The header wears the colour of the page under it, so text scrolling past can't run through the nav. The page
      // is blocks of cream and purple; where a block's edge is inside the band, the band is split at that exact line,
      // so it never shows one colour over the other. (Blurring the backdrop instead was silently a no-op in some
      // browsers.) The lettering follows the colour under it.
      const hdr = document.querySelector<HTMLElement>('.hdr')
      const blocks = [...document.querySelectorAll<HTMLElement>('main > section, footer')]
      const colour = (el: HTMLElement) => (el.classList.contains('plum') ? '#3a1730' : '#f3ebe1')
      let last = ''
      const band = () => {
        if (!hdr) return
        const reach = hdr.offsetHeight + 24 // the band, plus its fade
        let under = colour(blocks[0])
        let split = ''
        for (let i = 0; i < blocks.length; i++) {
          const top = blocks[i].getBoundingClientRect().top
          if (top <= 0) under = colour(blocks[i])
          else if (top < reach) {
            split = `linear-gradient(${under} ${top}px, ${colour(blocks[i])} ${top}px)`
            break
          }
        }
        const next = split || under
        if (next === last) return
        last = next
        hdr.style.setProperty('--band', next)
        // the lettering: the colour under the middle of the nav
        const mid = hdr.offsetHeight / 2
        let at = colour(blocks[0])
        for (const b of blocks) if (b.getBoundingClientRect().top <= mid) at = colour(b)
        hdr.classList.toggle('on-plum', at === '#3a1730')
      }
      band()
      window.addEventListener('scroll', band, { passive: true })
      window.addEventListener('resize', band)
      ticks.push(band)
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      for (const el of gsap.utils.toArray<HTMLElement>('.reveal'))
        gsap.from(el, { opacity: 0, y: 26, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
    }, root)
    return () => {
      ctx.revert()
      for (const t of ticks) {
        window.removeEventListener('scroll', t)
        window.removeEventListener('resize', t)
      }
    }
  }, [])

  // on a phone the header gets out of the way while you read down the page, and comes back the moment you scroll up
  useEffect(() => {
    if (!PHONE) return
    const hdr = document.querySelector('.hdr')
    let last = scrollY
    const on = () => {
      const y = scrollY
      if (Math.abs(y - last) < 6) return
      hdr?.classList.toggle('away', y > last && y > 120)
      last = y
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // ?fps: a frame-rate readout in the corner, for checking devices (worst and average over the last second)
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('fps')) return
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:600 13px/1.2 monospace;background:#000c;color:#0f0;padding:4px 7px;border-radius:6px;pointer-events:none'
    document.body.append(el)
    let last = performance.now(), n = 0, worst = 0, since = last, raf = 0
    const tick = (t: number) => {
      worst = Math.max(worst, t - last)
      last = t
      n++
      if (t - since > 1000) {
        const cv = document.querySelector<HTMLCanvasElement>('#dive canvas')
        el.textContent = `${Math.round((n * 1000) / (t - since))} fps · worst ${Math.round(worst)} ms · ${cv?.width}x${cv?.height} @${devicePixelRatio}`
        n = 0
        worst = 0
        since = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.remove()
    }
  }, [])

  // the loader lifts when the cup is ready to be set down (scene/Dive.tsx says so), or after a few seconds regardless;
  // the headline rises as it goes
  useEffect(() => {
    if (!LIVE3D) return
    const done = () => setLoaded(true)
    window.addEventListener('hg-ready', done)
    const t = setTimeout(done, 7000)
    return () => {
      window.removeEventListener('hg-ready', done)
      clearTimeout(t)
    }
  }, [])
  useEffect(() => {
    if (!loaded || !LIVE3D) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-copy .line > span', { yPercent: 115, duration: 1.5, ease: 'power4.out', stagger: 0.12, delay: 0.25 })
      gsap.from('.hero-sub', { opacity: 0, y: 14, duration: 1.4, ease: 'power3.out', delay: 1.1 })
    }, root)
    return () => ctx.revert()
  }, [loaded])

  return (
    <div ref={root} className={`site ${LIVE3D ? '' : 'no-dive'} ${LIVE_CUPS ? '' : 'no-cups'}`}>
      {LIVE3D && (
        <div className={`loader ${loaded ? 'gone' : ''}`} aria-hidden>
          <span className="stag" />
        </div>
      )}
      {LIVE_CUPS && (
        <Suspense fallback={null}>
          <Landing />
        </Suspense>
      )}

      <header className="hdr fixed inset-x-0 top-0 z-20 grid grid-cols-[auto_1fr] items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_auto_1fr] md:px-10 md:py-5">
        <a href="#dive" className="justify-self-start" aria-label="Hart & Ground">
          <span className="stag block aspect-[505/470] h-8 bg-current md:h-10" aria-hidden />
        </a>
        <nav className="nav flex justify-end gap-4 sm:justify-center md:gap-10">
          <a href="#menu">Menu</a>
          <a href="#story">Story</a>
          <a href="#rewards">Rewards</a>
          <a href="#visit">Visit</a>
        </nav>
        <a className="nav hidden justify-self-end sm:block" href={LINKS.order} target="_blank" rel="noreferrer">Order</a>
      </header>

      <main>
        {/* 1 · the dive (scene/Dive.tsx): the opening words stand with the cup, then the camera goes in */}
        <section id="dive" className={`dive relative ${LIVE3D ? (PHONE ? 'h-[400svh]' : 'h-[620svh]') : 'h-svh'}`}>
          <div className="sticky top-0 h-lvh overflow-hidden">
            {/* the words stand either side of the cup, like a poster: the opening line on the left, high; where, on the right, low */}
            <div className="hero-copy pointer-events-none absolute inset-0 z-[4]">
              <h1 className="display">
                <span className="hero-l"><span className="line"><span>A little</span></span><span className="line"><span>escape</span></span></span>
                <span className="hero-r"><span className="line"><span>in</span></span><span className="line"><span>Richmond.</span></span></span>
              </h1>
              <p className="prose hero-sub">Specialty coffee, ceremonial matcha and desserts, on Sheen Lane.</p>
            </div>
            {LIVE3D ? (
              <>
                <Suspense fallback={null}>
                  <Dive />
                </Suspense>
                {/* on a phone the cup lines are set in the page, not in the 3D: sharp at any size, and free */}
                {PHONE && (
                  <div className="dive-quotes" aria-hidden>
                    {PHONE_QUOTES.map((q, i) => (
                      <p key={q} className={`display dq ${i >= 5 ? 'on-milk' : ''}`} style={{ '--a': 0.33 + i * 0.068, '--b': 0.33 + i * 0.068 + 0.15, '--x': [-1, 1, -0.4, 0.8, -0.9, 0.5, -0.6, 0.9][i], '--z': [1, 0.78, 0.9, 0.72, 1, 0.8, 0.92, 0.76][i] } as React.CSSProperties}>
                        <span>{q}</span>
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <img className="absolute inset-0 h-full w-full object-cover" src="/hero-still.jpg" alt="A Hart & Ground iced latte" />
            )}
          </div>
        </section>

        <Menu />
        <Story />
        <Loyalty />
        <MapZoom />
      </main>

      <footer id="footer" className="plum relative flex flex-col items-center px-6 pb-10 pt-[16svh] text-center md:px-10">
        <span className="stag gold-bg block aspect-[505/470] h-[min(16svh,30vw)]" aria-hidden />
        <LogoLockup className="gold mt-8 w-[min(64vw,22rem)]" />
        <p className="display gold mt-[9svh] text-[7vw] md:text-[2.6vw]">Take the long way home.</p>
        <nav className="nav mt-[9svh] flex flex-wrap justify-center gap-x-9 gap-y-3">
          <a href={LINKS.order} target="_blank" rel="noreferrer">Order</a>
          <a href={LINKS.rewards} target="_blank" rel="noreferrer">Rewards</a>
          <a href={LINKS.maps} target="_blank" rel="noreferrer">Directions</a>
          <a href={LINKS.reviews} target="_blank" rel="noreferrer">Reviews</a>
          <a href={LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={LINKS.snapchat} target="_blank" rel="noreferrer">Snapchat</a>
          <a href={LINKS.phone}>{LINKS.phoneText}</a>
        </nav>
        <p className="prose small mt-[8svh]">
          {HOURS.map((h) => `${h.days} ${clock(h.open)} – ${clock(h.close)}`).join(' · ')}
        </p>
        <p className="prose small mt-2">Sheen Lane, London SW14 8AD · © 2026 Hart &amp; Ground</p>
      </footer>
    </div>
  )
}
