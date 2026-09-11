import gsap from 'gsap'
import { lazy, Suspense, useEffect, useRef } from 'react'
import LogoLockup from './LogoLockup'
import { shed } from './scene/shed'

const ComingSoonScene = lazy(() => import('./scene/ComingSoonScene'))

// Pre-launch page: the logo, alive. The stag is the grain simulation; the lettering is traced from the logo.
// Tapping anywhere makes the hart shed its antlers; they grow back from the base up.
export default function ComingSoon() {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Hart & Ground — Coming soon'
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.cs-line', { opacity: 0, y: 24, duration: 1.8, stagger: 0.2, ease: 'expo.out', delay: 1.2 })
      gsap.from('.cs-soon', { opacity: 0, duration: 2, delay: 2.6 })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    // three rows: the logo centred, "Coming soon" at the foot of the last row so the two can never overlap
    <div ref={root} onPointerDown={() => shed()} className="cs fixed inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center select-none">
      <Suspense fallback={null}>
        <ComingSoonScene stage={stage} />
      </Suspense>
      <div className="cs-logo row-start-2 flex flex-col items-center">
        {/* the stag stands in here (same aspect as the point cloud); it leads, the lettering sits smaller beneath */}
        <div ref={stage} className="aspect-[2.7/2.4] w-full" />
        <LogoLockup className="mt-[4%] w-[72%] sm:w-[62%]" />
      </div>
      <p className="cs-soon row-start-3 self-end pb-[5svh] pl-[0.4em] text-[11px] tracking-[0.4em] uppercase opacity-60">Coming soon</p>
    </div>
  )
}
