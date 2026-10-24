import Screen from '../components/Screen'
import SpeciesCard from '../components/SpeciesCard'
import { species } from '../services/content'

// Owner: Frontend 2. Collection of all 7 cards. Catches are stored on-device with idb-keyval.
// TODO: load collected species from IndexedDB, add "Log a catch" (camera + species picker).
export default function Deck() {
  const collected = new Set() // replace with data from IndexedDB

  return (
    <Screen title="Your deck" nav>
      <p className="mb-4">{collected.size} of {species.length} collected</p>
      <div className="grid grid-cols-2 gap-3">
        {species.map((s) => (
          <SpeciesCard key={s.id} species={s} mode={collected.has(s.id) ? 'face' : 'silhouette'} />
        ))}
      </div>
    </Screen>
  )
}
