import Screen from '../components/Screen'
import SpotMap from '../components/SpotMap'
import TideChart from '../components/TideChart'
import WhyPanel from '../components/WhyPanel'
import { ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'
import { spotsById } from '../services/content'

// Owner: Frontend lead. Map + ranked windows + tide chart + "why".
export default function Plan() {
  const { day, loading, error } = usePlan()

  return (
    <Screen title="Your plan" nav>
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {day && (
        <div className="grid gap-4">
          <SpotMap />
          <ol className="grid gap-2">
            {day.windows.map((w) => (
              <li key={w.spotId + w.start} className="flex min-h-14 items-center justify-between rounded-card bg-white px-4 shadow">
                <span className="font-semibold">
                  {w.start}–{w.end} · {spotsById[w.spotId]?.name ?? w.spotId}
                </span>
                <span className="text-lg font-bold" title="Estimated score">{w.score}</span>
              </li>
            ))}
          </ol>
          <TideChart />
          <WhyPanel />
        </div>
      )}
    </Screen>
  )
}
