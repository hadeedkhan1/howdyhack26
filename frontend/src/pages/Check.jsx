import { Link, useLocation } from 'react-router-dom'
import Screen from '../components/Screen'
import SafetyBadge from '../components/SafetyBadge'
import LicenseQuiz from '../components/LicenseQuiz'
import { DemoBadge, ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'

// Owner: Frontend lead. "Can I fish today?" = safety verdict + license check.
export default function Check() {
  const { plan, day, loading, error } = usePlan()
  const { search } = useLocation()

  return (
    <Screen title="Can I fish today?">
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {day && (
        <div className="grid gap-4">
          <DemoBadge show={plan.snapshot} />
          <SafetyBadge verdict={day.safety.verdict} reason={day.safety.reasons[0]?.text} />
          <ul className="grid gap-2 text-sm">
            {day.safety.reasons.map((r) => (
              <li key={r.signal} className="rounded-lg bg-white p-3">
                {r.text} <span className="text-navy/50">· {r.source}</span>
              </li>
            ))}
          </ul>
          <LicenseQuiz />
          <Link to={`/plan${search}`} className="flex min-h-14 items-center justify-center rounded-card bg-navy text-lg font-semibold text-sand">
            See my plan
          </Link>
        </div>
      )}
    </Screen>
  )
}
