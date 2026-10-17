// The frame sequences a phone gets instead of the live 3D (env.ts FRAMES), shared by the players (scene/DiveFrames.tsx,
// scene/CupFrames.tsx) and the renderer that draws them (render.ts). Both are portrait, 9:19.5, and drawn to cover
// the screen; the dive's frames are opaque (the counter and the drink fill the picture), the cups' have alpha (they
// stand over the latte paper). Regenerate with `npm run frames` whenever either scene changes.
export const FRAME_W = 720
export const FRAME_H = 1560
export const DIVE = { dir: '/frames/dive', n: 120, top: 0.998 } // top: the last frame's page.dive (at 1 nothing is drawn)
export const CUPS = { dir: '/frames/cups', n: 64 }
export const frameUrl = (dir: string, i: number) => `${dir}/${String(i).padStart(3, '0')}.webp`
