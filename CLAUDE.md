# hartandground

3D marketing website. Vite + React + TypeScript, three.js via React Three Fiber + drei, GSAP (+ ScrollTrigger), Lenis smooth scroll, @react-three/postprocessing, leva, Tailwind CSS v4.

## Layout

- `src/main.tsx` — picks the page: the coming-soon page by default (what's live), the full site with `VITE_COMING_SOON=false` in `.env.local`. To launch, flip the default there.
- `src/ComingSoon.tsx` + `src/scene/CupDuo.tsx` — the live coming-soon page: logo header, "COMING SOON" drawn as a plane in the 3D scene (so cups can pass behind the letters), the two cups (spring-driven motion, periodic swap ride round the word), counter reflection
- `src/App.tsx` — the full site, concept "Through the Glass": dive (hero, 620svh) / menu / story / rewards (300svh) / visit map (420svh) / footer. Cream and the royal purple alternate (dive cream, menu purple, story mist→purple, rewards purple, map cream, footer purple); gold only on purple.
- `src/scene/Dive.tsx` — the hero dive, its own sticky canvas (frameloop demand). Opens like a poster: the latte in the middle, the headline split either side of it (DOM, `.hero-copy`), ice adrift round it (`Adrift`), real clear ice heaped on top (`Heap`, drops in on load; covers the model's baked ice, which fails up close). Scroll (`page.dive`) pushes in until the stag on the wall fills the screen, climbs over the rim (fov widens 30→60), the coffee closes in from the edges (`Veil`, an iris) to hide the cut to the interior (built at y = -60): ice (transmission), bubbles, espresso billowing into milk (shader on a sphere round the camera), then cream out into the page. The first 4 frames render from inside behind the veil to warm the GPU. Dev: `?snap` removes easing for frame checks.
- `src/scene/Landing.tsx` — the menu section's two cups, fixed transparent canvas: `scene/scroll.ts` → `page.act` (0 parked below during the dive, 1 coffee in front, 2 matcha in front from `#cat-matcha`, 3 sunk at the story). Deliberately does not look like the coming-soon page.
- Tried and rejected by the user (2026-09-21), don't re-propose: wipeable condensation on the hero cup (it veiled the logo and didn't read as wipeable), a "latte taken apart" section, an ice-drop game.
- `src/sections/` — `Menu.tsx` + `menuData.ts` (the café's printed menu + bites; purple with gold heads like their own menu; rises over the end of the dive with `margin-top: -55svh` so there's no blank stretch), `Story.tsx` (left: sticky purple panel where the gold stag rises and the real lockup is uncovered HART → GROUND → full, by `--s`; right: four plain chapters scrolling past. The user rejected text laid over stag graphics), `Loyalty.tsx` (pinned 400svh on purple: big wallet card, stamps pressed by scroll `--p`, flips to the reward; links to yousual loyalty), `MapZoom.tsx` (canvas map zooming London → Richmond Park deer → the door; data `public/map/map.json` built by `node scripts/build-map.mjs` from OpenStreetMap, keep the © credit).
- Cups: `public/models/{coffee,matcha}.glb` are Meshy models (unit height, base at y=0). Their baked logo was painted out of the textures; `CupPrint.tsx` prints the real logo (`public/cup-logo.svg`) and the back line on the wall, `cupFinish.ts` adds the ice/condensation/rim shader finish. Use both wherever the cups appear.
- Brand lettering: `src/LogoLockup.tsx` (traced from `brand/logo.svg`) and `public/brand-stag.svg`; always one colour, never a font imitation.
- `src/hooks/useLenis.ts` — Lenis smooth scroll synced to GSAP's ticker / ScrollTrigger
- `src/index.css` — Tailwind entry (`@import "tailwindcss"`) plus base styles

## Devices

- `src/env.ts`: `LIVE3D` (WebGL available and motion not reduced) and `LIVE_CUPS` (that, and not a phone). Without `LIVE3D` the hero is `public/hero-still.jpg`, the dive section is one screen, Lenis is off. Without `LIVE_CUPS` the menu shows `public/cups-still.webp` instead of the Landing canvas. Both stills were saved off the live canvases in dev (`?snap` sets `preserveDrawingBuffer`).
- A cream loader with the stag growing covers the page until Dive dispatches `hg-ready` (7s cap).
- Fonts are self-hosted (`@fontsource/cinzel`, `@fontsource/crimson-pro`, imported in `main.tsx`); no third-party requests.
- `index.html` carries the launch meta text, JSON-LD (`CafeOrCoffeeShop`) and `public/og.jpg` for the full site; the coming-soon og image is kept at `brand/og-comingsoon.jpg`. Pushing before launch would put these on the live coming-soon page.

## Performance rules (the site was very laggy once)

- No `mix-blend-mode` overlays over the page. Both canvases are `frameloop="demand"` and only invalidate while on screen. The dive drops to dpr 1 inside the drink; the drink shader is budgeted (3 shells, 3-octave fbm). The map redraws only when its zoom changes. The dive clones the coffee GLB scene (Landing uses the original).

## Constraints

- `react` / `react-dom` are pinned to `~19.2.0`: `@react-three/fiber` 9.7 requires `react >=19 <19.3`. Don't bump to 19.3 until fiber allows it.
- `postprocessing` requires `three < 0.187`; check before upgrading three.
- leva's panel is hidden outside dev (`import.meta.env.DEV`).

## Commands

- `npm run dev` / `npm run build` (tsc + vite) / `npm run lint` (oxlint)
