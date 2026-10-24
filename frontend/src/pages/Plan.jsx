import Screen from '../components/Screen'
import { lazy, Suspense, useMemo, useState } from 'react'
import WhyPanel from '../components/WhyPanel'
import { ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'
import { spotsById } from '../services/content'

const SpotMap = lazy(() => import('../components/SpotMap'))
const TideChart = lazy(() => import('../components/TideChart'))

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
}

// Owner: Frontend lead. Map + ranked windows + tide chart + "why".
export default function Plan() {
  const { day, loading, error, retry } = usePlan()
  const [selectedSpot, setSelectedSpot] = useState(null)
  const sortedWindows = useMemo(() => [...(day?.windows || [])].sort((a, b) => b.score - a.score), [day])
  const [selectedKey, setSelectedKey] = useState(null)
  const selectedWindow = sortedWindows.find((window) => `${window.spotId}-${window.start}` === selectedKey)
    || sortedWindows.find((window) => window.spotId === selectedSpot)
    || sortedWindows[0]
  const activeSpot = selectedSpot || selectedWindow?.spotId
  const outlookScore = sortedWindows[0]?.score ?? 0
  const outlookStars = Math.max(0, Math.min(5, Math.round(outlookScore / 20)))

  return (
    <Screen title="Galveston, TX" eyebrow={`${day ? formatDate(day.date).toUpperCase() : 'LOCAL OUTLOOK'}`} nav>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {day && (
        <div className="plan-content">
          <div className="fishing-rating" aria-label={`Estimated fishing outlook ${outlookScore} out of 100, about ${outlookStars} stars. This is a forecast, not a visitor rating.`}>
            <span className="rating-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < outlookStars ? 'filled' : ''}>★</span>)}</span>
            <span className="rating-value">{(outlookScore / 20).toFixed(1)}<small>/5</small></span>
            <span className="rating-copy"><b>Fishing outlook</b><small>Forecast estimate · not visitor reviews</small></span>
            <span className="rating-score">{outlookScore}<small>/100</small></span>
          </div>
          <section className="plan-hero"><div className="plan-hero-top"><span className="weather-sun">☼</span><span>YOUR FIRST TRIP, SORTED</span><span className="hero-squiggle">〰</span></div>
            <h2>Go where the water<br /><em>is moving.</em></h2><p>We found {day.windows.length} promising time{day.windows.length === 1 ? '' : 's'} around Galveston. Pick one and we’ll explain why.</p>
            <div className="plan-hero-stats"><span><b>{day.windows.length.toString().padStart(2, '0')}</b><small>good windows</small></span><span><b>{day.likelySpecies.length.toString().padStart(2, '0')}</b><small>species to meet</small></span><span><b>0</b><small>boats needed</small></span></div>
          </section>
          <Suspense fallback={<div className="map-loading"><span className="skeleton-block" /><b>Loading the shoreline map…</b></div>}>
            <SpotMap windows={sortedWindows} selectedSpot={activeSpot} onSelect={(id) => { setSelectedSpot(id); const next = sortedWindows.find((window) => window.spotId === id); if (next) setSelectedKey(`${next.spotId}-${next.start}`) }} />
          </Suspense>
          <section className="windows-section"><div className="section-heading"><div><h2>Best times to cast</h2></div><span className="estimate-pill">ESTIMATES</span></div>
            <p className="muted windows-intro">Ranked by changing tide, wind, and light. Tap a time to see the reasoning.</p>
            <ol className="window-list">{sortedWindows.map((window, index) => {
              const selected = selectedWindow === window
              return <li key={`${window.spotId}-${window.start}`}><button type="button" className={`window-card ${selected ? 'selected' : ''}`} onClick={() => { setSelectedKey(`${window.spotId}-${window.start}`); setSelectedSpot(window.spotId) }} aria-pressed={selected}>
                <span className="window-rank">{index === 0 ? 'BEST' : `0${index + 1}`}</span><span className="window-time"><b>{window.start}<i>—</i>{window.end}</b><small>{spotsById[window.spotId]?.name?.replace('Galveston Island State Park — ', 'State Park · ') || window.spotId}</small></span>
                <span className="window-score"><b>{window.score}</b><small>estimated</small></span><span className="window-trend" aria-hidden="true">↗</span>
              </button></li>
            })}</ol>
          </section>
          <Suspense fallback={<div className="chart-loading"><span className="skeleton-line wide" /><span className="skeleton-block" /></div>}>
            <TideChart tide={day.tide} windows={day.windows} />
          </Suspense>
          <WhyPanel window={selectedWindow} />
          <p className="plan-footnote">Fishing scores are estimates, not guarantees. Check conditions again before leaving.</p>
        </div>
      )}
    </Screen>
  )
}
