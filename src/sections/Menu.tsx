import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PHONE } from '../env'
import { LINKS } from '../links'
import { BITES, DRINKS, type Category } from './menuData'

// The menu, set like the café's own printed one: the royal purple, gold heads, cream lines. The two real cups stand in
// the left half (scene/Landing.tsx), lit against the purple: coffee in front while the coffee is read, matcha from the
// Matcha Collection on.
function Card({ c }: { c: Category }) {
  return (
    <div id={`cat-${c.id}`} className="cat reveal">
      <div className="cat-head">
        <h3 className="display gold">{c.title}</h3>
        {c.sizes && <span>{c.sizes}</span>}
      </div>
      {c.groups.map((g, i) => (
        <div key={i}>
          {g.title && <h4>{g.title}</h4>}
          <ul>
            {g.items.map((it) => (
              <li key={it.name}>
                <span className="name">{it.name}</span>
                <span className="dots" aria-hidden />
                <span className="price">{it.price}</span>
                {it.note && <em>{it.note}</em>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// On a phone the menu isn't set out here: the café's ordering page (Yousual) is built for a phone, so this is a short
// invitation and a way in.
function PhoneMenu() {
  return (
    <section id="menu" className="menu-sec plum relative z-[6] px-6 pb-[14svh] pt-[12svh] text-center">
      <img className="menu-still" src="/cups-still.webp" alt="An iced matcha and an iced latte in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
      <h2 className="display reveal text-[11vw]">Coffee. Tea.<br />Matcha.</h2>
      <p className="prose reveal mx-auto mt-6 max-w-[22rem]">
        Our own roast, ceremonial matcha, smoothies, pastries and desserts. Everything is made to order, hot or over ice.
      </p>
      <a className="menu-cta display reveal" href={LINKS.order} target="_blank" rel="noreferrer">See the menu</a>
    </section>
  )
}

export default function Menu() {
  if (PHONE) return <PhoneMenu />
  return (
    <section id="menu" className="menu-sec plum relative z-[6] px-6 pb-[18svh] pt-[20svh] md:px-10">
      {/* where the live cups can't stand (phones, no 3D): their photograph */}
      <img className="menu-still" src="/cups-still.webp" alt="An iced matcha and an iced latte in Hart & Ground cups" onLoad={() => ScrollTrigger.refresh()} />
      <div className="menu-inner md:ml-[40vw]">
        <h2 className="display reveal text-[11vw] md:text-[5.4vw]">Coffee. Tea.<br />Matcha.</h2>
        <p className="prose reveal mt-7 max-w-[30rem]">
          Our own roast, ceremonial matcha, and something sweet to go beside it. Everything is made to order, hot or over ice.
        </p>
        <div className="mt-[9svh] grid gap-x-12 gap-y-[7svh] lg:grid-cols-2">
          {DRINKS.map((c) => <Card key={c.id} c={c} />)}
          <div className="cat reveal seasonal">
            <h3 className="display gold">Seasonal Special</h3>
            <p>Ask us about today's signature.</p>
          </div>
        </div>
        <h2 className="display reveal mt-[12svh] text-[9vw] md:text-[3.6vw]">And to eat.</h2>
        <div className="mt-[6svh] grid gap-x-12 gap-y-[7svh] lg:grid-cols-2">
          {BITES.map((c) => <Card key={c.id} c={c} />)}
        </div>
        <p className="prose reveal mt-[12svh]">
          <a className="link gold" href={LINKS.order} target="_blank" rel="noreferrer">Order ahead</a>
        </p>
      </div>
    </section>
  )
}
