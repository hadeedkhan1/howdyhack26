import { Link, useLocation } from 'react-router-dom'
import Screen from '../components/Screen'
import SafetyBadge from '../components/SafetyBadge'
import LicenseQuiz from '../components/LicenseQuiz'
import { ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'
import { useState } from 'react'

function timeAgo(value) {
  if (!value) return 'update time unavailable'
  const elapsed = Date.now() - new Date(value).getTime()
  if (elapsed < -60000) return 'demo timestamp'
  const mins = Math.max(0, Math.round(elapsed / 60000))
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`
}

// Owner: Frontend lead. "Can I fish today?" = safety verdict + license check.
export default function Check() {
  const { day, loading, error, retry } = usePlan()
  const { search } = useLocation()
  const [showReasons, setShowReasons] = useState(false)

  return (
    <Screen title="Can I fish today?">
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={retry} />}
      {day && (
        <div className="grid gap-4">
          <SafetyBadge verdict={day.safety.verdict} reason={day.safety.reasons[0]?.text} />
          <section className="panel conditions-panel">
            <button className="conditions-toggle" onClick={() => setShowReasons(!showReasons)} aria-expanded={showReasons}>
              <span className="condition-spark">✳</span><span><b>{day.safety.reasons.length} conditions checked</b><small>{showReasons ? 'Hide details' : 'See sources and update times'}</small></span><span className="why-chevron">{showReasons ? '−' : '+'}</span>
            </button>
            {showReasons && <ul className="condition-list">{day.safety.reasons.map((reason) => <li key={reason.signal}>
              <span className={`condition-dot level-${reason.level}`} /><span className="condition-copy"><b>{reason.signal.replaceAll('_', ' ')}</b><span>{reason.text}</span><small>{reason.source} · updated {timeAgo(reason.updatedAt)}</small></span>
            </li>)}</ul>}
          </section>
          <LicenseQuiz />
          <Link to={`/plan${search}`} className="button button-dark continue-button">
            Build my fishing plan <span>→</span>
          </Link>
        </div>
      )}
    </Screen>
  )
}
