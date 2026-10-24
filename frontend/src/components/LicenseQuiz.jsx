import { useMemo, useState } from 'react'
import { spots } from '../services/content'

export default function LicenseQuiz() {
  const [resident, setResident] = useState(null)
  const [age, setAge] = useState('')
  const [spotId, setSpotId] = useState('')
  const [open, setOpen] = useState(true)
  const spot = spots.find((item) => item.id === spotId)
  const complete = resident !== null && age !== '' && spot !== undefined
  const result = useMemo(() => {
    if (!complete) return null
    const exempt = age === 'under17' || spot.inStatePark
    return {
      exempt,
      title: exempt ? 'No license needed for this trip.' : 'Yes, you need a Texas saltwater fishing license.',
      detail: age === 'under17'
        ? 'Anglers under 17 are exempt. Size and bag limits still apply.'
        : spot.inStatePark
          ? 'Fishing within Texas State Park boundaries is license-exempt. Park entry fees and fish limits still apply.'
          : resident
            ? 'Texas residents born before January 1, 1931 are also exempt.'
            : 'This applies to fishing at the Galveston pier, outside state park boundaries.',
    }
  }, [complete, resident, age, spot])

  return <section className="panel license-panel">
    <button className="section-heading quiz-heading" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span><h2>Do I need a license?</h2></span><span className="round-icon">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="quiz-body">
      <fieldset className="quiz-question"><legend>Are you a Texas resident?</legend><div className="choice-row">
        {[['yes', 'Yes'], ['no', 'No']].map(([value, text]) => <button type="button" key={value} className={`choice-button ${resident === (value === 'yes') ? 'chosen' : ''}`} aria-pressed={resident === (value === 'yes')} onClick={() => setResident(value === 'yes')}>{text}</button>)}
      </div></fieldset>
      <fieldset className="quiz-question"><legend>How old are you?</legend><div className="choice-row age-choices">
      {[['under17', 'Under 17'], ['adult', '17 or older']].map(([value, text]) => <button type="button" key={value} className={`choice-button ${age === value ? 'chosen' : ''}`} aria-pressed={age === value} onClick={() => setAge(value)}>{text}</button>)}
      </div></fieldset>
      <fieldset className="quiz-question"><legend>Where will you fish?</legend><div className="spot-choices">
        {spots.map((item) => <button type="button" key={item.id} className={`choice-button spot-choice ${spotId === item.id ? 'chosen' : ''}`} aria-pressed={spotId === item.id} onClick={() => setSpotId(item.id)}>{item.id === 'gisp-beach' ? 'State park · beach' : item.id === 'gisp-bay' ? 'State park · bay' : 'Galveston pier'}</button>)}
      </div></fieldset>
      {complete && <div className={`quiz-result ${result.exempt ? 'quiz-result-exempt' : ''}`} role="status"><span className="result-icon" aria-hidden="true">{result.exempt ? '✓' : '!'}</span><div><b>{result.title}</b><p>{result.detail}</p></div></div>}
      <a className="tpwd-link" href="https://tpwd.texas.gov/faq/fishboat/fish/" target="_blank" rel="noreferrer">{complete && result.exempt ? 'Double-check this with TPWD' : 'TPWD license rules'} <span>↗</span></a>
    </div>}
  </section>
}
