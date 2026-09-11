import { lazy, Suspense, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLenis } from './hooks/useLenis'
import { PIN, useScrollProgress } from './scene/scroll'

const Scene = lazy(() => import('./scene/Scene'))

function Header() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
      <a href="#" className="flex items-center gap-3">
        <span className="mark h-9 w-9" aria-hidden />
        <span className="font-display text-[15px] tracking-[0.18em]">HART &amp; GROUND</span>
      </a>
      <nav className="hidden gap-9 text-[12px] tracking-[0.22em] uppercase md:flex">
        <a href="#drinks">Drinks</a>
        <a href="#story">Story</a>
        <a href="#visit">Visit</a>
      </nav>
      <a href="#visit" className="pill rounded-full border px-5 py-2 text-[12px] tracking-[0.18em] uppercase">
        Order
      </a>
    </header>
  )
}

gsap.registerPlugin(ScrollTrigger)

function App() {
  useLenis()
  useScrollProgress()
  const pinned = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!pinned.current) return
    // section two holds in place for one screen while the grains dive into the cups
    const st = ScrollTrigger.create({ trigger: pinned.current, start: 'top top', end: `+=${Math.round(PIN * 100)}%`, pin: true, pinSpacing: true })
    ScrollTrigger.refresh() // the pin adds a screen of scroll; re-measure the progress trigger
    return () => st.kill()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Header />
      <main className="ink">
        {/* 1 · hero */}
        <section className="hero-fade relative flex h-svh flex-col justify-center px-6 md:px-14">
          <div className="max-w-[46vw]">
            <h1 className="font-display text-[10vw] leading-[0.92] tracking-[0.03em] md:text-[7.2vw]">
              Hart
              <br />
              <span className="text-[#e2c078]">&amp;</span> Ground
            </h1>
            <p className="mt-6 max-w-xs text-sm leading-relaxed opacity-75 md:text-base">
              Coffee roasted with heat. Matcha grown in shade. Rich in simple moments.
            </p>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.32em] uppercase opacity-50">Scroll</div>
        </section>

        {/* 2 · the cups arrive on the right, copy on the left */}
        <section id="drinks" ref={pinned} className="flex h-svh flex-col justify-center px-6 md:px-14">
          <p className="text-[11px] tracking-[0.32em] uppercase opacity-60">Two cups · one counter</p>
          <h2 className="font-display mt-4 text-[9vw] leading-[0.95] tracking-[0.03em] md:text-[5.6vw]">
            Roasted
            <br />
            &amp; whisked.
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed opacity-75 md:text-base">
            Iced coffee from beans we roast ourselves. Iced matcha from leaves grown in shade. Same cup, two paths.
          </p>
        </section>

        {/* 3 · the cups circle down to the left, copy on the right */}
        <section id="story" className="flex h-svh flex-col items-end justify-center px-6 text-right md:px-14">
          <p className="text-[11px] tracking-[0.32em] uppercase opacity-60">Take the long way home</p>
          <h2 className="font-display mt-4 text-[9vw] leading-[0.95] tracking-[0.03em] md:text-[5.6vw]">
            Every stag
            <br />
            grows back.
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed opacity-75 md:text-base">
            A hart sheds its antlers every year and grows them again. Recharge yourself. 65A, London.
          </p>
          <a href="#visit" className="pill mt-8 rounded-full border px-6 py-3 text-[12px] tracking-[0.18em] uppercase">
            Find us
          </a>
        </section>
      </main>
    </>
  )
}

export default App
