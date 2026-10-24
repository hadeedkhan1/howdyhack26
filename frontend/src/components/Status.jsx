// Loading and error states, used by every page that loads the plan.
export function Loading() {
  return <div className="h-40 animate-pulse rounded-card bg-navy/10" aria-label="Loading" />
}

export function ErrorState({ error }) {
  return (
    <div className="rounded-card bg-coral/15 p-4">
      <p className="font-semibold">Couldn't load the forecast.</p>
      <p className="text-sm">{error?.message}</p>
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
