// tides.js, weather.js and nws.js against a fake network (no real API calls), checking request
// parameters, Chicago-day bucketing across DST, and that every failure lands in `missing`.
import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Throwaway cache dir: the real backend/cache/ may hold live responses that would mask the fakes.
const CACHE = mkdtempSync(join(tmpdir(), 'gofish-svc-'))
process.env.GOFISH_CACHE_DIR = CACHE
const { getTides } = await import('../services/tides.js')
const { getWeather } = await import('../services/weather.js')
const { getAlerts, mapAlert } = await import('../services/nws.js')
const { spots } = await import('../services/data.js')
const { addDays, chicagoDate } = await import('../services/time.js')

const HOUR = 60 * 60 * 1000
const realFetch = globalThis.fetch
const gmt = (d) => d.toISOString().slice(0, 16).replace('T', ' ')
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Open-Meteo answers with 16 days of hours starting at Chicago midnight Oct 24, 2026 (CDT).
const OM_START = Date.parse('2026-10-24T05:00:00Z') / 1000
const OM_HOURS = 16 * 24 + 1 // +1: Nov 1 is 25 hours long

let api // per-test fake behavior
let calls
const clearCache = () => { for (const f of readdirSync(CACHE)) rmSync(join(CACHE, f)) }
beforeEach(() => {
  clearCache()
  calls = []
  api = {
    noaa: 'ok', waterAgeMs: HOUR, waterV: '74.5',
    forecast: 'ok', marine: 'ok', failLat: null,
    nws: 'ok', pointAlerts: [], zoneAlerts: [],
  }
  globalThis.fetch = fakeFetch
})
after(() => { globalThis.fetch = realFetch })

async function fakeFetch(url, opts = {}) {
  const u = new URL(url)
  const q = Object.fromEntries(u.searchParams)
  calls.push({ url: u, q, headers: opts.headers ?? {} })
  if (u.hostname === 'api.tidesandcurrents.noaa.gov') {
    if (api.noaa === 'down') throw new TypeError('fetch failed')
    if (q.product === 'predictions') {
      if (api.noaa === 'error') return json({ error: { message: 'No Predictions data was found.' } })
      // begin/end are "yyyyMMdd HH:mm" (GMT)
      const parse = (s) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9)}:00Z`)
      const from = parse(q.begin_date)
      const to = parse(q.end_date)
      const step = q.interval === 'h' ? HOUR : 6 * HOUR + 12 * 60 * 1000
      const out = []
      for (let t = from, i = 0; t <= to; t += step, i++) {
        out.push({ t: gmt(new Date(t)), v: (1 + 0.8 * Math.sin(t / HOUR / 2)).toFixed(3), ...(q.interval === 'hilo' && { type: i % 2 ? 'L' : 'H' }) })
      }
      return json({ predictions: out })
    }
    if (q.product === 'water_temperature') {
      return json({ metadata: { id: '8771450' }, data: [{ t: gmt(new Date(Date.now() - api.waterAgeMs)), v: api.waterV, f: '0,0,0' }] })
    }
    // Pier 21 has no salinity sensor.
    return json({ error: { message: 'No data was found. This product may not be offered at this station at the requested time.' } })
  }
  if (u.hostname === 'api.open-meteo.com' || u.hostname === 'marine-api.open-meteo.com') {
    const marine = u.hostname.startsWith('marine')
    const mode = marine ? api.marine : api.forecast
    if (mode === 'down' || Number(q.latitude) === api.failLat) return new Response('upstream error', { status: 502 })
    if (mode === 'error') return json({ error: true, reason: 'Parameter forecast_days must be between 0 and 16' })
    const time = Array.from({ length: OM_HOURS }, (_, i) => OM_START + i * 3600)
    const hourly = marine
      ? { time, wave_height: time.map((_, i) => (i < 10 * 24 ? 2.3 : null)) } // marine data ends ~day 10
      : {
          time,
          temperature_2m: time.map(() => 76), apparent_temperature: time.map(() => 79),
          wind_speed_10m: time.map(() => 11), wind_direction_10m: time.map(() => 150), pressure_msl: time.map(() => 1015.2),
        }
    return json({ utc_offset_seconds: -18000, timezone: 'America/Chicago', hourly })
  }
  if (u.hostname === 'api.weather.gov') {
    if (api.nws === 'down') return new Response('{"status":503}', { status: 503 })
    const list = q.point ? api.pointAlerts : api.zoneAlerts
    return json({ type: 'FeatureCollection', features: list.map((properties) => ({ properties })) })
  }
  throw new Error(`unexpected fetch ${url}`)
}

// --- tides.js -----------------------------------------------------------------------------

test('tides: request uses station 8771450, MLLW, feet, GMT and Chicago-midnight bounds', async () => {
  await getTides({ start: '2026-10-31', days: 2 })
  const pred = calls.filter((c) => c.q.product === 'predictions')
  assert.equal(pred.length, 2, 'hourly + hilo')
  for (const { q } of pred) {
    assert.equal(q.station, '8771450')
    assert.equal(q.datum, 'MLLW')
    assert.equal(q.units, 'english')
    assert.equal(q.time_zone, 'gmt')
    assert.equal(q.begin_date, '20261031 05:00', 'Oct 31 00:00 CDT')
    assert.equal(q.end_date, '20261102 06:00', 'Nov 2 00:00 CST (after DST ends)')
  }
})

test('tides: split on Chicago days, Nov 1 has 25 hourly points, all UTC', async () => {
  const r = await getTides({ start: '2026-10-31', days: 2 })
  assert.deepEqual(r.days.map((d) => d.date), ['2026-10-31', '2026-11-01'])
  assert.equal(r.days[0].tide.length, 24)
  assert.equal(r.days[1].tide.length, 25)
  assert.equal(r.days[0].tide[0].t, '2026-10-31T05:00:00Z')
  assert.equal(r.days[1].tide[0].t, '2026-11-01T05:00:00Z')
  assert.equal(r.days[1].tide.at(-1).t, '2026-11-02T05:00:00Z')
  assert.deepEqual(Object.keys(r.days[0].tide[0]), ['t', 'ft'])
  assert.ok(r.days.every((d) => d.hilo.every((h) => ['high', 'low'].includes(h.type))))
  assert.ok(r.days.every((d) => d.hilo.length >= 3), 'Galveston has 2-4 hi/lo per day')
})

test('tides: fresh water temp is used; salinity is never offered at Pier 21', async () => {
  const r = await getTides({ start: '2026-10-24' })
  assert.equal(r.waterTemp.f, 74.5)
  assert.equal(r.waterTemp.stale, false)
  assert.equal(r.salinity, null)
  assert.deepEqual(r.missing, ['salinity'])
})

test('tides: a water temp reading older than 6 hours is stale -> missing', async () => {
  api.waterAgeMs = 7 * HOUR
  const r = await getTides({ start: '2026-10-24' })
  assert.equal(r.waterTemp.stale, true)
  assert.ok(r.missing.includes('water_temperature'))
})

test('tides: a blank water temp value (sensor down) is missing, not 0°F', async () => {
  api.waterV = ''
  const r = await getTides({ start: '2026-10-24' })
  assert.equal(r.waterTemp, null)
  assert.ok(r.missing.includes('water_temperature'))
})

test('tides: NOAA {"error"} or no network never throws, empties the tide, reports it', async () => {
  api.noaa = 'error'
  const r = await getTides({ start: '2026-10-24', days: 2 })
  assert.deepEqual(r.days.map((d) => d.tide.length), [0, 0])
  assert.ok(r.missing.includes('tide') && r.missing.includes('tide_hilo'))
  clearCache()
  api.noaa = 'down'
  const down = await getTides({ start: '2026-11-20' })
  for (const m of ['tide', 'tide_hilo', 'water_temperature', 'salinity']) assert.ok(down.missing.includes(m), m)
})

// --- weather.js ---------------------------------------------------------------------------

test('weather: Open-Meteo request asks for °F, mph, feet, Chicago time zone, unix times', async () => {
  await getWeather({ start: '2026-10-24' })
  const fc = calls.find((c) => c.url.hostname === 'api.open-meteo.com').q
  assert.equal(fc.timezone, 'America/Chicago')
  assert.equal(fc.timeformat, 'unixtime')
  assert.equal(fc.temperature_unit, 'fahrenheit')
  assert.equal(fc.wind_speed_unit, 'mph')
  for (const v of ['temperature_2m', 'apparent_temperature', 'wind_speed_10m', 'wind_direction_10m', 'pressure_msl']) {
    assert.ok(fc.hourly.split(',').includes(v), v)
  }
  const mar = calls.find((c) => c.url.hostname === 'marine-api.open-meteo.com').q
  assert.equal(mar.length_unit, 'imperial')
  assert.ok(Number(fc.forecast_days) <= 16 && Number(mar.forecast_days) <= 16)
  assert.ok(calls.every((c) => !c.url.href.includes('NaN') && !c.url.href.includes('null')), 'no blank coordinates sent')
})

test('weather: hours bucket into Chicago days across the DST change (24 then 25 hours)', async () => {
  const r = await getWeather({ start: '2026-10-31', days: 2 })
  for (const s of spots) {
    assert.equal(r.days[0].spots[s.id].length, 24, `${s.id} Oct 31`)
    assert.equal(r.days[1].spots[s.id].length, 25, `${s.id} Nov 1`)
  }
  const h = r.days[1].spots['gisp-beach'][0]
  assert.equal(h.t, '2026-11-01T05:00:00.000Z')
  assert.deepEqual(Object.keys(h).sort(), ['feelsLikeF', 'pressureHpa', 't', 'tempF', 'waveFt', 'windFromDeg', 'windMph'])
  assert.equal(h.waveFt, 2.3)
  assert.deepEqual(r.days.map((d) => d.missing), [[], []])
})

test('weather: marine API down -> "waves" missing, wind and heat still there', async () => {
  api.marine = 'down'
  const r = await getWeather({ start: '2026-10-24' })
  assert.deepEqual(r.days[0].missing, ['waves'])
  assert.ok(r.days[0].spots['gisp-beach'].length > 0)
  assert.ok(r.days[0].spots['gisp-beach'].every((h) => h.waveFt === null))
})

test('weather: Open-Meteo {"error": true} on a 200 -> "weather" missing, never throws', async () => {
  api.forecast = 'error'
  const r = await getWeather({ start: '2026-10-24' })
  assert.ok(r.days[0].missing.includes('weather'))
  assert.ok(Object.values(r.days[0].spots).every((h) => h.length === 0))
})

test('weather: one spot failing is reported per spot ("weather:<id>")', async () => {
  const custom = [
    { id: 'gisp-beach', type: 'surf', lat: 29.19, lon: -94.95 },
    { id: 'gisp-bay', type: 'bay', lat: 29.2, lon: -94.96 },
  ]
  api.failLat = 29.2
  const r = await getWeather({ start: '2026-10-24', spots: custom })
  assert.deepEqual(r.days[0].missing.sort(), ['waves:gisp-bay', 'weather:gisp-bay'])
  assert.equal(r.spots['gisp-beach'].fallback, false)
})

test('weather: dates past the 16-day forecast -> weather and waves missing; marine runs out first', async () => {
  const far = await getWeather({ start: '2026-12-01' })
  assert.deepEqual(far.days[0].missing.sort(), ['waves', 'weather'])
  const day12 = await getWeather({ start: '2026-11-05' })
  assert.deepEqual(day12.days[0].missing, ['waves'], 'wind/heat exist, waves do not')
})

test('weather: "NEEDS CHECK" coordinates fall back to Pier 21 instead of sending NaN', async () => {
  const r = await getWeather({ start: '2026-10-24', spots: [{ id: 'gisp-beach', type: 'surf', lat: 'NEEDS CHECK', lon: 'NEEDS CHECK' }] })
  assert.equal(r.spots['gisp-beach'].fallback, true)
  assert.ok(calls.every((c) => c.q.latitude === '29.31'))
})

test('weather: updatedAt is when the data was fetched, not when it was served from cache', async () => {
  await getWeather({ start: '2026-10-24' })
  const old = new Date(Date.now() - 2 * HOUR)
  for (const f of readdirSync(CACHE)) utimesSync(join(CACHE, f), old, old)
  api.forecast = 'down'
  api.marine = 'down'
  const r = await getWeather({ start: '2026-10-24' })
  assert.ok(r.days[0].spots['gisp-beach'].length > 0, 'stale cache (under 6h) is still served')
  assert.ok(Date.now() - Date.parse(r.updatedAt) > 1.5 * HOUR, `updatedAt ${r.updatedAt} shows the real age`)
})

// --- nws.js -------------------------------------------------------------------------------

const today = chicagoDate(new Date())
const iso = (ms) => new Date(ms).toISOString()
let alertId = 0
function nwsAlert(event, { zones = ['TXZ438'], onset = Date.now() - HOUR, ends = Date.now() + 12 * HOUR, ...rest } = {}) {
  return {
    id: `urn:oid:test.${++alertId}`, event, status: 'Actual', messageType: 'Alert', severity: 'Moderate',
    headline: `${event} issued by NWS Houston/Galveston TX`, senderName: 'NWS Houston/Galveston TX',
    sent: iso(Date.now() - 2 * HOUR), effective: iso(Date.now() - 2 * HOUR), onset: iso(onset), ends: ends && iso(ends), expires: iso(Date.now() + 6 * HOUR),
    affectedZones: zones.map((z) => `https://api.weather.gov/zones/forecast/${z}`),
    parameters: { NWSheadline: [`${event.toUpperCase()} IN EFFECT`] },
    ...rest,
  }
}
const spotSignals = (day, id) => day.spots[id].map((r) => `${r.signal}:${r.verdict}`)

test('nws: every request sends a User-Agent and asks for actual alerts only', async () => {
  await getAlerts({ start: today })
  const nws = calls.filter((c) => c.url.hostname === 'api.weather.gov')
  assert.ok(nws.length >= 2, 'point + marine zones')
  for (const c of nws) {
    assert.match(c.headers['User-Agent'], /GoFish/)
    assert.equal(c.q.status, 'actual')
  }
  const zone = nws.find((c) => c.q.zone).q.zone.split(',')
  assert.deepEqual(zone.sort(), ['GMZ335', 'GMZ355'])
})

test('nws: a quiet day has no reasons, and no rip statement is not missing (HGX has no SRF)', async () => {
  const r = await getAlerts({ start: today })
  assert.ok(Object.values(r.days[0].spots).every((x) => x.length === 0))
  assert.equal(r.days[0].rip, null)
  assert.deepEqual(r.days[0].missing, [])
})

test('nws: Rip Current Statement = "no" on the beach, caution on the pier, ignored in the bay', async () => {
  api.pointAlerts = [nwsAlert('Rip Current Statement')]
  const [day] = (await getAlerts({ start: today })).days
  assert.deepEqual(spotSignals(day, 'gisp-beach'), ['rip_current:no'])
  assert.deepEqual(spotSignals(day, 'galveston-pier'), ['rip_current:caution'])
  assert.deepEqual(spotSignals(day, 'gisp-bay'), [])
  assert.equal(day.rip.level, 'high')
  assert.ok(!day.missing.includes('rip_current'))
})

test('nws: Beach Hazards Statement = moderate rip risk on Gulf-facing spots, not the bay', async () => {
  api.pointAlerts = [nwsAlert('Beach Hazards Statement')]
  const [day] = (await getAlerts({ start: today })).days
  assert.equal(day.rip.level, 'moderate')
  assert.deepEqual(spotSignals(day, 'gisp-beach'), ['rip_current:caution'])
  assert.deepEqual(spotSignals(day, 'galveston-pier'), ['rip_current:caution'])
  assert.deepEqual(spotSignals(day, 'gisp-bay'), [], 'no rip currents on the bay side')
})

test('nws: marine alerts reach only the spots in that zone', async () => {
  api.zoneAlerts = [nwsAlert('Small Craft Advisory', { zones: ['GMZ355'] })]
  let [day] = (await getAlerts({ start: today })).days
  assert.deepEqual(spotSignals(day, 'gisp-beach'), ['small_craft_advisory:caution'])
  assert.deepEqual(spotSignals(day, 'galveston-pier'), ['small_craft_advisory:caution'])
  assert.deepEqual(spotSignals(day, 'gisp-bay'), [])
  clearCache()
  api.zoneAlerts = [nwsAlert('Small Craft Advisory', { zones: ['GMZ335'] })]
  ;[day] = (await getAlerts({ start: today })).days
  assert.deepEqual(spotSignals(day, 'gisp-bay'), ['small_craft_advisory:caution'])
  assert.deepEqual(spotSignals(day, 'gisp-beach'), [])
})

test('nws: an alert starting tomorrow applies to tomorrow only', async () => {
  const tomorrowNoon = Date.parse(`${addDays(today, 1)}T17:00:00Z`)
  api.pointAlerts = [nwsAlert('Coastal Flood Warning', { onset: tomorrowNoon, ends: tomorrowNoon + 6 * HOUR })]
  const r = await getAlerts({ start: today, days: 2 })
  assert.deepEqual(spotSignals(r.days[0], 'gisp-bay'), [])
  assert.deepEqual(spotSignals(r.days[1], 'gisp-bay'), ['coastal_flood:no'])
})

test('nws: an alert with no "ends" uses "expires"; one with neither runs on', async () => {
  const soon = Date.now() + 2 * HOUR
  api.pointAlerts = [nwsAlert('Dense Fog Advisory', { ends: null, expires: iso(soon) })]
  const r = await getAlerts({ start: today, days: 2 })
  assert.deepEqual(spotSignals(r.days[0], 'gisp-bay'), ['fog:caution'])
  // expires in 2h: unless today ends within 2h, tomorrow is clear
  if (Date.parse(`${addDays(today, 1)}T06:00:00Z`) > soon) assert.deepEqual(spotSignals(r.days[1], 'gisp-bay'), [])
})

test('nws: days more than 48h ahead get "nws_alerts" in missing (no alerts issued yet)', async () => {
  const r = await getAlerts({ start: addDays(today, 3), days: 2 })
  for (const d of r.days) {
    assert.ok(d.missing.includes('nws_alerts'), d.date)
    assert.ok(d.missing.includes('rip_current'), `${d.date}: no statement yet says nothing about rip risk`)
  }
})

test('nws: API down with no cache -> "nws_alerts" missing, never throws', async () => {
  api.nws = 'down'
  const r = await getAlerts({ start: today })
  assert.ok(r.days[0].missing.includes('nws_alerts'))
  assert.ok(r.days[0].missing.includes('rip_current'))
})

test('nws: a stale cached alert list (over 1h old) counts as missing', async () => {
  await getAlerts({ start: today })
  const old = new Date(Date.now() - 2 * HOUR)
  for (const f of readdirSync(CACHE)) utimesSync(join(CACHE, f), old, old)
  api.nws = 'down'
  const r = await getAlerts({ start: today })
  assert.ok(r.days[0].missing.includes('nws_alerts'))
  assert.ok(Date.now() - Date.parse(r.updatedAt) > 1.5 * HOUR, 'updatedAt shows the data age')
})

test('nws: test/exercise messages are ignored', async () => {
  api.pointAlerts = [nwsAlert('Tornado Warning', { status: 'Test' })]
  const [day] = (await getAlerts({ start: today })).days
  assert.deepEqual(spotSignals(day, 'gisp-beach'), [])
})

test('nws: an alert without affectedZones does not crash the service', async () => {
  const a = nwsAlert('Special Weather Statement')
  delete a.affectedZones
  api.pointAlerts = [a]
  api.zoneAlerts = [{ ...nwsAlert('Small Craft Advisory'), affectedZones: undefined }]
  const [day] = (await getAlerts({ start: today })).days
  assert.deepEqual(spotSignals(day, 'gisp-beach'), ['nws_alerts:caution'])
})

test('nws: unknown events are never ignored (warning -> no, anything else -> caution)', () => {
  assert.equal(mapAlert({ event: 'Brand New Warning', status: 'Actual' }, 'surf').verdict, 'no')
  assert.equal(mapAlert({ event: 'Air Quality Alert', status: 'Actual' }, 'bay').verdict, 'caution')
  assert.equal(mapAlert({ event: 'Hurricane Warning', status: 'Actual' }, 'bay').verdict, 'no')
  assert.equal(mapAlert({ event: 'Heat Advisory', status: 'Actual' }, 'pier').signal, 'heat')
})
