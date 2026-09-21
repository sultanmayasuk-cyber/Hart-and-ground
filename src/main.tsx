import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
// the fonts ship with the site (no request to Google): Cinzel for display, Crimson Pro for text
import '@fontsource/cinzel/latin-500.css'
import '@fontsource/cinzel/latin-600.css'
import '@fontsource/crimson-pro/latin-400.css'
import '@fontsource/crimson-pro/latin-400-italic.css'
import '@fontsource/crimson-pro/latin-600.css'
import './index.css'

// Until launch, the live site is the coming-soon page. To work on the full site locally,
// put VITE_COMING_SOON=false in .env.local. To launch (or show progress), change the default here to `=== 'true'`.
declare const __PREVIEW__: boolean // (vite.config.ts: true on Vercel preview deployments)
const COMING_SOON = import.meta.env.VITE_COMING_SOON !== 'false' && !__PREVIEW__
const Page = lazy(() => (COMING_SOON ? import('./ComingSoon') : import('./App')))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
)
