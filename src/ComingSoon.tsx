import gsap from 'gsap'
import { lazy, Suspense, useEffect, useRef } from 'react'
import LogoLockup from './LogoLockup'

const CupDuo = lazy(() => import('./scene/CupDuo'))

// Pre-launch page, set like a poster: the headline bigger than the screen, the two real cups standing in front of it.
export default function ComingSoon() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Hart & Ground — Coming soon'
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.cs-head', { opacity: 0, duration: 1.6, ease: 'power2.out', delay: 1.2 }) // the logo arrives as one piece
      gsap.from('.cs-tag', { opacity: 0, duration: 1.8, delay: 2.2 })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={root} className="cs fixed inset-0 overflow-hidden select-none">
      {/* the headline itself is drawn in the 3D scene, so the cups can circle behind it */}
      <h1 className="sr-only">Hart &amp; Ground, Café &amp; Roasters, London. Coming soon.</h1>
      <Suspense fallback={null}>
        <CupDuo />
      </Suspense>
      <header className="cs-head absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-[1.4svh] pt-[3.5svh]">
        <span className="cs-mark block aspect-[505/470] h-[min(11svh,24vw)] bg-current" aria-hidden />
        <LogoLockup className="w-[min(44vw,12rem)]" />
      </header>
      <p className="cs-tag absolute inset-x-0 bottom-[5svh] z-20 text-center">Take the long way home.</p>
    </div>
  )
}
