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

const dateChoices = [
  { title: 'Today', date: dateAfter(0), note: 'Make it spontaneous' },
  { title: 'Tomorrow', date: dateAfter(1), note: 'A little getaway' },
  { title: 'Saturday', date: nextWeekday(6), note: 'The weekend classic' },
]

export default function Start() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState('')
  const go = (date) => navigate(`/check?date=${date}`)

  return (
    <Screen title="Galveston, TX" eyebrow="YOUR NEXT FISHING DAY STARTS HERE">
      <div className="start-content">
        <section className="start-hero" aria-label="Go Fish trip planning">
          <div className="start-hero-top"><span className="sun-stamp">✳</span><span>GALVESTON, TEXAS</span><span className="hero-sparkles">✦ · ✦</span></div>
          <div className="hero-landscape"><div className="hero-moon" /><div className="hero-wave wave-one" /><div className="hero-wave wave-two" /><div className="hero-wave wave-three" /><span className="hero-fish">〰</span><span className="hero-lighthouse">⌁</span></div>
          <div className="start-hero-copy"><span className="handwritten">No boat. No big deal.</span><p>We’ll help you figure out <b>when to go, where to cast,</b> and what might bite.</p></div>
        </section>
        <section className="date-picker-section"><div className="section-heading"><div><h2>When's the trip?</h2></div><span className="round-icon">↘</span></div>
          <div className="date-choices">{dateChoices.map((choice, index) => <button key={`${choice.title}-${choice.date}`} className={`date-choice ${selectedDate === choice.date ? 'selected' : ''}`} onClick={() => { setSelectedDate(choice.date); go(choice.date) }}>
            <span className="date-choice-icon">{['☼', '↗', '✳'][index]}</span><span><b>{choice.title}</b><small>{choice.note}</small></span><span className="date-choice-arrow">→</span>
          </button>)}</div>
          <label className="custom-date"><span>Planning further ahead?</span><input type="date" value={selectedDate} min={dateChoices[0].date} onChange={(event) => { setSelectedDate(event.target.value); if (event.target.value) go(event.target.value) }} aria-label="Choose a date for your trip" /></label>
        </section>
      </div>
    </Screen>
  )
}
