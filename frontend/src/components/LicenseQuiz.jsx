import { useMemo, useState } from 'react'
import { regulations, spots } from '../services/content'

export default function LicenseQuiz() {
  const [resident, setResident] = useState(null)
  const [age, setAge] = useState('')
  const [spotId, setSpotId] = useState('')
  const [open, setOpen] = useState(true)
  const spot = spots.find((item) => item.id === spotId)
  const complete = resident !== null && age !== '' && spot !== undefined
  const result = useMemo(() => {
    if (!complete) return null
    const rules = regulations.license.rules.filter((rule) => rule.condition && rule.condition !== 'NEEDS CHECK')
    const match = rules.find((rule) => {
      const condition = rule.condition.toLowerCase()
      return condition.includes(resident ? 'resident' : 'nonresident') || condition.includes(age) || (spot.inStatePark && condition.includes('state park'))
    })
    return match?.result && match.result !== 'NEEDS CHECK' ? match.result : 'Your answers are saved, but this rule needs an official check before you go.'
  }, [complete, resident, age, spot])

  return <section className="panel license-panel">
    <button className="section-heading quiz-heading" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span><p className="eyebrow">QUICK CHECK · 3 QUESTIONS</p><h2>Do I need a license?</h2></span><span className="round-icon">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="quiz-body">
      <fieldset className="quiz-question"><legend><span>01</span> Are you a Texas resident?</legend><div className="choice-row">
        {[['yes', 'Yes'], ['no', 'No']].map(([value, text]) => <button type="button" key={value} className={`choice-button ${resident === (value === 'yes') ? 'chosen' : ''}`} aria-pressed={resident === (value === 'yes')} onClick={() => setResident(value === 'yes')}>{text}</button>)}
      </div></fieldset>
      <fieldset className="quiz-question"><legend><span>02</span> How old are you?</legend><div className="choice-row age-choices">
        {[['under17', 'Under 17'], ['adult', '17 or older']].map(([value, text]) => <button type="button" key={value} className={`choice-button ${age === value ? 'chosen' : ''}`} aria-pressed={age === value} onClick={() => setAge(value)}>{text}</button>)}
      </div></fieldset>
      <fieldset className="quiz-question"><legend><span>03</span> Where will you fish?</legend><div className="spot-choices">
        {spots.map((item) => <button type="button" key={item.id} className={`choice-button spot-choice ${spotId === item.id ? 'chosen' : ''}`} aria-pressed={spotId === item.id} onClick={() => setSpotId(item.id)}>{item.id === 'gisp-beach' ? 'State park · beach' : item.id === 'gisp-bay' ? 'State park · bay' : 'Galveston pier'}</button>)}
      </div></fieldset>
      {complete && <div className="quiz-result" role="status"><span className="result-icon">i</span><div><b>{result}</b><p>License rules can depend on your answers and location. We won't guess when official data is unverified.</p></div></div>}
      {!complete && <p className="quiz-hint">Choose an answer for each to see your next step.</p>}
      <a className="button button-outline tpwd-link" href="https://tpwd.texas.gov/regulations/outdoor-annual/licenses/" target="_blank" rel="noreferrer">Check the official TPWD license rules <span>↗</span></a>
      <p className="source-note">Official rules · {regulations.updated === 'NEEDS CHECK' ? 'Our copy needs verification' : `Updated ${regulations.updated}`}</p>
    </div>}
  </section>
}
