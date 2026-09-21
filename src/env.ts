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
// On a phone held upright there's no room beside the menu for the two live cups (and a second 3D scene is a lot to ask
// of a phone): the menu shows a photograph of them instead. The dive stays live.
export const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
export const LIVE_CUPS = LIVE3D && !PHONE
