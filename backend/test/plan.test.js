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
