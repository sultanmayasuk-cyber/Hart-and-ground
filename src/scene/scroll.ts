import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect } from 'react'

// What the scene needs to know about the page, written by ScrollTriggers in App.tsx and read every frame by the cups.
// dive: progress through the hero dive (Dive.tsx), 0..1.
// act: which mark the cups are at: 0 waiting below (during the dive), 1 drinks (coffee in front), 2 drinks (matcha in front),
// 3 gone below the counter.
export const page = { dive: 0, act: 0 }

export function useScrollDriver() {
  useEffect(() => {
    const seg = (p: number, a: number, b: number) => {
      const u = Math.min(1, Math.max(0, (p - a) / (b - a)))
      return u * u * (3 - 2 * u)
    }
    let hero = 0
    let drinks = 0
    let story = 0
    const set = () => (page.act = hero + seg(drinks, 0, 1) + story)
    const el = document.getElementById('dive')
    const hdr = document.querySelector('.hdr')
    const dive = ScrollTrigger.create({
      trigger: '#dive',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => {
        page.dive = s.progress
        el?.style.setProperty('--dive', s.progress.toFixed(4))
        hdr?.classList.toggle('in-dive', s.progress < 0.97)
        hdr?.classList.toggle('on-dark', s.progress > 0.25 && s.progress < 0.72) // cream over the dark of the drink
      },
    })
    // the cups rise with the menu as it comes up over the end of the dive
    const a = ScrollTrigger.create({ trigger: '#menu', start: 'top 70%', end: 'top 5%', onUpdate: (s) => { hero = s.progress; set() } })
    // they trade places as the Matcha Collection comes up the page
    const b = ScrollTrigger.create({ trigger: '#cat-matcha', start: 'top 72%', end: 'top 38%', onUpdate: (s) => { drinks = s.progress; set() } })
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
