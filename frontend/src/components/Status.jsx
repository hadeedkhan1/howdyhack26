import { Link } from 'react-router-dom'

// Loading and error states, used by every page that loads the plan.
export function Loading() {
  return <div className="loading-card" role="status" aria-label="Loading your fishing plan">
    <span className="skeleton-line wide" /><span className="skeleton-line" /><span className="skeleton-block" />
    <span className="loading-caption">Checking the coast…</span>
  </div>
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-card" role="alert">
      <span className="error-icon" aria-hidden="true">!</span>
      <p className="card-title">Couldn't load the forecast</p>
      <p className="muted">{error?.status === 400 ? 'That date doesn’t look valid. Go back and choose another date.' : error?.message || 'The tide data did not come through. Try again in a moment.'}</p>
      {error?.status === 400 && <Link className="button button-outline button-small" to="/start">Choose another date</Link>}
      {onRetry && <button className="button button-dark button-small" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function DemoBadge({ show }) {
  if (!show) return null
  return (
    <span className="inline-block rounded-full bg-amber/30 px-3 py-1 text-xs font-semibold">
      Demo data
    </span>
  )
}
