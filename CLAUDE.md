# hartandground

3D marketing website. Vite + React + TypeScript, three.js via React Three Fiber + drei, GSAP (+ ScrollTrigger), Lenis smooth scroll, @react-three/postprocessing, leva, Tailwind CSS v4.

## Layout

- `src/scene/` — R3F canvas (`Scene.tsx`, fixed full-screen behind the page) and 3D components
- `src/hooks/useLenis.ts` — Lenis smooth scroll synced to GSAP's ticker / ScrollTrigger
- `src/index.css` — Tailwind entry (`@import "tailwindcss"`) plus base styles

## Constraints

- `react` / `react-dom` are pinned to `~19.2.0`: `@react-three/fiber` 9.7 requires `react >=19 <19.3`. Don't bump to 19.3 until fiber allows it.
- `postprocessing` requires `three < 0.187`; check before upgrading three.
- leva's panel is hidden outside dev (`import.meta.env.DEV`).

## Commands

- `npm run dev` / `npm run build` (tsc + vite) / `npm run lint` (oxlint)
