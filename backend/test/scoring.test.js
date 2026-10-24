import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCORE_BASE, scoreHour, scoreSpotDay, buildWindows, pickWindows, sunTimes, tideRate,
} from '../services/scoring.js'
import { spots } from '../services/data.js'
import { chicagoHHMM } from '../services/time.js'

const spot = (id) => spots.find((s) => s.id === id)
const HOUR = 60 * 60 * 1000
const date = '2026-10-24'
const noon = '2026-10-24T17:00:00Z' // 12:00 CDT, far from sunrise/sunset
const calm = { windMph: 6, windFromDeg: 0 }

const effects = (why) => why.reduce((s, w) => s + w.effect, 0)
const effect = (why, input) => why.find((w) => w.input === input).effect

test('slack tide scores lower than moving tide', () => {
  const base = { spot: spot('galveston-pier'), t: noon, waterTempF: 72, weather: calm, pressureChange3h: 0 }
  const slack = scoreHour({ ...base, tideRate: 0.005 })
  const moving = scoreHour({ ...base, tideRate: -0.12 })
  assert.ok(slack.score < moving.score, `${slack.score} < ${moving.score}`)
  assert.ok(effect(slack.why, 'tide') < 0)
  assert.ok(effect(moving.why, 'tide') > 0)
})

test('tideRate reads ft/hour from the hourly series', () => {
  const tide = [0, 1, 2].map((h) => ({ t: new Date(Date.parse(noon) + h * HOUR).toISOString(), ft: 1 + h * 0.1 }))
  assert.ok(Math.abs(tideRate(tide, tide[1].t) - 0.1) < 1e-9)
  assert.ok(Math.abs(tideRate(tide, tide[0].t) - 0.1) < 1e-9)
  assert.equal(tideRate([], noon), null)
})

test('strong onshore wind penalizes gisp-beach but not gisp-bay', () => {
  const onshore = { windMph: 22, windFromDeg: 150 } // from the SSE, straight onto the beach
  const inputs = { t: noon, tideRate: 0.08, waterTempF: 72, weather: onshore, pressureChange3h: 0 }
  const beach = scoreHour({ ...inputs, spot: spot('gisp-beach') })
  const bay = scoreHour({ ...inputs, spot: spot('gisp-bay') })
  assert.ok(effect(beach.why, 'wind') < 0, 'beach is penalized')
  assert.ok(effect(bay.why, 'wind') >= 0, 'bay is not penalized')
  assert.ok(beach.score < bay.score)
})

test('scores always equal base + effects (clamped 0-100), every input labeled', () => {
  const winds = [null, 0, 12, 25, 40]
  const rates = [null, 0, 0.05, -0.2]
  const temps = [null, 45, 72, 95]
  const pressures = [null, -5, -2, 0, 2, 5]
  const times = [noon, '2026-10-24T12:30:00Z', '2026-11-01T23:00:00Z']
  for (const s of spots) for (const windMph of winds) for (const tideRate of rates)
    for (const waterTempF of temps) for (const pressureChange3h of pressures) for (const t of times) {
      const { score, why } = scoreHour({ spot: s, t, tideRate, waterTempF, weather: { windMph, windFromDeg: 150 }, pressureChange3h })
      assert.equal(score, Math.min(100, Math.max(0, SCORE_BASE + effects(why))))
      assert.deepEqual(why.map((w) => w.input), ['tide', 'waterTemp', 'wind', 'light', 'pressure'])
      for (const w of why) {
        assert.ok(['data', 'rule of thumb'].includes(w.label))
        assert.ok(Number.isInteger(w.effect))
      }
    }
})

test('sunrise/sunset land at sensible Galveston local times', () => {
  const { sunrise, sunset } = sunTimes(date)
  assert.match(chicagoHHMM(sunrise), /^07:[0-5]\d$/) // ~07:25 CDT late October
  assert.match(chicagoHHMM(sunset), /^18:[3-5]\d$/) // ~18:45 CDT
})

// Builds hourly scores for a day where only the given local hours (CDT) are good.
function fakeHours(goodHours, score = 75) {
  const midnight = Date.parse('2026-10-24T05:00:00Z')
  return Array.from({ length: 24 }, (_, h) => ({
    t: new Date(midnight + h * HOUR).toISOString(),
    score: goodHours.includes(h) ? score : 40,
    why: [],
  }))
}

test('windows are consecutive hours >= 60, end is exclusive', () => {
  const w = buildWindows('gisp-bay', fakeHours([7, 8, 17]))
  assert.equal(w.length, 2)
  assert.deepEqual(pickWindows(w).map(({ start, end }) => [start, end]), [['07:00', '09:00'], ['17:00', '18:00']])
})

test('picked windows never overlap across spots and come back in time order', () => {
  const all = [
    ...buildWindows('gisp-bay', fakeHours([7, 8, 9], 80)),
    ...buildWindows('galveston-pier', fakeHours([8, 9], 70)), // overlaps the better bay window
    ...buildWindows('gisp-beach', fakeHours([17, 18], 74)),
  ]
  const picked = pickWindows(all)
  assert.deepEqual(picked.map((w) => [w.spotId, w.start]), [['gisp-bay', '07:00'], ['gisp-beach', '17:00']])
})

test('scoreSpotDay handles the 25-hour DST day (Nov 1, 2026)', () => {
  const midnight = Date.parse('2026-11-01T05:00:00Z')
  const hours = Array.from({ length: 25 }, (_, h) => ({
    t: new Date(midnight + h * HOUR).toISOString(), windMph: 8, windFromDeg: 0, pressureHpa: 1015,
  }))
  const tide = hours.map((h, i) => ({ t: h.t, ft: 1 + Math.sin(i / 2) }))
  const scored = scoreSpotDay({ spot: spot('gisp-bay'), date: '2026-11-01', tide, waterTempF: 70, weatherHours: hours })
  assert.equal(scored.length, 25)
  for (const w of pickWindows(buildWindows('gisp-bay', scored))) assert.match(w.start, /^\d\d:\d\d$/)
})

test('no night windows for beginners, even when the night scores well', () => {
  const hours = fakeHours([0, 1, 2, 7, 8], 85).map((h) => ({ ...h, daylight: chicagoHHMM(new Date(h.t)) >= '06:00' }))
  assert.deepEqual(pickWindows(buildWindows('gisp-bay', hours)).map((w) => w.start), ['07:00'])
  const dark = scoreHour({ spot: spot('gisp-bay'), t: '2026-10-24T07:00:00Z', tideRate: 0.1, waterTempF: 72, weather: calm, pressureChange3h: 0 })
  assert.equal(dark.daylight, false)
  assert.ok(dark.why.find((w) => w.input === 'light').effect < 0)
})
