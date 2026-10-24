import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Start from './pages/Start'
import Check from './pages/Check'
import Plan from './pages/Plan'
import Hand from './pages/Hand'
import Deck from './pages/Deck'

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-md">
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/start" element={<Start />} />
          <Route path="/check" element={<Check />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/hand" element={<Hand />} />
          <Route path="/deck" element={<Deck />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
