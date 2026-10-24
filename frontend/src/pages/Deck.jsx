import { useEffect, useMemo, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import Screen from '../components/Screen'
import SpeciesCard from '../components/SpeciesCard'
import { species } from '../services/content'

const STORAGE_KEY = 'go-fish-catches-v1'

export default function Deck() {
  const [catches, setCatches] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [logging, setLogging] = useState(false)
  const [photo, setPhoto] = useState('')
  const [speciesId, setSpeciesId] = useState('')
  const [clueId, setClueId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    get(STORAGE_KEY).then((saved) => setCatches(Array.isArray(saved) ? saved : [])).catch(() => setCatches([])).finally(() => setLoaded(true))
  }, [])

  const counts = useMemo(() => catches.reduce((all, entry) => ({ ...all, [entry.speciesId]: (all[entry.speciesId] || 0) + 1 }), {}), [catches])
  const saveCatch = async (event) => {
    event.preventDefault()
    if (!speciesId || !photo) return
    const updated = [...catches, { id: crypto.randomUUID(), speciesId, photo, caughtAt: new Date().toISOString() }]
    setCatches(updated)
    await set(STORAGE_KEY, updated)
    setLogging(false)
    setPhoto('')
    setSpeciesId('')
  }
  const readPhoto = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }
  const clue = species.find((item) => item.id === clueId)

  return (
    <Screen title="Your fishing stories, collected." nav>
      <div className="deck-content">
        <section className="deck-summary"><div className="deck-summary-top"><span className="deck-stamp">✳</span><span>YOUR LITTLE BIT OF THE GULF</span></div>
          <div className="deck-progress-row"><div><b>{new Set(catches.map((entry) => entry.speciesId)).size}</b><span> / {species.length} species</span></div><span>{catches.length} {catches.length === 1 ? 'catch' : 'catches'} logged</span></div>
          <div className="deck-meter"><span style={{ width: `${Math.min(100, new Set(catches.map((entry) => entry.speciesId)).size / species.length * 100)}%` }} /></div>
          <p>Every fish has a story. Keep them here—catch and release counts, too.</p>
        </section>
        <div className="deck-tools"><div><h2>Your collection</h2></div><button className="button button-dark log-catch-button" onClick={() => setLogging(true)}>＋ Log a catch</button></div>
        {catches.length >= 4 && Object.entries(counts).filter(([, count]) => count >= 4).map(([id]) => <div className="four-kind-banner" key={id}><span>♧</span><p><b>Four of a kind!</b> You've logged four {species.find((item) => item.id === id)?.name}.</p><span>✦</span></div>)}
        {!loaded ? <div className="loading-card" role="status"><span className="skeleton-line wide" /><span className="skeleton-block" /></div> : <div className="deck-grid">{species.map((item) => {
          const count = counts[item.id] || 0
          return <div className="deck-card-wrap" key={item.id}>
            {count ? <div className="collected-card"><span className="collected-count">{count} {count === 1 ? 'catch' : 'catches'}</span><SpeciesCard species={item} compact /></div> : <SpeciesCard species={item} mode="silhouette" compact onClick={() => setClueId(item.id)} />}
          </div>
        })}</div>}
        <p className="deck-private-note"><span>▣</span> Your catches and photos stay on this device.</p>
      </div>
      {logging && <div className="modal-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setLogging(false) }}>
        <form className="catch-modal" onSubmit={saveCatch} role="dialog" aria-modal="true" aria-labelledby="catch-title">
          <button type="button" className="modal-close" onClick={() => setLogging(false)} aria-label="Close">×</button><p className="eyebrow">A MOMENT WORTH KEEPING</p><h2 id="catch-title">Log your catch</h2><p className="muted">Catch-and-release counts. Choose the fish yourself—no AI guessing.</p>
          <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => readPhoto(event.target.files?.[0])} />
          <button type="button" className={`photo-picker ${photo ? 'has-photo' : ''}`} onClick={() => fileRef.current?.click()}>{photo ? <img src={photo} alt="Selected catch" /> : <><span>＋</span><b>Take or choose a photo</b><small>Stored privately on this device</small></>}</button>
          <label className="species-select-label" htmlFor="caught-species">Which one looks like yours?</label><select id="caught-species" value={speciesId} onChange={(event) => setSpeciesId(event.target.value)} required><option value="">Choose a fish…</option>{species.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <button className="button button-dark save-catch-button" type="submit" disabled={!photo || !speciesId}>Add to my deck <span>→</span></button>
        </form>
      </div>}
      {clue && <div className="modal-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setClueId(null) }}><section className="clue-modal" role="dialog" aria-modal="true" aria-labelledby="clue-title">
        <button type="button" className="modal-close" onClick={() => setClueId(null)} aria-label="Close">×</button><p className="eyebrow">YOUR NEXT CARD IS HIDING</p><h2 id="clue-title">How to meet a {clue.name}</h2><div className="clue-tip"><span>BAIT</span><b>{clue.bait?.length ? clue.bait.join(' or ') : 'Bait details coming soon'}</b></div><div className="clue-tip"><span>TRY THIS</span><b>{clue.howTo || 'Keep it simple: fish from shore or pier and watch the line.'}</b></div><button className="button button-dark save-catch-button" onClick={() => { setClueId(null); setLogging(true) }}>Log a catch <span>→</span></button>
      </section></div>}
    </Screen>
  )
}
