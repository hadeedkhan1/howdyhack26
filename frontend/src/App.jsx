import { lazy, Suspense, useLayoutEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from './components/Status'
import AmbientMap from './components/AmbientMap'

const Start = lazy(() => import('./pages/Start'))
const Check = lazy(() => import('./pages/Check'))
const Plan = lazy(() => import('./pages/Plan'))
const Hand = lazy(() => import('./pages/Hand'))
const Deck = lazy(() => import('./pages/Deck'))

// Each tab opens at the top instead of keeping the previous tab's scroll position.
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-experience mx-auto min-h-screen max-w-md">
        <AmbientMap />
        <Suspense fallback={<main className="route-loading"><Loading /></main>}>
          <Routes>
            <Route path="/" element={<Navigate to="/start" replace />} />
            <Route path="/start" element={<Start />} />
            <Route path="/check" element={<Check />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/hand" element={<Hand />} />
            <Route path="/deck" element={<Deck />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}
