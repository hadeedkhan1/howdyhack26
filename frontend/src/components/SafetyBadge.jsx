// Big Go / Caution / No verdict. TODO (frontend lead): final design from Figma.
const styles = {
  go: { label: 'Go: no hazards flagged', className: 'bg-seafoam' },
  caution: { label: 'Caution', className: 'bg-amber' },
  no: { label: 'No: stay off the water', className: 'bg-coral text-white' },
}

export default function SafetyBadge({ verdict, reason }) {
  const s = styles[verdict] ?? styles.caution
  return (
    <div className={`rounded-card p-5 ${s.className}`}>
      <p className="text-2xl font-bold">{s.label}</p>
      {reason && <p className="mt-1">{reason}</p>}
    </div>
  )
}
