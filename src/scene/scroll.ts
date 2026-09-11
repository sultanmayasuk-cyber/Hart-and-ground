import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect } from 'react'

// Single source of truth: page scroll progress 0..1. `smooth` is a damped copy for the simulation
// so reversing direction never snaps particles around.
export const scroll = { progress: 0, smooth: 0, dir: 1 }

export function useScrollProgress() {
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'max',
      onUpdate: (self) => {
        scroll.dir = self.progress >= scroll.progress ? 1 : -1
        scroll.progress = self.progress
      },
    })
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      scroll.smooth += (scroll.progress - scroll.smooth) * (1 - Math.exp(-7 * dt))
      document.documentElement.style.setProperty('--p', scroll.smooth.toFixed(4))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      st.kill()
      cancelAnimationFrame(raf)
    }
  }, [])
}

// World units per viewport height at z=0 for the fixed hero camera (fov 35, z 5.2), and how far the
// page has scrolled in world units. 3D objects add this to their y to scroll with the DOM.
export const VIEW_H = 2 * Math.tan((35 * Math.PI) / 360) * 5.2
export const PIN = 0.45 // section two holds for this fraction of a screen
export const PAGE_SCREENS = 2 + PIN // hero + section two (+ hold) + section three
export const P_CENTER = 1 / PAGE_SCREENS // progress where section two is centred (hold starts)
export const P_HOLD_END = (1 + PIN) / PAGE_SCREENS
export const pageOffset = () => scroll.smooth * PAGE_SCREENS * VIEW_H

export type Keys = [number, number][]
export function kf(keys: Keys, t: number): number {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]
    if (t <= t1) {
      const [t0, v0] = keys[i - 1]
      const u = (t - t0) / (t1 - t0)
      const e = u * u * (3 - 2 * u)
      return v0 + (v1 - v0) * e
    }
  }
  return keys[keys.length - 1][1]
}
