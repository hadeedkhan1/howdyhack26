import { useEffect, useRef, useState } from 'react'
import { regulations } from '../services/content'

const ranks = ['A', '2', '3', '4', '5', '6', '7']
const suits = ['♠', '♥', '♦', '♣']
const label = (value, fallback = 'Details coming soon') => value && value !== 'NEEDS CHECK' ? value : fallback
const limitSummary = (rule) => {
  if (!rule) return 'Check current TPWD rules before keeping fish.'
  if (rule.dailyBag == null) return label(rule.notes, 'Check current TPWD rules before keeping fish.')
  const size = rule.minIn && rule.maxIn
    ? `${rule.minIn}–${rule.maxIn} inches.`
    : rule.minIn
      ? `Minimum ${rule.minIn} inches; no maximum size.`
      : ''
  return [`${rule.dailyBag} per angler per day.`, size, label(rule.notes, '')].filter(Boolean).join(' ')
}

function FishMark() {
  return <svg className="fish-mark" viewBox="0 0 160 90" role="img" aria-label="Fish illustration">
    <path d="M23 45c18-24 54-31 89-13l26-18-5 28 5 28-26-18C77 70 41 68 23 45Z" fill="currentColor" opacity=".9" />
    <path d="m59 35 13 10-13 10m18-26 10 9-10 10m-3 5 9 10" fill="none" stroke="var(--card-paper)" strokeWidth="3" strokeLinecap="round" opacity=".75" />
    <circle cx="42" cy="41" r="3" fill="var(--card-paper)" />
    <path d="M18 26c-7 7-7 13 0 19m-6 2c-7 7-7 13 0 19" fill="none" stroke="currentColor" strokeWidth="2" opacity=".4" />
  </svg>
}

// Half-arc arrow for stepping through catch photos; the left one is mirrored in CSS.
function ArcArrow({ direction }) {
  return <svg className={`arc-arrow arc-arrow-${direction}`} viewBox="0 1 30 16" aria-hidden="true">
    <path d="M4.5 12.7A11 11 0 0 1 25.5 12.7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M25.5 7.7 25.5 12.7 20.6 11.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

// The playing card used on Hand, Deck and the draw.
// mode: "face" (full card), "silhouette" (not collected yet), "back" (card back for flips).
export default function SpeciesCard({ species, mode = 'face', compact = false, likelihood, catchPhoto, catchPhotos, onClick }) {
  const [expanded, setExpanded] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [failedPhoto, setFailedPhoto] = useState(null)
  const pauseCycle = useRef(false)
  const photoList = catchPhotos?.length ? catchPhotos : catchPhoto ? [catchPhoto] : []
  const activePhotoIndex = photoList.length ? photoIndex % photoList.length : 0
  const activePhoto = photoList[activePhotoIndex] || species?.photo
  const showPhoto = activePhoto && failedPhoto !== activePhoto
  const rank = species ? ranks[Math.max(0, Object.keys(regulations.species).indexOf(species.id))] || '★' : '★'
  const suit = species ? suits[Math.max(0, Object.keys(regulations.species).indexOf(species.id)) % suits.length] : '♣'

  useEffect(() => {
    if (photoList.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      if (!pauseCycle.current) setPhotoIndex((index) => (index + 1) % photoList.length)
    }, 3500)
    return () => window.clearInterval(timer)
  }, [species?.id, photoList.length])

  const stepPhoto = (direction) => setPhotoIndex((index) => (index + direction + photoList.length) % photoList.length)

  if (!species) return null

  if (mode === 'back') {
    return <div className="species-card card-back" aria-label="Go Fish card back"><img src="/go-fish-card-back.png" alt="Go Fish" /><svg className="card-back-frame" viewBox="0 0 100 170" preserveAspectRatio="none" aria-hidden="true"><path d="M8 2 C14 0 18 4 24 2 S34 0 40 2 S50 4 56 2 S66 0 72 2 S82 4 88 2 Q98 1 98 9 C100 15 96 19 98 25 S100 35 98 41 S96 51 98 57 S100 67 98 73 S96 83 98 89 L98 89 C100 95 96 99 98 105 S100 115 98 121 S96 131 98 137 S100 147 98 153 Q99 168 91 168 C85 170 81 166 75 168 S65 170 59 168 S49 166 43 168 S33 170 27 168 S17 166 11 168 Q2 168 2 160 C0 154 4 150 2 144 S0 134 2 128 S4 118 2 112 S0 102 2 96 S4 86 2 80 S0 70 2 64 S4 54 2 48 S0 38 2 32 S4 22 2 16 Q1 2 8 2 Z" /></svg></div>
  }
  if (mode === 'silhouette') {
    return (
      <button type="button" className={`species-card silhouette-card ${compact ? 'compact' : ''}`} onClick={onClick} aria-label={`Uncollected card: ${species.name}. ${label(species.howTo, 'Tap to learn how to catch it.')}`}>
        <span className="card-rank">? <small>♣</small></span>
        <div className="silhouette-art"><FishMark /></div>
        <div className="silhouette-copy"><h3>Tap to reveal</h3></div>
      </button>
    )
  }

  return (
    <article className={`species-card face-card ${compact ? 'compact' : ''} ${expanded ? 'expanded' : ''} ${compact && photoList.length > 1 ? 'has-photo-controls' : ''}`}>
      <button type="button" className="card-main" onClick={() => { if (onClick) onClick(photoList.length ? activePhoto : undefined); else setExpanded(!expanded) }} aria-expanded={onClick ? undefined : expanded}>
        <span className="card-rank">{rank}<small>{suit}</small></span>
        <div className={`card-art ${photoList.length ? 'catch-photo-art' : ''}`}>{showPhoto ? <img key={activePhoto} src={activePhoto} alt={photoList.length ? `${species.name} catch photo ${activePhotoIndex + 1} of ${photoList.length}` : species.name} title={!photoList.length ? `Photo: ${species.photoCredit}` : undefined} onError={() => setFailedPhoto(activePhoto)} /> : <FishMark />}</div>
        <div className="card-information"><div className="card-title-row"><h3>{species.name}</h3>{likelihood && <span className={`likelihood likelihood-${likelihood}`}>{likelihood}</span>}</div>
          <p className="card-bait"><span className="mini-icon">⌁</span> {species.bait?.length ? species.bait.join(' · ') : 'Bait details soon'}</p>
          {!compact && <><div className="card-rule" /><p className="card-detail"><b>Rig</b><span>{label(species.rig)}</span></p><p className="card-detail"><b>How to fish</b><span>{label(species.howTo)}</span></p><p className="card-detail"><b>Limits</b><span>{limitSummary(regulations.species[species.id])}</span></p><p className="card-detail"><b>Handling</b><span>{label(species.handling)}</span></p>
            <p className="eat-note"><span>{species.eat?.ok === true ? '✓' : species.eat?.ok === false ? '!' : '↗'}</span> {species.eat?.ok == null ? 'Check local advisories before eating' : species.eat.note}</p></>}
        </div>
      </button>
      {compact && photoList.length > 1 && <div className="photo-cycle-controls" role="group" aria-label={`${species.name} catch photos`} onMouseEnter={() => { pauseCycle.current = true }} onMouseLeave={() => { pauseCycle.current = false }} onFocus={() => { pauseCycle.current = true }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) pauseCycle.current = false }}>
        <button type="button" onClick={() => stepPhoto(-1)} aria-label="Previous photo"><ArcArrow direction="left" /></button>
        <span aria-live="off">{activePhotoIndex + 1}/{photoList.length}</span>
        <button type="button" onClick={() => stepPhoto(1)} aria-label="Next photo"><ArcArrow direction="right" /></button>
      </div>}
      {compact && expanded && <div className="compact-details"><p><b>How to rig:</b> {label(species.rig)}</p><p><b>How to fish:</b> {label(species.howTo)}</p><p><b>Handling:</b> {label(species.handling)}</p><p><b>Limits:</b> {limitSummary(regulations.species[species.id])}</p>{species.photoCredit && <p className="card-photo-credit">Photo: {species.photoCredit}</p>}<a className="card-source" href={regulations.species[species.id]?.sourceUrl || regulations.sourceUrl} target="_blank" rel="noreferrer">Texas rules · updated {regulations.updated} ↗</a></div>}
      {!compact && <a className="card-source" href={regulations.species[species.id]?.sourceUrl || regulations.sourceUrl} target="_blank" rel="noreferrer">Texas rules · updated {regulations.updated} ↗</a>}
    </article>
  )
}
