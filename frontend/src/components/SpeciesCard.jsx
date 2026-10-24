// The playing card used on Hand, Deck and the draw. BUILD THIS FIRST (frontend lead).
// mode: "face" (full card), "silhouette" (not collected yet), "back" (card back for flips).
export default function SpeciesCard({ species, mode = 'face' }) {
  if (mode === 'back') {
    return <div className="aspect-[5/7] rounded-card bg-navy" aria-label="Card back" />
  }
  if (mode === 'silhouette') {
    return (
      <div className="flex aspect-[5/7] flex-col justify-end rounded-card bg-navy/80 p-3 text-sand">
        <p className="font-semibold">???</p>
        <p className="text-sm">How to catch me: {species.bait?.join(', ') || 'coming soon'}</p>
      </div>
    )
  }
  return (
    <div className="flex aspect-[5/7] flex-col rounded-card bg-white p-3 shadow">
      <p className="text-lg font-bold">{species.name}</p>
      <div className="my-2 flex-1 rounded-lg bg-sand" />
      <p className="text-sm">Bait: {species.bait?.join(', ') || 'TBD'}</p>
    </div>
  )
}
