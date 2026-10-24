import Screen from '../components/Screen'
import SpeciesCard from '../components/SpeciesCard'
import { ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'
import { speciesById } from '../services/content'

// Owner: Frontend lead. Today's draw + likely species.
export default function Hand() {
  const { day, loading, error } = usePlan()
  const draw = day && speciesById[day.draw]

  return (
    <Screen title="Your hand" nav>
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {day && (
        <div className="grid gap-4">
          <p className="font-semibold">Today's draw</p>
          {draw && <div className="mx-auto w-2/3"><SpeciesCard species={draw} /></div>}
          <p className="font-semibold">Also biting</p>
          <div className="grid grid-cols-2 gap-3">
            {day.likelySpecies
              .filter((s) => s.id !== day.draw && speciesById[s.id])
              .map((s) => <SpeciesCard key={s.id} species={speciesById[s.id]} />)}
          </div>
        </div>
      )}
    </Screen>
  )
}
