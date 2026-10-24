import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPlan } from './api'

// Loads the plan for the date in the URL (?date=YYYY-MM-DD).
// Returns { plan, day, loading, error, date }. "day" is the selected day's entry.
export function usePlan() {
  const [params] = useSearchParams()
  const date = params.get('date')
  const [requestId, setRequestId] = useState(0)
  // "forDate" remembers which date the stored result belongs to.
  const [result, setResult] = useState({ forDate: undefined, plan: null, error: null })

  useEffect(() => {
    let cancelled = false
    getPlan({ start: date ?? undefined })
      .then((plan) => !cancelled && setResult({ forDate: date, plan, error: null }))
      .catch((error) => !cancelled && setResult({ forDate: date, plan: null, error }))
    return () => { cancelled = true }
  }, [date, requestId])

  const loading = result.forDate !== date
  const plan = loading ? null : result.plan
  const day = plan?.days.find((d) => d.date === date) ?? plan?.days[0] ?? null
  return { plan, day, loading, error: loading ? null : result.error, date, retry: () => setRequestId((id) => id + 1) }
}
