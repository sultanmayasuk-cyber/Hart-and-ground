# hartandground

3D marketing website. Vite + React + TypeScript, three.js via React Three Fiber + drei, GSAP (+ ScrollTrigger), Lenis smooth scroll, @react-three/postprocessing, leva, Tailwind CSS v4.

## Layout

- `src/main.tsx` — picks the page: the full site (live since launch, 2026-09); `VITE_COMING_SOON=true` brings the coming-soon page back.
- `src/ComingSoon.tsx` + `src/scene/CupDuo.tsx` — the old coming-soon page (kept, not shown): logo header, "COMING SOON" drawn as a plane in the 3D scene (so cups can pass behind the letters), the two cups (spring-driven motion, periodic swap ride round the word), counter reflection
- `src/App.tsx` — the full site, concept "Through the Glass": dive (hero, 620svh) / menu / story / rewards (300svh) / visit map (420svh) / footer. Cream and the royal purple alternate (dive cream, menu purple, story mist→purple, rewards purple, map cream, footer purple); gold only on purple.
- `src/scene/Dive.tsx` — the hero dive, its own sticky canvas (frameloop demand). Opens like a poster: the latte in the middle, the headline split either side of it (DOM, `.hero-copy`), ice adrift round it (`Adrift`), real clear ice heaped on top (`Heap`, drops in on load; covers the model's baked ice, which fails up close). Scroll (`page.dive`) pushes in until the stag on the wall fills the screen, climbs over the rim (fov widens 30→60), the coffee closes in from the edges (`Veil`, an iris) to hide the cut to the interior (built at y = -60): ice (transmission), bubbles, espresso billowing into milk (shader on a sphere round the camera), then cream out into the page. The first 4 frames render from inside behind the veil to warm the GPU. Dev: `?snap` removes easing for frame checks.
- `src/scene/Landing.tsx` — the menu stage's two cups, fixed transparent canvas: `scene/scroll.ts` → `page.act` (0 parked below during the dive, 1 centre stage coffee in front, 2 traded matcha in front, 3 parted to either edge round the door, 4 sunk at the story). Deliberately does not look like the coming-soon page.
- Tried and rejected by the user (2026-09-21), don't re-propose: wipeable condensation on the hero cup (it veiled the logo and didn't read as wipeable), a "latte taken apart" section, an ice-drop game.
- `src/sections/` — `Menu.tsx` (no menu list on the site, by the user's decision 2026-09-22: a pinned 320svh stage on the purple where the cups rise, trade, then part round "See the full menu", the link to Yousual; words step by `--m`; rises over the end of the dive with `margin-top: -55svh` so there's no blank stretch; phones: the cups' photo, the same words, the link), `Story.tsx` (left: sticky purple panel where the gold stag rises and the real lockup is uncovered HART → GROUND → full, by `--s`; right: four plain chapters scrolling past. The user rejected text laid over stag graphics), `Loyalty.tsx` (pinned 260svh on purple: words + the gold button still on the left, the wallet card on the right stamped by scroll `--p`, flips to the reward; phones stack them; links to yousual loyalty), `MapZoom.tsx` (canvas map zooming London → Richmond Park deer → the door; data `public/map/map.json` built by `node scripts/build-map.mjs` from OpenStreetMap, keep the © credit).
- Cups: `public/models/{coffee,matcha}.glb` are Meshy models (unit height, base at y=0). Their baked logo was painted out of the textures; `CupPrint.tsx` prints the real logo (`public/cup-logo.svg`) and the back line on the wall, `cupFinish.ts` adds the ice/condensation/rim shader finish. Use both wherever the cups appear.
- Parked (2026-09-22, the user didn't like it in the menu): a hot paper cup with steam to replace the iced coffee. The pieces are all there, unwired: `public/models/hot.glb` (Higgsfield still `brand/gen/hot-b.png` → Meshy → `blender -b -P blender/prep_hot.py -- blender/raw/hot-meshy.glb public/models/hot.glb`), `scene/HotWall.tsx` (a clean lathe in the real oxblood over Meshy's mottled wall), `scene/Steam.tsx`. The removed wiring (gold-foil `kind="hot"` in CupPrint, `finishHot`, the Landing swap) is in this session's history, not git.
- Brand lettering: `src/LogoLockup.tsx` (traced from `brand/logo.svg`) and `public/brand-stag.svg`; always one colour, never a font imitation.
- Opening hours: `src/openingHours.ts` (the data, from the Google listing, and `status()` = open/closed right now on London time) + `src/Hours.tsx` (the live line and the two rows). Shown by the address in the Visit section, one line in the footer, `openingHoursSpecification` in the JSON-LD in `index.html`. Change all three together.
- `src/hooks/useLenis.ts` — Lenis smooth scroll synced to GSAP's ticker / ScrollTrigger
- `src/index.css` — Tailwind entry (`@import "tailwindcss"`) plus base styles

## Devices

- `src/env.ts`: `LIVE3D` (WebGL available and motion not reduced) and `LIVE_CUPS` (that, and not a phone). Without `LIVE3D` the hero is `public/hero-still.jpg`, the dive section is one screen, Lenis is off. Without `LIVE_CUPS` the menu shows `public/cups-still.webp` instead of the Landing canvas. Both stills were saved off the live canvases in dev (`?snap` sets `preserveDrawingBuffer`).
- The header wears a band in the colour of the page block under it (`--band`, set on scroll in `App.tsx`; split at a block's edge so no colour ever shows over another), fading out below, so page text can't run through the nav. Not a backdrop blur: that silently did nothing in the user's Chrome.
- A cream loader with the stag growing covers the page until Dive dispatches `hg-ready` (7s cap).
- Fonts are self-hosted (`@fontsource/cinzel`, `@fontsource/crimson-pro`, imported in `main.tsx`); no third-party requests.
- `index.html` carries the launch meta text, JSON-LD (`CafeOrCoffeeShop`) and `public/og.jpg` for the full site; the coming-soon og image is kept at `brand/og-comingsoon.jpg`.

## Performance rules (the site was very laggy once)

- No `mix-blend-mode` overlays over the page. Both canvases switch `setFrameloop('always' | 'never')` from a gsap tick depending on whether they're on screen. Never drive them with `frameloop="demand"` + `invalidate()` from gsap's ticker: that raced R3F's loop and rendered every other frame (30 fps everywhere; found in the iOS simulator 2026-09-21).
- The dive's pixel ratio is React state passed to `<Canvas dpr>` (R3F re-applies the prop on every resize, e.g. a phone's toolbar sliding away, which undid `setDpr`). Phones (`PHONE` in env.ts): no ice transmission, fewer cubes/bubbles, 1 drink shell, dpr 1.6 outside / 0.7 inside, the cup lines as DOM text (`.dq`, six of them), header slides away on scroll down, pinned stages are `h-lvh`. `?fps` shows a frame-rate + canvas-size readout. Test phones with the iOS Simulator tool against `npm run preview`. The dive drops to dpr 1 inside the drink; the drink shader is budgeted (3 shells, 3-octave fbm). The map redraws only when its zoom changes. The dive clones the coffee GLB scene (Landing uses the original).

## Constraints

- `react` / `react-dom` are pinned to `~19.2.0`: `@react-three/fiber` 9.7 requires `react >=19 <19.3`. Don't bump to 19.3 until fiber allows it.
- `postprocessing` requires `three < 0.187`; check before upgrading three.
- leva's panel is hidden outside dev (`import.meta.env.DEV`).

## Commands

- `npm run dev` / `npm run build` (tsc + vite) / `npm run lint` (oxlint)
