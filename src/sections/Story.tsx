import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'
import LogoLockup from '../LogoLockup'

// The story explains the name, so the name assembles as it's told. Left, pinned: a purple panel where the gold stag
// rises, then HART is uncovered, then GROUND, then the rest of the lockup (the real traced logo, uncovered left to
// right by --s). Right, scrolling past it: the four short chapters, each on clear cream. Nothing sits on top of anything.
export default function Story() {
  const wrap = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = wrap.current!
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 60%',
      end: 'bottom bottom',
      onUpdate: (s) => el.style.setProperty('--s', s.progress.toFixed(4)),
    })
    return () => st.kill()
  }, [])
  return (
    <section id="story" ref={wrap} className="story relative px-6 md:px-10">
      <div className="mx-auto grid max-w-[92rem] md:grid-cols-2 md:gap-[6vw]">
        <div className="story-side">
          <div className="story-panel plum">
            <span className="story-stag stag gold-bg" aria-hidden />
            <div className="story-lock">
              <LogoLockup className="gold w-full" />
            </div>
          </div>
        </div>
        <div className="story-text">
          <div className="chapter reveal">
            <h2 className="display">It began with the deer.</h2>
            <p className="prose">We started in Richmond, a short walk from the park and the red deer that have always lived in it.</p>
          </div>
          <div className="chapter reveal">
            <h2 className="display big">Hart</h2>
            <p className="prose">The old word for the stag. The warm heart of nature, where our coffee begins.</p>
          </div>
          <div className="chapter reveal">
            <h2 className="display big">Ground</h2>
            <p className="prose">The earth, the roast, and this quiet room on Sheen Lane.</p>
          </div>
          <div className="chapter reveal">
            <p className="prose">
              We built the café out of a simple love for good coffee, great memories and fine details. From the royal
              purple to the warm gold, everything here was made with care, for you.
            </p>
            <h2 className="display">Welcome to your daily pause.</h2>
          </div>
        </div>
      </div>
    </section>
  )
}
