import { useEffect, useMemo, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import Screen from '../components/Screen'
import SpeciesCard from '../components/SpeciesCard'
import { species } from '../services/content'

const STORAGE_KEY = 'go-fish-catches-v1'
const fishFactSources = {
  croaker: 'https://tpwd.texas.gov/fishing/sea-center-texas/flora-fauna-guide/bays-and-estuaries/bay-animals/atlantic-croaker',
  whiting: 'https://tpwd.texas.gov/fishing/sea-center-texas/flora-fauna-guide/nearshore-waters/animals-of-the-nearshore-waters/southern-kingfish',
  sheepshead: 'https://tpwd.texas.gov/fishing/sea-center-texas/flora-fauna-guide/jetties/jetty-life/sheepshead',
  'black-drum': 'https://tpwd.texas.gov/huntwild/wild/species/blackdrum/',
  'red-drum': 'https://tpwd.texas.gov/huntwild/wild/species/reddrum/',
  'speckled-trout': 'https://tpwd.texas.gov/huntwild/wild/species/strout/',
  'hardhead-catfish': 'https://tpwd.texas.gov/fishing/sea-center-texas/flora-fauna-guide/bays-and-estuaries/bay-animals/hardhead-catfish/',
}

export default function Deck() {
  const [catches, setCatches] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [logging, setLogging] = useState(false)
  const [photos, setPhotos] = useState([])
  const [speciesId, setSpeciesId] = useState('')
  const [clueId, setClueId] = useState(null)
  const [selectedFishId, setSelectedFishId] = useState(null)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    get(STORAGE_KEY).then((saved) => setCatches(Array.isArray(saved) ? saved : [])).catch(() => setCatches([])).finally(() => setLoaded(true))
  }, [])

  const counts = useMemo(() => catches.reduce((all, entry) => ({ ...all, [entry.speciesId]: (all[entry.speciesId] || 0) + 1 }), {}), [catches])
  const photosBySpecies = useMemo(() => [...catches].reverse().reduce((all, entry) => {
    const entries = Array.isArray(entry.photos) ? entry.photos : entry.photo ? [entry.photo] : []
    const photosForSpecies = all[entry.speciesId] || (all[entry.speciesId] = [])
    entries.forEach((image) => { if (image && !photosForSpecies.includes(image)) photosForSpecies.push(image) })
    return all
  }, {}), [catches])
  const saveCatch = async (event) => {
    event.preventDefault()
    if (!speciesId || !photos.length) return
    const updated = [...catches, { id: crypto.randomUUID(), speciesId, photo: photos[0], photos, caughtAt: new Date().toISOString() }]
    setCatches(updated)
    await set(STORAGE_KEY, updated)
    setLogging(false)
    setPhotos([])
    setSpeciesId('')
  }
  const readPhotos = async (files) => {
    if (!files?.length) return
    const loadedPhotos = await Promise.all(Array.from(files).map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })))
    setPhotos(loadedPhotos.filter(Boolean))
  }
  const clue = species.find((item) => item.id === clueId)
  const selectedFish = species.find((item) => item.id === selectedFishId)

  return (
    <Screen title="Your fishing stories, collected." nav>
      <div className="deck-content">
        <section className="deck-summary">
          <div className="deck-progress-row"><div><b>{new Set(catches.map((entry) => entry.speciesId)).size}</b><span> / {species.length} species</span></div><span>{catches.length} {catches.length === 1 ? 'catch' : 'catches'} logged</span></div>
          <div className="deck-meter"><span style={{ width: `${Math.min(100, new Set(catches.map((entry) => entry.speciesId)).size / species.length * 100)}%` }} /></div>
        </section>
        <div className="deck-tools"><div><h2>Your collection</h2></div><button className="button button-dark log-catch-button" onClick={() => setLogging(true)}>＋ Log a catch</button></div>
        {catches.length >= 4 && Object.entries(counts).filter(([, count]) => count >= 4).map(([id]) => <div className="four-kind-banner" key={id}><span>♧</span><p><b>Four of a kind!</b> You've logged four {species.find((item) => item.id === id)?.name}.</p><span>✦</span></div>)}
        {!loaded ? <div className="loading-card" role="status"><span className="skeleton-line wide" /><span className="skeleton-block" /></div> : <div className="deck-grid">{species.map((item) => {
          const count = counts[item.id] || 0
          return <div className="deck-card-wrap" key={item.id}>
            {count ? <div className="collected-card"><span className="collected-count" aria-label={`${count} ${count === 1 ? 'catch' : 'catches'}`}>{count}×</span><SpeciesCard species={item} compact catchPhotos={photosBySpecies[item.id]} onClick={(photo) => { setSelectedFishId(item.id); setSelectedPhoto(photo || null) }} /></div> : <SpeciesCard species={item} mode="silhouette" compact onClick={() => setClueId(item.id)} />}
          </div>
        })}</div>}
        <p className="deck-private-note">Your catches and photos stay on this device.</p>
      </div>
      {logging && <div className="modal-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setLogging(false) }}>
        <form className="catch-modal" onSubmit={saveCatch} role="dialog" aria-modal="true" aria-labelledby="catch-title">
          <button type="button" className="modal-close" onClick={() => setLogging(false)} aria-label="Close">×</button><h2 id="catch-title">Log your catch</h2><p className="muted">Catch-and-release counts.</p>
          <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { readPhotos(event.target.files); event.target.value = '' }} aria-label="Choose catch photos" />
          <button type="button" className={`photo-picker ${photos.length ? 'has-photo' : ''}`} onClick={() => fileRef.current?.click()}>{photos.length ? <div className="photo-picker-preview">{photos.slice(0, 4).map((image, index) => <img src={image} alt={`Selected catch ${index + 1}`} key={`${index}-${image.length}`} />)}{photos.length > 4 && <span className="photo-picker-more">+{photos.length - 4}</span>}<b>{photos.length} {photos.length === 1 ? 'photo' : 'photos'} selected</b></div> : <><span>＋</span><b>Take or choose photos</b></>}</button>
          <label className="species-select-label" htmlFor="caught-species">Which one looks like yours?</label><select id="caught-species" value={speciesId} onChange={(event) => setSpeciesId(event.target.value)} required><option value="">Choose a fish…</option>{species.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <button className="button button-dark save-catch-button" type="submit" disabled={!photos.length || !speciesId}>Add to my deck <span>→</span></button>
        </form>
      </div>}
      {clue && <div className="modal-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setClueId(null) }}><section className="clue-modal" role="dialog" aria-modal="true" aria-labelledby="clue-title">
        <button type="button" className="modal-close" onClick={() => setClueId(null)} aria-label="Close">×</button><h2 id="clue-title">How to meet a {clue.name}</h2><div className="clue-tip"><b>{clue.bait?.length ? `Bait: ${clue.bait.join(' or ')}` : 'Bait information unavailable'}</b></div><div className="clue-tip"><b>{clue.howTo || 'Fish from shore or pier and watch your line.'}</b></div><button className="button button-dark save-catch-button" onClick={() => { setClueId(null); setLogging(true) }}>Log a catch <span>→</span></button>
      </section></div>}
      {selectedFish && <div className="modal-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedFishId(null) }}><section className="fish-detail-modal" role="dialog" aria-modal="true" aria-labelledby="fish-detail-title">
        <button type="button" className="modal-close" onClick={() => setSelectedFishId(null)} aria-label="Close">×</button>
        <img className="fish-detail-photo" src={selectedPhoto || photosBySpecies[selectedFish.id]?.[0] || selectedFish.photo} alt={`${selectedFish.name} catch`} />
        <h2 id="fish-detail-title">{selectedFish.name}</h2>
        {selectedFish.funFact && <div className="fish-fact-panel"><span>FISH FACT</span><p>{selectedFish.funFact}</p><a href={fishFactSources[selectedFish.id]} target="_blank" rel="noreferrer">Texas Parks &amp; Wildlife ↗</a></div>}
        {selectedFish.bait?.length > 0 && <p className="fish-detail-bait"><b>Bait:</b> {selectedFish.bait.join(' · ')}</p>}
      </section></div>}
    </Screen>
  )
}
