import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PHONE } from '../env'
import { LINKS } from '../links'

// The menu is the café's ordering page (Yousual): this section is the way in, staged like a short film on warm latte
// paper (the tone their cups are photographed on; the purple fought the burgundy cup).
// One screen, pinned for 320svh; the two real cups (scene/Landing.tsx) are the whole show, driven by page.act:
//   rise      the pair comes up out of the dive to the middle of the stage, coffee in front · "Coffee. Tea. Matcha."
//   trade     they change places, the matcha turning once on its way forward
//   part      they step aside to either edge, and the door to the full menu stands between them
// Words come and go by --m (the section's scroll progress, scene/scroll.ts), each step fading in and out on its own.
const step = (a: number, b: number) => ({ '--a': a, '--b': b }) as React.CSSProperties

// the door: the words, then a solid gold button that can't be mistaken for anything else
function Door({ big }: { big?: boolean }) {
  return (
    <>
      <h2 className={`display ${big ? 'text-[11vw]' : 'text-[4.6vw]'}`}>The full menu</h2>
      <p className="prose mx-auto mt-6 max-w-[24rem]">Sizes, prices and today's special, all of it. Order ahead and it's waiting on the counter.</p>
      <a className="btn-gold display" href={LINKS.order} target="_blank" rel="noreferrer">
        Open the menu <span aria-hidden>→</span>
      </a>
    </>
  )
}

// On a phone there are no live cups: their photograph, the same words, and the door.
function PhoneMenu() {
  return (
    <section id="menu" className="menu-sec latte relative z-[6] px-6 pb-[9svh] pt-[10svh] text-center">
      <img className="menu-still" src="/cups-still.webp" alt="A flat white and an iced matcha in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
      <div className="reveal"><Door big /></div>
    </section>
  )
}

export default function Menu() {
  if (PHONE) return <PhoneMenu />
  return (
    <section id="menu" className="menu-sec latte relative z-[6] h-[320svh]">
      <div className="sticky top-0 h-lvh overflow-hidden">
        {/* without 3D (no WebGL, reduced motion): the cups' photograph stands where the live ones would */}
        <img className="menu-still" src="/cups-still.webp" alt="A flat white and an iced matcha in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
        <div className="menu-step high" style={step(-0.3, 0.3)}>
          <h2 className="display text-[5.4vw]">Coffee. Tea. Matcha.</h2>
        </div>
        <div className="menu-step door pointer-events-auto" style={step(0.6, 1.6)}>
          <Door />
        </div>
      </div>
    </section>
  )
}
