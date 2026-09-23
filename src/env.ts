// What this visitor's device can take. WEBGL: can it draw the 3D at all. REDUCED: they've asked their device to
// minimise motion. Without either, the site stands still: a photograph of the hero cup in place of the dive, no cups
// beside the menu, no smoothed scrolling. Everything else is the same page.
export const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const WEBGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()
export const LIVE3D = WEBGL && !REDUCED
// PHONE: held upright, narrow. Nearly everyone comes on a phone, so the menu's live cups are there too (2026-09-23),
// laid out for the narrow screen in Landing.tsx; only a device with no 3D at all gets the photograph.
export const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
export const LIVE_CUPS = LIVE3D
