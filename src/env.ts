// What this visitor's device can take.
// PHONE: held upright, narrow. Nearly everyone comes on a phone, and a phone gets no WebGL at all (2026-10-17: the
// live 3D took 2.75 MB and two GL contexts' worth of compiling before the loader could lift, and the café's own phones
// froze on it). Instead the dive and the menu cups are image sequences rendered off the real scenes (scene/frames.ts,
// public/frames/), scrubbed by the scroll: nothing to compile, nothing to download beyond the frames in reach.
// WEBGL: can it draw the 3D at all; a wide screen without it stands still: a photograph of the hero cup in place of
// the dive, the cups' photograph beside the menu. REDUCED: they've asked their device to minimise motion; the scenes
// drop their own ambient motion (`STILL`) and Lenis's smoothing is off, but the 3D stays (it moves only with their
// own scrolling; iOS Reduce Motion is common, and the staff with it on saw only the photographs).
// RENDER (dev): ?render=dive|cups draws the frames the phones get (src/render.ts): the live scene in a phone's frame.
export const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const RENDER = import.meta.env.DEV ? (new URLSearchParams(location.search).get('render') as 'dive' | 'cups' | null) : null
export const WEBGL = (() => {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext() // (the probe mustn't keep a context of its own)
    return !!gl
  } catch {
    return false
  }
})()
export const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
export const FRAMES = PHONE && !RENDER
// LITE: the phone's own live 3D, when it does run (only while rendering the frames): the frames are drawn at the
// desktop's quality, so this is off there
export const LITE = PHONE && !RENDER
export const LIVE3D = WEBGL && !FRAMES
export const LIVE_CUPS = LIVE3D
