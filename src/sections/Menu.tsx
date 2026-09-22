import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PHONE } from '../env'
import { LINKS } from '../links'

// The menu is the café's ordering page (Yousual): this section is the way in, staged like a short film on the purple.
// One screen, pinned for 320svh; the two real cups (scene/Landing.tsx) are the whole show, driven by page.act:
//   rise      the pair comes up out of the dive to the middle of the stage, coffee in front · "Coffee. Tea. Matcha."
//   trade     they change places, the matcha turning once on its way forward · what they do, in three lines
//   part      they step aside to either edge, and the door to the full menu stands between them
// Words come and go by --m (the section's scroll progress, scene/scroll.ts), each step fading in and out on its own.
const step = (a: number, b: number) => ({ '--a': a, '--b': b }) as React.CSSProperties

function Door() {
  return (
    <a className="menu-go display" href={LINKS.order} target="_blank" rel="noreferrer">
      See the<br />full menu
    </a>
  )
}

// On a phone there are no live cups: their photograph, the same words, and the door.
function PhoneMenu() {
  return (
    <section id="menu" className="menu-sec plum relative z-[6] px-6 pb-[16svh] pt-[12svh] text-center">
      <img className="menu-still" src="/cups-still.webp" alt="An iced matcha and an iced latte in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
      <h2 className="display reveal text-[11vw]">Coffee. Tea.<br />Matcha.</h2>
      <p className="display gold reveal menu-lines mt-8 text-[5.6vw]">Our own roast.<br />Ceremonial matcha.<br />Something sweet, too.</p>
      <p className="prose reveal mx-auto mt-8 max-w-[22rem]">Sizes, prices and today's special are all on the menu. Order ahead and it's waiting on the counter.</p>
      <div className="reveal mt-10"><Door /></div>
    </section>
  )
}

export default function Menu() {
  if (PHONE) return <PhoneMenu />
  return (
    <section id="menu" className="menu-sec plum relative z-[6] h-[320svh]">
      <div className="sticky top-0 h-lvh overflow-hidden">
        {/* without 3D (no WebGL, reduced motion): the cups' photograph stands where the live ones would */}
        <img className="menu-still" src="/cups-still.webp" alt="An iced matcha and an iced latte in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
        <div className="menu-step high" style={step(-0.3, 0.3)}>
          <h2 className="display text-[5.4vw]">Coffee. Tea. Matcha.</h2>
        </div>
        <div className="menu-step higher" style={step(0.27, 0.55)}>
          <p className="display gold menu-lines text-[2.2vw]">Our own roast.<br />Ceremonial matcha.<br />Something sweet, too.</p>
        </div>
        <div className="menu-step door pointer-events-auto" style={step(0.6, 1.6)}>
          <Door />
          <p className="prose mx-auto mt-8 max-w-[26rem]">Sizes, prices and today's special are all on the menu. Order ahead and it's waiting on the counter.</p>
        </div>
      </div>
    </section>
  )
}
