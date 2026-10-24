import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import express from 'express'
import planRouter, { buildPlan } from '../routes/plan.js'
import { spots } from '../services/data.js'
import { chicagoMidnight } from '../services/time.js'

const mock = JSON.parse(readFileSync(new URL('../mock/plan.json', import.meta.url), 'utf8'))
const HOUR = 60 * 60 * 1000
const start = '2026-10-31' // two days spanning the Nov 1 DST change
const dates = ['2026-10-31', '2026-11-01']
const sent = '2026-10-31T12:00:00Z'

// Offline stand-ins for the three services, shaped like their real return values.
const hoursOf = (date) => {
  const from = chicagoMidnight(date).getTime()
  const to = chicagoMidnight(date === dates[0] ? dates[1] : '2026-11-02').getTime()
  return Array.from({ length: (to - from) / HOUR }, (_, i) => new Date(from + i * HOUR).toISOString())
}
const fakeTides = async () => ({
  days: dates.map((date) => ({ date, tide: hoursOf(date).map((t, i) => ({ t, ft: 1 + 0.6 * Math.sin(i / 2) })), hilo: [] })),
  waterTemp: { f: 72, observedAt: sent, stale: false, source: 'NOAA' }, salinity: null,
  source: 'NOAA', updatedAt: sent, missing: ['salinity'],
})
const fakeWeather = async () => ({
  days: dates.map((date) => ({
    date, missing: [],
    spots: Object.fromEntries(spots.map((s) => [s.id, hoursOf(date).map((t) => ({
      t, tempF: 75, feelsLikeF: 77, windMph: 8, windFromDeg: 0, pressureHpa: 1015, waveFt: 1.5,
    }))])),
  })),
  source: 'Open-Meteo', updatedAt: sent,
})
const fakeAlerts = async () => ({
  days: dates.map((date) => ({ date, spots: Object.fromEntries(spots.map((s) => [s.id, []])), rip: { level: 'low' }, missing: [] })),
  source: 'NWS', updatedAt: sent,
})
const fakes = { getTides: fakeTides, getWeather: fakeWeather, getAlerts: fakeAlerts }
const boom = async () => { throw new Error('network down') }

// Same keys and value types as mock/plan.json, recursively (arrays checked by their first item).
function sameShape(actual, expected, path = '') {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path} is an array`)
    if (expected.length && actual.length) sameShape(actual[0], expected[0], `${path}[0]`)
    return
  }
  if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${path} is an object`)
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path} keys`)
    for (const k of Object.keys(expected)) sameShape(actual[k], expected[k], `${path}.${k}`)
    return
  }
  // updatedAt may be null when the source didn't say; everything else must match type.
  if (actual === null && path.endsWith('updatedAt')) return
  assert.equal(typeof actual, typeof expected, `${path} type`)
}

test('live plan has the same shape as mock/plan.json', async () => {
  const plan = await buildPlan({ start, days: 2 }, fakes)
  sameShape(plan, mock)
  assert.equal(plan.snapshot, false)
  assert.equal(plan.scoreBase, 50)
  assert.deepEqual(plan.days.map((d) => d.date), dates)
  const [day] = plan.days
  assert.ok(day.windows.length > 0, 'fake data is good enough for at least one window')
  assert.equal(day.draw, day.likelySpecies[0].id)
  assert.equal(day.safety.verdict, 'go')
  assert.deepEqual(day.missing, ['salinity'])
  for (const w of day.windows) {
    assert.match(w.start, /^\d{2}:\d{2}$/)
    assert.equal(w.score, Math.min(100, Math.max(0, plan.scoreBase + w.why.reduce((s, x) => s + x.effect, 0))))
  }
  assert.equal(plan.days[1].tide.length, 25, 'Nov 1 has 25 hours')
})

test('every service failing still returns a full plan: caution, everything in missing', async () => {
  const plan = await buildPlan({ start, days: 2 }, { getTides: boom, getWeather: boom, getAlerts: () => { throw new Error('sync throw') } })
  sameShape(plan, { ...mock, days: [{ ...mock.days[0], windows: [], tide: [] }] })
  for (const d of plan.days) {
    assert.equal(d.safety.verdict, 'caution')
    assert.deepEqual(d.windows, [])
    assert.deepEqual(d.tide, [])
    assert.ok(d.draw, 'still a draw')
    for (const m of ['tide', 'water_temperature', 'weather', 'waves', 'nws_alerts', 'rip_current']) assert.ok(d.missing.includes(m), m)
  }
})

test('one service failing only removes what it feeds', async () => {
  const noAlerts = await buildPlan({ start, days: 1 }, { ...fakes, getAlerts: boom })
  assert.equal(noAlerts.days[0].safety.verdict, 'caution')
  assert.ok(noAlerts.days[0].windows.length > 0, 'windows do not need NWS')
  assert.ok(noAlerts.days[0].missing.includes('nws_alerts'))

  const noTides = await buildPlan({ start, days: 1 }, { ...fakes, getTides: boom })
  assert.equal(noTides.days[0].safety.verdict, 'go', 'tides are not a safety input')
  assert.deepEqual(noTides.days[0].tide, [])
  assert.ok(noTides.days[0].missing.includes('tide'))
})

test('a stale water temp is passed on as unknown', async () => {
  const stale = async () => ({ ...(await fakeTides()), waterTemp: { f: 40, observedAt: sent, stale: true, source: 'NOAA' }, missing: ['salinity', 'water_temperature'] })
  const plan = await buildPlan({ start, days: 1 }, { ...fakes, getTides: stale })
  // 40°F would rule fish out if it were used; unknown keeps them all "medium" or better.
  assert.ok(plan.days[0].likelySpecies.every((s) => s.likelihood !== 'low'))
  assert.ok(plan.days[0].missing.includes('water_temperature'))
})

test('HTTP: snapshot=demo still served, bad params rejected', async () => {
  const app = express().use('/api/plan', planRouter)
  const server = app.listen(0)
  const base = `http://localhost:${server.address().port}/api/plan`
  try {
    const demo = await fetch(`${base}?snapshot=demo`)
    assert.equal(demo.status, 200)
    assert.ok(Array.isArray((await demo.json()).days))
    assert.equal((await fetch(`${base}?start=tomorrow`)).status, 400)
    assert.equal((await fetch(`${base}?start=2026-10-31&days=3`)).status, 400)
  } finally {
    server.close()
  }
})

// --- Edge cases and realistic days ----------------------------------------------------------

import { checkPlan } from './contract-helpers.js'
import { addDays, chicagoHHMM } from '../services/time.js'
import { sunTimes } from '../services/scoring.js'

// Real NOAA Pier 21 hourly tide, Oct 25 2026 from 00:00 CDT.
const REAL_TIDE_FT = [1.401, 1.494, 1.573, 1.603, 1.555, 1.407, 1.165, 0.878, 0.622, 0.458, 0.41, 0.478,
  0.654, 0.914, 1.218, 1.514, 1.751, 1.887, 1.9, 1.811, 1.68, 1.57, 1.509, 1.496]

// Fakes for any start/days. `alerts(date)` returns NWS alert reasons per spot for that date.
function scenario({ start: s, days: n = 1, weather = {}, alerts = () => [], rip = null, waterF = 75, nwsMissing = [] }) {
  const ds = Array.from({ length: n }, (_, i) => addDays(s, i))
  const hours = (d) => {
    const from = chicagoMidnight(d).getTime()
    return Array.from({ length: (chicagoMidnight(addDays(d, 1)) - from) / HOUR }, (_, i) => new Date(from + i * HOUR).toISOString())
  }
  return {
    getTides: async () => ({
      days: ds.map((date) => ({ date, tide: hours(date).map((t, i) => ({ t, ft: REAL_TIDE_FT[i % 24] })), hilo: [] })),
      waterTemp: { f: waterF, observedAt: sent, stale: false, source: 'NOAA' }, salinity: null, source: 'NOAA', updatedAt: sent, missing: ['salinity'],
    }),
    getWeather: async () => ({
      days: ds.map((date) => ({
        date, missing: [],
        spots: Object.fromEntries(spots.map((sp) => [sp.id, hours(date).map((t) => ({
          t, tempF: 76, feelsLikeF: 79, windMph: 10, windFromDeg: 140, pressureHpa: 1015, waveFt: 2, ...weather,
        }))])),
      })),
      source: 'Open-Meteo', updatedAt: sent,
    }),
    getAlerts: async () => ({
      days: ds.map((date) => ({
        date, rip, missing: [...(rip ? [] : ['rip_current']), ...nwsMissing],
        spots: Object.fromEntries(spots.map((sp) => [sp.id, alerts(date, sp.type)])),
      })),
      source: 'NWS', updatedAt: sent,
    }),
  }
}
const reason = (signal, verdict, event, text = event) => ({ signal, level: verdict === 'no' ? 'high' : 'moderate', verdict, event, text, source: 'NWS', updatedAt: sent })

test('realistic quiet fall day (live NWS has no rip forecast): caution, windows in daylight, contract ok', async () => {
  const plan = await buildPlan({ start: '2026-10-25', days: 1 }, scenario({ start: '2026-10-25' }))
  checkPlan(plan, { snapshot: false })
  const [day] = plan.days
  assert.equal(day.safety.verdict, 'caution', 'unknown rip risk is never "go"')
  assert.ok(day.safety.reasons.some((r) => r.signal === 'rip_current' && r.level === 'unknown'))
  assert.ok(day.windows.length >= 1, 'a normal day has somewhere to fish')
  const { sunrise, sunset } = sunTimes('2026-10-25')
  for (const w of day.windows) {
    assert.ok(w.start >= chicagoHHMM(new Date(sunrise - HOUR)) && w.start <= chicagoHHMM(sunset), `${w.start} is in daylight`)
    assert.ok(w.end <= chicagoHHMM(new Date(sunset.getTime() + HOUR)), `${w.end} ends by last light`)
  }
  assert.equal(day.tide.length, 24)
})

test('realistic: Beach Hazards Statement (moderate rip) is caution, Rip Current Statement is no', async () => {
  const moderate = scenario({
    start: '2026-10-25', rip: { level: 'moderate' },
    alerts: (_d, type) => (type === 'bay' ? [] : [reason('rip_current', 'caution', 'Beach Hazards Statement')]),
  })
  assert.equal((await buildPlan({ start: '2026-10-25' }, moderate)).days[0].safety.verdict, 'caution')
  const high = scenario({
    start: '2026-10-25', rip: { level: 'high' },
    alerts: (_d, type) => (type === 'surf' ? [reason('rip_current', 'no', 'Rip Current Statement')] : type === 'pier' ? [reason('rip_current', 'caution', 'Rip Current Statement')] : []),
  })
  const plan = await buildPlan({ start: '2026-10-25' }, high)
  checkPlan(plan)
  assert.equal(plan.days[0].safety.verdict, 'no')
  assert.match(plan.days[0].safety.reasons[0].text, /^Beach side: /)
})

test('realistic: a tropical storm warning only on day 2 makes day 2 "no" and leaves day 1 alone', async () => {
  const f = scenario({
    start: '2026-10-25', days: 2, rip: { level: 'moderate' },
    alerts: (d) => (d === '2026-10-26' ? [reason('tropical', 'no', 'Tropical Storm Warning')] : []),
  })
  const plan = await buildPlan({ start: '2026-10-25', days: 2 }, f)
  checkPlan(plan)
  assert.notEqual(plan.days[0].safety.verdict, 'no')
  assert.equal(plan.days[1].safety.verdict, 'no')
})

test('realistic: summer heat (feels like 107) and windy cold front (25 mph) are cautions', async () => {
  for (const weather of [{ feelsLikeF: 107 }, { windMph: 25, windFromDeg: 350 }]) {
    const plan = await buildPlan({ start: '2026-10-25' }, scenario({ start: '2026-10-25', weather, rip: { level: 'low' } }))
    checkPlan(plan)
    assert.equal(plan.days[0].safety.verdict, 'caution', JSON.stringify(weather))
  }
})

test('trip 3+ days out: NWS has nothing yet, so caution with an explanation', async () => {
  const plan = await buildPlan({ start: '2026-10-29' }, scenario({ start: '2026-10-29', nwsMissing: ['nws_alerts'] }))
  checkPlan(plan)
  assert.equal(plan.days[0].safety.verdict, 'caution')
  assert.ok(plan.days[0].safety.reasons.some((r) => r.signal === 'nws_alerts' && r.level === 'unknown'))
})

test('DST start (Mar 14, 2027): 23 tide points, windows in CDT, contract ok', async () => {
  const plan = await buildPlan({ start: '2027-03-14' }, scenario({ start: '2027-03-14', waterF: 64 }))
  checkPlan(plan)
  assert.equal(plan.days[0].tide.length, 23)
})

test('both DST-change days in one 2-day plan pass the contract', async () => {
  const plan = await buildPlan({ start: '2026-10-31', days: 2 }, scenario({ start: '2026-10-31', days: 2 }))
  checkPlan(plan)
  assert.deepEqual(plan.days.map((d) => d.tide.length), [24, 25])
})

test('a service that returns the wrong shape (bug) degrades like a failure, not a 500', async () => {
  const f = scenario({ start: '2026-10-25' })
  const plan = await buildPlan({ start: '2026-10-25' }, { ...f, getWeather: async () => ({}), getTides: async () => undefined, getAlerts: async () => ({ days: null }) })
  checkPlan(plan)
  const [day] = plan.days
  assert.equal(day.safety.verdict, 'caution')
  for (const m of ['weather', 'tide', 'nws_alerts']) assert.ok(day.missing.includes(m), m)
})

test('a service answering for the wrong dates counts as missing for the asked date', async () => {
  const wrong = scenario({ start: '2026-11-15', rip: { level: 'low' } })
  const plan = await buildPlan({ start: '2026-10-25' }, wrong)
  checkPlan(plan)
  assert.deepEqual(plan.days[0].tide, [])
  assert.ok(plan.days[0].missing.includes('weather'))
  assert.equal(plan.days[0].safety.verdict, 'caution')
})

test('the same inputs give the same plan (draw and windows are deterministic)', async () => {
  const f = scenario({ start: '2026-10-25' })
  const a = await buildPlan({ start: '2026-10-25' }, f)
  const b = await buildPlan({ start: '2026-10-25' }, f)
  assert.deepEqual({ ...a, generatedAt: 0 }, { ...b, generatedAt: 0 })
})

test('HTTP: impossible dates and bad days are 400s with a JSON error', async () => {
  const app = express().use('/api/plan', planRouter)
  const server = app.listen(0)
  const base = `http://localhost:${server.address().port}/api/plan`
  try {
    const bad = [
      'start=2026-02-30', // Date.parse rolls this over to March 2
      'start=2026-04-31',
      'start=2026-13-01',
      'start=0050-01-01', // Date.UTC maps years 0-99 to 1900s
      'start=20261024',
      'start=2026-10-24T00:00',
      'start=2026-10-24&start=2026-10-25',
      'start=',
      'start=2026-10-24&days=0',
      'start=2026-10-24&days=3',
      'start=2026-10-24&days=1.5',
      'start=2026-10-24&days=abc',
      'start=2026-10-24&days=',
      'start=2026-10-24&days=-1',
    ]
    for (const q of bad) {
      const res = await fetch(`${base}?${q}`)
      assert.equal(res.status, 400, q)
      assert.ok((await res.json()).error, `${q}: has an error message`)
    }
    const demo = await fetch(`${base}?snapshot=demo&start=whatever&days=9`)
    assert.equal(demo.status, 200, 'snapshot ignores the other params')
    assert.equal((await demo.json()).snapshot, true)
  } finally {
    server.close()
  }
})
