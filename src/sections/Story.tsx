import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'
import LogoLockup from '../LogoLockup'

// The story explains the name, so the name assembles as it's told. One pinned screen: left, a purple panel where the
// gold stag rises, then HART is uncovered, then GROUND, then the rest of the lockup (the real traced logo, by --s);
// right, on clear cream, the chapters come and go one at a time beside it, the closing line last. Nothing ever sits on
// top of the stag. (A finale where the panel grew to fill the screen was tried and dropped, 2026-09-22.)
const step = (a: number, b: number) => ({ '--a': a, '--b': b }) as React.CSSProperties

export default function Story() {
  const wrap = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = wrap.current!
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => el.style.setProperty('--s', s.progress.toFixed(4)),
    })
    return () => st.kill()
  }, [])
  return (
    <section id="story" ref={wrap} className="story relative h-[340svh]">
      <div className="story-stage">
        <div className="story-panel">
          <div className="story-art">
            <span className="story-stag stag gold-bg" aria-hidden />
            <div className="story-lock">
              <LogoLockup className="gold w-full" />
            </div>
          </div>
        </div>
        <div className="story-step" style={step(-0.3, 0.24)}>
          <h2 className="display">It began with the deer.</h2>
          <p className="prose">We started in Richmond, a short walk from the park and the red deer that have always lived in it.</p>
        </div>
        <div className="story-step" style={step(0.26, 0.48)}>
          <h2 className="display big">Hart</h2>
          <p className="prose">The old word for the stag. The warm heart of nature, where our coffee begins.</p>
        </div>
        <div className="story-step" style={step(0.5, 0.72)}>
          <h2 className="display big">Ground</h2>
          <p className="prose">The earth, the roast, and this quiet room on Sheen Lane.</p>
        </div>
        <div className="story-step" style={step(0.78, 1.6)}>
          <h2 className="display">Welcome to your daily pause.</h2>
        </div>
      </div>
    </section>
  )
}
