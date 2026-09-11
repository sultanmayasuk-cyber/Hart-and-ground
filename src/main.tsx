import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Until launch, the live site is the coming-soon page. To work on the full site locally,
// put VITE_COMING_SOON=false in .env.local. To launch (or show progress), change the default here to `=== 'true'`.
const COMING_SOON = import.meta.env.VITE_COMING_SOON !== 'false'
const Page = lazy(() => (COMING_SOON ? import('./ComingSoon') : import('./App')))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
)
