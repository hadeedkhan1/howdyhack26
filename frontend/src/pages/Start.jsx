import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'

// Owner: Frontend 2. One question: when's your trip?
function nextDay(weekday) {
  // weekday: 0 = Sunday ... 6 = Saturday. Returns YYYY-MM-DD in local time.
  const d = new Date()
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return d.toLocaleDateString('en-CA')
}

export default function Start() {
  const navigate = useNavigate()
  const go = (date) => navigate(`/check?date=${date}`)

  return (
    <Screen title="When's your Galveston trip?">
      <div className="grid gap-3">
        <button className="min-h-14 rounded-card bg-white text-lg font-semibold shadow" onClick={() => go(nextDay(6))}>
          This Saturday
        </button>
        <button className="min-h-14 rounded-card bg-white text-lg font-semibold shadow" onClick={() => go(nextDay(0))}>
          This Sunday
        </button>
        <input
          type="date"
          className="min-h-14 rounded-card bg-white px-4 text-lg shadow"
          onChange={(e) => e.target.value && go(e.target.value)}
          aria-label="Pick a date"
        />
      </div>
    </Screen>
  )
}
