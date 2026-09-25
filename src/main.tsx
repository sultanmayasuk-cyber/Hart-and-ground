import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
// the fonts ship with the site (no request to Google): Cinzel for display, Crimson Pro for text
import '@fontsource/cinzel/latin-500.css'
import '@fontsource/cinzel/latin-600.css'
import '@fontsource/crimson-pro/latin-400.css'
import '@fontsource/crimson-pro/latin-400-italic.css'
import '@fontsource/crimson-pro/latin-600.css'
import './index.css'

// Back to the coming-soon page (2026-09-25). The full site is kept: VITE_COMING_SOON=false brings it back (in .env.local,
// or as an environment variable on the host).
const COMING_SOON = import.meta.env.VITE_COMING_SOON !== 'false'
const Page = lazy(() => (COMING_SOON ? import('./ComingSoon') : import('./App')))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
)
