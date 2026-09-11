// Shared, damped pointer state. Scene reads it every frame; the DOM reads `seam` for the split text.
export const pointer = {
  x: 0, // -1..1 (target)
  y: 0,
  sx: 0, // damped
  sy: 0,
  on: 0, // 1 while a mouse is over the page or a finger is down
  son: 0, // damped
}

export function damp(cur: number, target: number, lambda: number, dt: number) {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt))
}
