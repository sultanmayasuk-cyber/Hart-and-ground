import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'
import { LINKS } from '../links'
import LogoLockup from '../LogoLockup'

// Rewards: one pinned screen on the purple. The words and the gold button stand still on the left the whole way through;
// on the right the card as it sits in your phone's wallet is stamped by the scroll, one stag at a time, and the last
// stamp turns it over to the reward. The card leans toward the cursor. Phones: words, card, button in a column.
const STAMPS = 8
export default function Loyalty() {
  const wrap = useRef<HTMLElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: wrap.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => wrap.current?.style.setProperty('--p', s.progress.toFixed(4)),
    })
    let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0
    const move = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2
      ty = (e.clientY / innerHeight - 0.5) * 2
    }
    let seen = false
    const io = new IntersectionObserver(([e]) => (seen = e.isIntersecting))
    if (wrap.current) io.observe(wrap.current)
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!seen) return
      rx += (tx - rx) * 0.06
      ry += (ty - ry) * 0.06
      card.current?.style.setProperty('--rx', rx.toFixed(3))
      card.current?.style.setProperty('--ry', ry.toFixed(3))
    }
    window.addEventListener('pointermove', move, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      st.kill()
      io.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [])
  return (
    <section id="rewards" ref={wrap} className="rewards plum relative h-[260svh]">
      <div className="sticky top-0 h-lvh overflow-hidden">
        <span className="rw-glow" aria-hidden />
        <div className="rw-grid">
          {/* the words and the way in stand still the whole time; only the card moves */}
          <div className="rw-copy">
            <h2 className="display rw-title">Eight stamps.<br />Then one on us.</h2>
            <a className="btn-gold display" href={LINKS.rewards} target="_blank" rel="noreferrer">
              Get your card <span aria-hidden>→</span>
            </a>
          </div>
          <div className="card-stage">
            <div ref={card} className="card">
              <div className="card-face card-front">
                <div className="flex items-start justify-between">
                  <span className="stag gold-bg block aspect-[505/470] h-14" aria-hidden />
                  <LogoLockup className="gold h-10 w-auto" />
                </div>
                <div className="stamps">
                  {Array.from({ length: STAMPS }, (_, i) => (
                    <span key={i} className="slot" style={{ '--i': i } as React.CSSProperties}>
                      <span className="stag ink" aria-hidden />
                    </span>
                  ))}
                </div>
                <p className="card-line">Eight stamps, then one on the house</p>
              </div>
              <div className="card-face card-back">
                <span className="stag gold-bg block aspect-[505/470] h-24" aria-hidden />
                <p className="display gold mt-6 text-[clamp(1.4rem,2.4vw,2.2rem)]">This one's on us.</p>
                <p className="card-line mt-3">Take the long way home.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
