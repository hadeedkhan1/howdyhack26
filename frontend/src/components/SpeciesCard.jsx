import { useState } from 'react'
import { regulations } from '../services/content'

const ranks = ['A', '2', '3', '4', '5', '6', '7']
const suits = ['♠', '♥', '♦', '♣']
const label = (value, fallback = 'Details coming soon') => value && value !== 'NEEDS CHECK' ? value : fallback

function FishMark() {
  return <svg className="fish-mark" viewBox="0 0 160 90" role="img" aria-label="Fish illustration">
    <path d="M23 45c18-24 54-31 89-13l26-18-5 28 5 28-26-18C77 70 41 68 23 45Z" fill="currentColor" opacity=".9" />
    <path d="m59 35 13 10-13 10m18-26 10 9-10 10m-3 5 9 10" fill="none" stroke="var(--card-paper)" strokeWidth="3" strokeLinecap="round" opacity=".75" />
    <circle cx="42" cy="41" r="3" fill="var(--card-paper)" />
    <path d="M18 26c-7 7-7 13 0 19m-6 2c-7 7-7 13 0 19" fill="none" stroke="currentColor" strokeWidth="2" opacity=".4" />
  </svg>
}

// The playing card used on Hand, Deck and the draw.
// mode: "face" (full card), "silhouette" (not collected yet), "back" (card back for flips).
export default function SpeciesCard({ species, mode = 'face', compact = false, likelihood, onClick }) {
  const [expanded, setExpanded] = useState(false)
  if (!species) return null
  const rank = ranks[Math.max(0, Object.keys(regulations.species).indexOf(species.id))] || '★'
  const suit = suits[Math.max(0, Object.keys(regulations.species).indexOf(species.id)) % suits.length]

  if (mode === 'back') {
    return <div className="species-card card-back" aria-label="Card back"><div className="back-inner"><span>GO<br />FISH</span><i>✳</i></div></div>
  }
  if (mode === 'silhouette') {
    return (
      <button type="button" className={`species-card silhouette-card ${compact ? 'compact' : ''}`} onClick={onClick} aria-label={`Uncollected card: ${species.name}. ${label(species.howTo, 'Tap to learn how to catch it.')}`}>
        <span className="card-rank">? <small>♣</small></span>
        <div className="silhouette-art"><FishMark /></div>
        <div className="silhouette-copy"><span className="card-kicker">UNCAUGHT · {species.spotTypes?.length ? species.spotTypes.join(' / ') : 'GALVESTON'}</span>
          <h3>Unknown catch</h3></div>
        <span className="card-collect-hint">Tap to reveal the clue ↗</span>
      </button>
    )
  }

  return (
    <article className={`species-card face-card ${compact ? 'compact' : ''} ${expanded ? 'expanded' : ''}`}>
      <button type="button" className="card-main" onClick={() => { setExpanded(!expanded); onClick?.() }} aria-expanded={expanded}>
        <span className="card-rank">{rank}<small>{suit}</small></span>
        <div className="card-art"><span className="art-label">GULF COAST · FIELD NOTES</span>{species.photo ? <img src={species.photo} alt={species.name} /> : <FishMark />}
          <span className="art-caption">YOUR NEXT<br />GOOD STORY</span></div>
        <div className="card-information"><div className="card-title-row"><h3>{species.name}</h3>{likelihood && <span className={`likelihood likelihood-${likelihood}`}>{likelihood}</span>}</div>
          <p className="card-bait"><span className="mini-icon">⌁</span> {species.bait?.length ? species.bait.join(' · ') : 'Bait details soon'}</p>
          {!compact && <><div className="card-rule" /><p className="card-detail"><b>Rig</b><span>{label(species.rig)}</span></p><p className="card-detail"><b>Keep / release</b><span>{label(regulations.species[species.id]?.notes, 'Check current TPWD rules')}</span></p><p className="card-detail"><b>Good to know</b><span>{label(species.handling)}</span></p>
            <p className="eat-note"><span>{species.eat?.ok === true ? '✓' : species.eat?.ok === false ? '!' : '↗'}</span> {species.eat?.ok == null ? 'Check local advisories before eating' : species.eat.note}</p></>}
        </div>
        <span className="card-expand-hint">{compact ? 'Tap for field notes' : 'Tap to ' + (expanded ? 'fold' : 'learn more')} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span></span>
      </button>
      {compact && expanded && <div className="compact-details"><p><b>How to rig:</b> {label(species.rig)}</p><p><b>Handling:</b> {label(species.handling)}</p><p><b>Limits:</b> {label(regulations.species[species.id]?.notes, 'Check TPWD before keeping')}</p></div>}
    </article>
  )
}
