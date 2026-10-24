import Screen from '../components/Screen'
import SpeciesCard from '../components/SpeciesCard'
import { ErrorState, Loading } from '../components/Status'
import { usePlan } from '../services/usePlan'
import { speciesById } from '../services/content'
import { useEffect, useState } from 'react'

// Owner: Frontend lead. Today's draw + likely species.
export default function Hand() {
  const { day, loading, error } = usePlan()
  const drawId = day?.draw
  const draw = drawId && speciesById[drawId]
  const [revealedDraw, setRevealedDraw] = useState(null)
  const revealed = revealedDraw === drawId
  useEffect(() => {
    if (!drawId) return undefined
    const timer = window.setTimeout(() => setRevealedDraw(drawId), 750)
    return () => window.clearTimeout(timer)
  }, [drawId])

  return (
    <Screen title="Meet today's likely catch." eyebrow="YOUR HAND · A FEW GOOD POSSIBILITIES" nav>
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {day && (
        <div className="hand-content">
          <div className="hand-intro"><span className="draw-label"><i /> TODAY'S DRAW</span><p>One fish to keep in mind. A few more that might surprise you.</p></div>
          {draw && <div className={`draw-stage ${revealed ? 'revealed' : ''}`}>
            <div className="draw-flip-card"><div className="draw-card-face"><SpeciesCard species={draw} /></div><div className="draw-card-back"><SpeciesCard species={draw} mode="back" /></div></div>
            <button className="flip-control" onClick={() => setRevealedDraw(revealed ? null : draw.id)}>{revealed ? 'Flip it back' : 'Reveal your draw'} <span>↻</span></button>
          </div>}
          <section className="also-biting"><div className="section-heading"><div><p className="eyebrow">KEEP AN EYE OUT</p><h2>Also in the cards</h2></div><span className="round-icon">♧</span></div>
            <div className="likely-list">{day.likelySpecies.filter((entry) => entry.id !== day.draw && speciesById[entry.id]).slice(0, 3).map((entry, index) => <div className="likely-item" key={entry.id}>
              <span className="likely-index">0{index + 1}</span><SpeciesCard species={speciesById[entry.id]} compact likelihood={entry.likelihood} />
            </div>)}</div>
          </section>
          <p className="plan-footnote">These are possibilities based on conditions—not a guarantee of what you'll catch.</p>
        </div>
      )}
    </Screen>
  )
}
