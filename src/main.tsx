import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// The live site shows the full landing page. To put the coming-soon page back up,
// change this default to `!== 'false'` (then VITE_COMING_SOON=false in .env.local still shows the full site locally).
const COMING_SOON = import.meta.env.VITE_COMING_SOON === 'true'
const Page = lazy(() => (COMING_SOON ? import('./ComingSoon') : import('./App')))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
)
