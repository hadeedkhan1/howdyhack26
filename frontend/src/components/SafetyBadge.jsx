const styles = {
  go: { label: 'Go', sub: 'No hazards flagged', className: 'safety-go', icon: '✓' },
  caution: { label: 'Caution', sub: 'Check conditions before you head out', className: 'safety-caution', icon: '!' },
  no: { label: 'No', sub: 'Stay off the water', className: 'safety-no', icon: '×' },
}

export default function SafetyBadge({ verdict, reason }) {
  const s = styles[verdict] ?? styles.caution
  return (
    <div className={`safety-card ${s.className}`}>
      <span className="safety-icon" aria-hidden="true">{s.icon}</span>
      <div><p className="safety-label">{s.label}</p><p className="safety-sub">{s.sub}</p>
      {reason && <p className="safety-reason">{reason}</p>}</div>
    </div>
  )
}
