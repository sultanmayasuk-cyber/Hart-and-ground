// What this visitor's device can take. WEBGL: can it draw the 3D at all; without it the site stands still: a photograph
// of the hero cup in place of the dive, the cups' photograph beside the menu. REDUCED: they've asked their device to
// minimise motion (iOS Reduce Motion, which many iPhones have on: the café's own staff did, 2026-10-17, and saw only
// the photographs). They still get the 3D, since it moves only with their own scrolling; the scenes drop their own
// ambient motion (`STILL`) and Lenis's smoothing is off.
export const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const WEBGL = (() => {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') // (three r186 needs WebGL2)
    gl?.getExtension('WEBGL_lose_context')?.loseContext() // (the probe mustn't hold a context of its own)
    return !!gl
  } catch {
    return false
  }
})()
export const LIVE3D = WEBGL
// PHONE: held upright, narrow. Nearly everyone comes on a phone, so the menu's live cups are there too (2026-09-23),
// laid out for the narrow screen in Landing.tsx; only a device with no 3D at all gets the photograph.
export const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
export const LIVE_CUPS = LIVE3D
