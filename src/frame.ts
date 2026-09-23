// A frame loop of our own. Per-frame work (the canvases' on/off switch, the map's redraw) used to hang off gsap's ticker;
// on iOS Safari that listener never fired (the cups canvas was only ever drawn when the toolbar resized it, 2026-09-23).
export function onFrame(fn: () => void) {
  let id = requestAnimationFrame(function loop() {
    fn()
    id = requestAnimationFrame(loop)
  })
  return () => cancelAnimationFrame(id)
}
