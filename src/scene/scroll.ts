import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect } from 'react'

// What the scene needs to know about the page, written by ScrollTriggers in App.tsx and read every frame by the cups.
// dive: progress through the hero dive (Dive.tsx), 0..1.
// act: which mark the cups are at: 0 waiting below (during the dive), 1 centre stage (coffee in front), 2 traded (matcha
// in front), 3 parted to either edge round the door to the menu, 4 gone below the counter.
export const page = { dive: 0, act: 0 }
;(window as unknown as { __page?: typeof page }).__page = page // (read by the ?fps readout)

export function useScrollDriver() {
  useEffect(() => {
    const seg = (p: number, a: number, b: number) => {
      const u = Math.min(1, Math.max(0, (p - a) / (b - a)))
      return u * u * (3 - 2 * u)
    }
    let hero = 0
    let drinks = 0
    let part = 0
    let story = 0
    const set = () => (page.act = hero + drinks + part + story)
    const el = document.getElementById('dive')
    const menu = document.getElementById('menu')
    const hdr = document.querySelector('.hdr')
    const dive = ScrollTrigger.create({
      trigger: '#dive',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => {
        page.dive = s.progress
        el?.style.setProperty('--dive', s.progress.toFixed(4))
        hdr?.classList.toggle('in-dive', s.progress < 0.88) // (the menu's top passes the nav from ~0.91: the band must be there)
        hdr?.classList.toggle('on-dark', s.progress > 0.25 && s.progress < 0.72) // cream over the dark of the drink
      },
    })
    // the cups rise with the menu as it comes up over the end of the dive
    const a = ScrollTrigger.create({ trigger: '#menu', start: 'top 70%', end: 'top 5%', onUpdate: (s) => { hero = s.progress; set() } })
    // the menu stage is pinned: over its scroll the cups trade places, then part round the door to the full menu
    // (a phone's menu section isn't pinned and has no live cups; the trigger is harmless there)
    const b = ScrollTrigger.create({
      trigger: '#menu',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => {
        const p = s.progress
        menu?.style.setProperty('--m', p.toFixed(4))
        drinks = seg(p, 0.24, 0.5)
        part = seg(p, 0.52, 0.74)
        set()
      },
    })
    // the cups sink under the page as the story arrives
    const c = ScrollTrigger.create({ trigger: '#story', start: 'top bottom', end: 'top 25%', onUpdate: (s) => { story = seg(s.progress, 0, 1); set() } })
    return () => {
      dive.kill()
      a.kill()
      b.kill()
      c.kill()
    }
  }, [])
}

// World units per viewport height at z=0 for the fixed camera (fov 35, z 5.2).
export const VIEW_H = 2 * Math.tan((35 * Math.PI) / 360) * 5.2
