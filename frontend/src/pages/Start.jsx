import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function dateAfter(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDate(date)
}
function nextWeekday(target) {
  const date = new Date()
  date.setDate(date.getDate() + ((target - date.getDay() + 7) % 7))
  return localDate(date)
}

function formatSelectedDate(value) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00Z`))
}

const dateChoices = [
  { title: 'Today', date: dateAfter(0) },
  { title: 'Tomorrow', date: dateAfter(1) },
  { title: 'Saturday', date: nextWeekday(6) },
]

export default function Start() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const go = (date) => navigate(`/check?date=${date}`)
  const today = localDate(new Date())
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const monthDays = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const calendarCells = [...Array(monthStart.getDay()).fill(null), ...Array.from({ length: monthDays }, (_, index) => index + 1)]
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(visibleMonth)
  const changeMonth = (amount) => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1))
  const chooseDate = (day) => {
    const date = localDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
    setSelectedDate(date)
    setCalendarOpen(false)
    go(date)
  }

  return (
    <Screen title="Galveston, TX">
      <div className="start-content">
        <section className="start-hero" aria-label="Go Fish trip planning">
          <div className="hero-landscape"><div className="hero-moon" /><div className="hero-wave wave-one" /><div className="hero-wave wave-two" /><div className="hero-wave wave-three" /><span className="hero-fish">〰</span><span className="hero-lighthouse">⌁</span></div>
          <div className="start-hero-copy"><span className="handwritten">No boat. No big deal.</span><p>We’ll help you figure out <b>when to go, where to cast,</b> and what might bite.</p></div>
        </section>
        <section className="date-picker-section"><div className="section-heading"><div><h2>When's the trip?</h2></div><span className="round-icon">↘</span></div>
          <div className="date-choices">{dateChoices.map((choice, index) => <button key={`${choice.title}-${choice.date}`} className={`date-choice ${selectedDate === choice.date ? 'selected' : ''}`} onClick={() => { setSelectedDate(choice.date); go(choice.date) }}>
            <span className="date-choice-icon">{['☼', '↗', '✳'][index]}</span><span><b>{choice.title}</b></span><span className="date-choice-arrow">→</span>
          </button>)}</div>
          <button type="button" className="custom-date" onClick={() => {
            if (!calendarOpen && selectedDate) setVisibleMonth(new Date(`${selectedDate}T12:00:00`))
            setCalendarOpen((open) => !open)
          }} aria-expanded={calendarOpen} aria-controls="trip-calendar">
            <span className="custom-date-icon" aria-hidden="true">▦</span>
            <span className="custom-date-copy">{selectedDate ? formatSelectedDate(selectedDate) : 'Choose another date'}</span>
            <span className={`custom-date-arrow ${calendarOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
          </button>
          {calendarOpen && <div className="date-calendar" id="trip-calendar" role="dialog" aria-label="Choose a trip date">
            <div className="calendar-header">
              <button type="button" onClick={() => changeMonth(-1)} disabled={visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()} aria-label="Previous month">‹</button>
              <b>{monthLabel}</b>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="calendar-grid" role="grid" aria-label={monthLabel}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span className="calendar-weekday" key={`${day}-${index}`} aria-hidden="true">{day}</span>)}
              {calendarCells.map((day, index) => day
                ? <button type="button" role="gridcell" key={day} disabled={localDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)) < today} className={`${selectedDate === localDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)) ? 'selected' : ''} ${today === localDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)) ? 'today' : ''}`} onClick={() => chooseDate(day)}>{day}</button>
                : <span className="calendar-empty" key={`empty-${index}`} />)}
            </div>
          </div>}
        </section>
      </div>
    </Screen>
  )
}
