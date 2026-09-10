import { lazy, Suspense } from 'react'
import { useLenis } from './hooks/useLenis'

// three.js is heavy; load it as its own chunk so page content paints first.
const Scene = lazy(() => import('./scene/Scene'))

function App() {
  useLenis()

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <main>
        <section className="flex h-svh items-center justify-center">
          <h1 className="text-6xl font-semibold tracking-tight">Hart &amp; Ground</h1>
        </section>
        <section className="h-svh" />
      </main>
    </>
  )
}

export default App
