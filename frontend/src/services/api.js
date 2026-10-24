// All data the app needs from the backend comes through this file.
// While USE_MOCK is true, the app uses backend/mock/plan.json instead of calling the API.
// Turn mock mode off by creating frontend/.env.local with: VITE_USE_MOCK=false
import mockPlan from '../../../backend/mock/plan.json'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export async function getPlan({ start, days = 2, snapshot = false } = {}) {
  if (USE_MOCK) return mockPlan

  const params = new URLSearchParams({ days: String(days) })
  if (start) params.set('start', start)
  if (snapshot) params.set('snapshot', 'demo')

  const res = await fetch(`/api/plan?${params}`)
  const data = await res.json()
  if (!res.ok) {
    const error = new Error(data.error || `Plan request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}
