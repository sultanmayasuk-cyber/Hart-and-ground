import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useEffect } from 'react'
import { REDUCED } from '../env'

gsap.registerPlugin(ScrollTrigger)

// Smooth scrolling driven by GSAP's ticker so ScrollTrigger stays in sync.
export function useLenis() {
  useEffect(() => {
    if (REDUCED) return // plain scrolling for anyone who's asked for less motion
    const lenis = new Lenis({ anchors: true }) // (the nav links glide to their sections)
    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [])
}
