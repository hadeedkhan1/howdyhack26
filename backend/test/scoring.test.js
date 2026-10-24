import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCORE_BASE, scoreHour, scoreSpotDay, buildWindows, pickWindows, sunTimes, tideRate,
  tideWhy, windWhy, pressureWhy, isOnshore,
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

// --- Edge cases and realistic days ----------------------------------------------------------

// Real NOAA hourly predictions for Pier 21, Oct 25 2026 from 00:00 CDT (05:00Z): a 1.5 ft swing.
const REAL_TIDE_FT = [1.401, 1.494, 1.573, 1.603, 1.555, 1.407, 1.165, 0.878, 0.622, 0.458, 0.41, 0.478,
  0.654, 0.914, 1.218, 1.514, 1.751, 1.887, 1.9, 1.811, 1.68, 1.57, 1.509, 1.496]
const realDay = (over = {}) => {
  const from = Date.parse('2026-10-25T05:00:00Z')
  const t = (h) => new Date(from + h * HOUR).toISOString()
  return {
    tide: REAL_TIDE_FT.map((ft, h) => ({ t: t(h), ft })),
    // Typical fall day: light SE breeze, steady pressure.
    weatherHours: REAL_TIDE_FT.map((_, h) => ({ t: t(h), tempF: 76, feelsLikeF: 78, windMph: 10, windFromDeg: 140, pressureHpa: 1015 + h * 0.05, waveFt: 2, ...over })),
  }
}

test('realistic fall day: windows exist, only in daylight, each at a moving tide', () => {
  const { tide, weatherHours } = realDay()
  const bySpot = Object.fromEntries(spots.map((s) => [s.id, scoreSpotDay({ spot: s, date: '2026-10-25', tide, waterTempF: 76, weatherHours })]))
  const windows = pickWindows(spots.flatMap((s) => buildWindows(s.id, bySpot[s.id])))
  assert.ok(windows.length >= 1 && windows.length <= 3, `${windows.length} windows`)
  const { sunrise, sunset } = sunTimes('2026-10-25')
  for (const w of windows) {
    assert.ok(w.start >= chicagoHHMM(new Date(sunrise - HOUR)), `${w.start} not before dawn`)
    assert.ok(w.end <= chicagoHHMM(new Date(sunset.getTime() + HOUR)), `${w.end} ends by last light (1h after sunset)`)
    assert.ok(effect(w.why, 'tide') >= 0, `${w.spotId} ${w.start}: not recommended at slack tide`)
  }
})

test('realistic cold front: strong onshore wind and fast-rising pressure score lower everywhere', () => {
  const fair = realDay()
  const front = realDay({ windMph: 26, windFromDeg: 160 })
  front.weatherHours.forEach((h, i) => { h.pressureHpa = 1010 + i * 1.5 })
  const peak = (d, s) => Math.max(...scoreSpotDay({ spot: s, date: '2026-10-25', tide: d.tide, waterTempF: 60, weatherHours: d.weatherHours }).map((h) => h.score))
  for (const s of spots) assert.ok(peak(front, s) < peak(fair, s), s.id)
})

test('"NEEDS CHECK" coordinates still give daylight hours and windows (sun times fall back to Galveston)', () => {
  const { tide, weatherHours } = realDay()
  const bay = { ...spot('gisp-bay'), lat: 'NEEDS CHECK', lon: 'NEEDS CHECK' }
  const scored = scoreSpotDay({ spot: bay, date: '2026-10-25', tide, waterTempF: 74, weatherHours })
  assert.ok(scored.some((h) => h.daylight), 'some hours are daylight')
  assert.ok(scored.every((h) => Number.isFinite(h.score)))
  assert.ok(buildWindows(bay.id, scored).length > 0)
})

test('species.json placeholders never crash scoring ("NEEDS CHECK" strings, inverted ranges)', () => {
  const t = noon
  const base = { spot: spot('gisp-bay'), t, tideRate: 0.08, weather: calm, pressureChange3h: 0 }
  const weird = [
    [{ id: 'a', name: 'A', spotTypes: 'NEEDS CHECK', waterTempF: 'NEEDS CHECK' }],
    [{ id: 'b', name: 'B', spotTypes: ['bay'], waterTempF: null }],
    [{ id: 'c', name: 'C', spotTypes: ['bay'], waterTempF: ['NEEDS CHECK', 80] }],
    [{ id: 'c2', name: 'C2', spotTypes: ['bay'], waterTempF: 'NEEDS CHECK' }],
    [{ id: 'd', name: 'D', spotTypes: ['bay'], waterTempF: [80, 60] }], // min/max swapped
    [{ id: 'e', name: 'E' }],
  ]
  for (const species of weird) {
    const r = scoreHour({ ...base, waterTempF: 72, species })
    const w = r.why.find((x) => x.input === 'waterTemp')
    assert.equal(w.label, 'rule of thumb', `${species[0].id}: unusable range -> generic rule`)
    assert.ok(w.effect > 0, `${species[0].id}: 72°F is comfortable, not "outside every range"`)
  }
  // A species with unknown spot types counts at every spot (same as species.js).
  const anySpot = [{ id: 'x', name: 'X', spotTypes: 'NEEDS CHECK', waterTempF: [60, 80] }]
  const r = scoreHour({ ...base, waterTempF: 70, species: anySpot })
  assert.match(r.why.find((x) => x.input === 'waterTemp').value, /in range for x/)
})

test('real species ranges: in range for several fish beats out of range', () => {
  const sp = [
    { id: 'croaker', name: 'Croaker', spotTypes: ['bay', 'pier'], waterTempF: [60, 85] },
    { id: 'whiting', name: 'Whiting', spotTypes: ['surf'], waterTempF: [55, 80] },
  ]
  const at = (f, s = 'gisp-bay') => effect(scoreHour({ spot: spot(s), t: noon, tideRate: 0.05, waterTempF: f, weather: calm, pressureChange3h: 0, species: sp }).why, 'waterTemp')
  assert.ok(at(70) > 0)
  assert.ok(at(50) < 0)
  assert.ok(at(83, 'gisp-beach') < 0, 'only whiting at the beach, 83°F is too warm')
})

test('sun times match published Galveston times across the year (±15 min)', () => {
  const near = (d, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    const got = chicagoHHMM(d).split(':').map(Number)
    return Math.abs(got[0] * 60 + got[1] - (h * 60 + m)) <= 15
  }
  const cases = [
    ['2026-06-21', '06:22', '20:25'], // summer solstice, CDT
    ['2026-12-21', '07:09', '17:28'], // winter solstice, CST
    ['2026-11-01', '06:34', '17:37'], // first day of CST
    ['2026-03-20', '07:28', '19:36'], // equinox, CDT
  ]
  for (const [d, rise, set] of cases) {
    const { sunrise, sunset } = sunTimes(d)
    assert.ok(near(sunrise, rise), `${d} sunrise ${chicagoHHMM(sunrise)} ~ ${rise}`)
    assert.ok(near(sunset, set), `${d} sunset ${chicagoHHMM(sunset)} ~ ${set}`)
  }
})

test('23-hour DST-start day (Mar 14, 2027) scores 23 hours and windows read in CDT', () => {
  const from = Date.parse('2027-03-14T06:00:00Z') // 00:00 CST
  const hours = Array.from({ length: 23 }, (_, h) => ({ t: new Date(from + h * HOUR).toISOString(), windMph: 8, windFromDeg: 0, pressureHpa: 1015 }))
  const tide = hours.map((h, i) => ({ t: h.t, ft: 1 + 0.7 * Math.sin(i / 2) }))
  const scored = scoreSpotDay({ spot: spot('gisp-bay'), date: '2027-03-14', tide, waterTempF: 66, weatherHours: hours })
  assert.equal(scored.length, 23)
  const { sunrise } = sunTimes('2027-03-14')
  assert.match(chicagoHHMM(sunrise), /^07:[3-5]\d$/, 'sunrise ~07:40 CDT once clocks spring forward')
})

test('onshore wind: SE quadrant onto the Gulf beach, wraps around north correctly', () => {
  assert.equal(isOnshore(145), true)
  assert.equal(isOnshore(180), true)
  assert.equal(isOnshore(212), true)
  assert.equal(isOnshore(213), false)
  assert.equal(isOnshore(78), true)
  assert.equal(isOnshore(77), false)
  assert.equal(isOnshore(325), false, 'north-west wind blows offshore')
  assert.equal(isOnshore(0), false)
  assert.equal(isOnshore(350, 10), true, 'wraps through 0°')
  assert.equal(isOnshore(null), false)
  assert.equal(isOnshore(Number.NaN), false)
})

test('wind: strong onshore hurts an exposed spot more than strong offshore; calm helps', () => {
  const beach = spot('gisp-beach')
  const on = windWhy({ windMph: 22, windFromDeg: 150 }, beach.windExposure).effect
  const off = windWhy({ windMph: 22, windFromDeg: 330 }, beach.windExposure).effect
  const still = windWhy({ windMph: 4, windFromDeg: 150 }, beach.windExposure).effect
  assert.ok(on < off, `${on} < ${off}`)
  assert.ok(still > 0)
  assert.equal(windWhy({}, 'high').effect, 0, 'no data -> no effect')
})

test('tide input: unsorted points and gaps are handled; slack at the turn of the tide', () => {
  const t0 = Date.parse(noon)
  const pts = [2, 0, 1].map((h) => ({ t: new Date(t0 + h * HOUR).toISOString(), ft: 1 + h * 0.2 }))
  assert.ok(Math.abs(tideRate(pts, pts[2].t) - 0.2) < 1e-9, 'sorted internally')
  const withNaN = [...pts, { t: new Date(t0 + 3 * HOUR).toISOString(), ft: Number.NaN }]
  assert.ok(Number.isFinite(tideRate(withNaN, new Date(t0 + 3 * HOUR).toISOString())))
  // High tide near 18:00 CDT in the real data (1.887 -> 1.9 -> 1.811). Hourly samples rarely land
  // exactly on slack, but the turn still scores negative and well below mid-ebb.
  const { tide } = realDay()
  const turn = tideWhy(tideRate(tide, tide[18].t))
  assert.ok(turn.effect < 0, `turn of the tide: ${turn.value} ${turn.effect}`)
  assert.ok(tideWhy(tideRate(tide, tide[7].t)).effect > turn.effect)
  assert.equal(tideWhy(0.01).value, 'Slack tide (water barely moving)')
})

test('pressure: missing hours give no effect rather than NaN', () => {
  const hours = [1015, null, null, 1012].map((p, h) => ({ t: new Date(Date.parse(noon) + h * HOUR).toISOString(), windMph: 8, windFromDeg: 0, pressureHpa: p }))
  const scored = scoreSpotDay({ spot: spot('gisp-bay'), date, tide: [], weatherHours: hours })
  for (const h of scored) assert.ok(Number.isInteger(effect(h.why, 'pressure')))
  assert.equal(scored[3].why.find((w) => w.input === 'pressure').value, 'Falling fast', '-3 hPa in 3h')
  assert.equal(pressureWhy(-2).value, 'Falling slowly')
})

test('scores reach the 0-100 bounds without overflowing', () => {
  const sp = [{ id: 'a', name: 'A', spotTypes: [], waterTempF: [60, 80] }]
  const { sunrise } = sunTimes(date)
  const best = scoreHour({ spot: spot('gisp-bay'), t: sunrise.toISOString(), tideRate: 0.3, waterTempF: 70, weather: { windMph: 3, windFromDeg: 0 }, pressureChange3h: -2, species: [...sp, ...sp, ...sp] })
  assert.ok(best.score >= 95 && best.score <= 100, `best ${best.score}`)
  const worst = scoreHour({ spot: spot('gisp-beach'), t: '2026-10-24T08:00:00Z', tideRate: 0, waterTempF: 40, weather: { windMph: 40, windFromDeg: 150 }, pressureChange3h: 6, species: sp })
  assert.ok(worst.score >= 0 && worst.score < 20, `worst ${worst.score}`)
})

test('windows: long runs are trimmed to the best 3 hours; gaps split runs; input order does not matter', () => {
  const hrs = fakeHours([6, 7, 8, 9, 10, 11], 70).map((h, i) => ({ ...h, score: i === 9 ? 90 : h.score }))
  const [w] = buildWindows('gisp-bay', hrs)
  assert.equal(w.hours, 3)
  assert.equal(w.score, 90)
  const picked = pickWindows([w])[0]
  assert.ok(['07:00', '08:00', '09:00'].includes(picked.start), `best block contains the 90 (${picked.start})`)
  assert.deepEqual(buildWindows('gisp-bay', [...hrs].reverse()), buildWindows('gisp-bay', hrs))
  const gappy = fakeHours([7, 8, 9, 10], 75).filter((h) => !h.t.startsWith('2026-10-24T13'))
  assert.equal(buildWindows('gisp-bay', gappy).length, 2, 'a missing hour (08:00) splits the run')
})

test('windows: at most 3 picked, ties resolved the same way every time', () => {
  const many = ['gisp-bay', 'gisp-beach', 'galveston-pier'].flatMap((id, k) => buildWindows(id, fakeHours([6 + k * 4, 7 + k * 4], 70)))
    .concat(buildWindows('gisp-bay', fakeHours([18], 70)))
  assert.equal(many.length, 4)
  const a = pickWindows(many)
  assert.equal(a.length, 3)
  assert.deepEqual(pickWindows([...many].reverse()), a)
  assert.deepEqual(pickWindows([]), [])
})

test('an evening window ends by last light (1h after sunset), not an hour into the dark', () => {
  // Oct 31: sunset ~18:39 CDT. A 19:00 start would end at 20:00, well after dark.
  const from = Date.parse('2026-10-31T05:00:00Z')
  const hours = Array.from({ length: 24 }, (_, h) => ({ t: new Date(from + h * HOUR).toISOString(), windMph: 6, windFromDeg: 0, pressureHpa: 1015 }))
  const tide = hours.map((h, i) => ({ t: h.t, ft: 1 + 0.3 * i })) // always moving
  const scored = scoreSpotDay({ spot: spot('gisp-bay'), date: '2026-10-31', tide, waterTempF: 72, weatherHours: hours })
  const { sunset } = sunTimes('2026-10-31')
  const lastLight = chicagoHHMM(new Date(sunset.getTime() + HOUR))
  for (const w of pickWindows(buildWindows('gisp-bay', scored))) assert.ok(w.end <= lastLight, `${w.start}-${w.end} vs last light ${lastLight}`)
  assert.equal(scored[19].daylight, false, '19:00-20:00 is mostly dark')
  assert.equal(scored[18].daylight, true, '18:00-19:00 spans sunset')
})
