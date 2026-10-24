import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/Status'

const Start = lazy(() => import('./pages/Start'))
const Check = lazy(() => import('./pages/Check'))
const Plan = lazy(() => import('./pages/Plan'))
const Hand = lazy(() => import('./pages/Hand'))
const Deck = lazy(() => import('./pages/Deck'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-md">
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
