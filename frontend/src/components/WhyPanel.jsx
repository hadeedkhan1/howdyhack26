import { useState } from 'react'

export default function WhyPanel({ window }) {
  const [open, setOpen] = useState(false)
  if (!window) return null
  return <section className={`panel why-panel ${open ? 'open' : ''}`}>
    <button className="why-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="why-symbol">✳</span><span className="why-copy"><b>Why this time?</b><small>See what went into your estimate</small></span><span className="why-chevron">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="why-content">
      {window.why?.map((item, index) => <div className="why-row" key={`${item.input}-${index}`}><span className="why-input">{item.input}</span><span className="why-value">{item.value}</span><span className={`why-effect ${item.effect >= 0 ? 'positive' : 'negative'}`}>{item.effect > 0 ? '+' : ''}{item.effect}</span><span className={`why-tag ${item.label === 'data' ? 'tag-data' : 'tag-rule'}`}>{item.label}</span></div>)}
    </div>}
  </section>
}
