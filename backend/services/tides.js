// NOAA CO-OPS datagetter. Station 8771450 (Galveston Pier 21).
// Products: predictions (hourly + hilo), water_temperature, salinity (optional -> "missing").
// All requests use time_zone=gmt so timestamps are UTC; days are split on Chicago midnight.
import { cachedJson } from './cache.js'
import { addDays, chicagoMidnight } from './time.js'

const BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
export const STATION = '8771450'
const SOURCE = 'NOAA CO-OPS 8771450 (Galveston Pier 21)'
const HOUR = 60 * 60 * 1000
const STALE_MS = 6 * HOUR // water temp older than this counts as missing

// NOAA returns HTTP 200 with {"error": {...}} when it has no data.
function noaaOk(data) {
  if (data?.error) throw new Error(`NOAA: ${data.error.message}`)
}

// "yyyyMMdd HH:mm" in UTC, the format datagetter expects with time_zone=gmt.
const noaaDate = (d) => d.toISOString().slice(0, 16).replace(/-/g, '').replace('T', ' ')

// NOAA "2026-10-24 07:57" (gmt) -> "2026-10-24T07:57:00Z"
const isoFromNoaa = (t) => `${t.replace(' ', 'T')}:00Z`

function url(params) {
  const q = new URLSearchParams({
    station: STATION, datum: 'MLLW', units: 'english', time_zone: 'gmt',
    format: 'json', application: 'go-fish', ...params,
  })
  return `${BASE}?${q}`
}

// Predictions never change, so cache them for a day.
async function predictions(interval, begin, end) {
  const data = await cachedJson(
    url({ product: 'predictions', interval, begin_date: noaaDate(begin), end_date: noaaDate(end) }),
    { ttlMs: 24 * HOUR, validate: noaaOk },
  )
  return data.predictions.map((p) => ({
    t: isoFromNoaa(p.t),
    ft: Number(p.v),
    ...(p.type && { type: p.type === 'H' ? 'high' : 'low' }),
  }))
}

// Latest observation of a sensor product, or null if NOAA has none.
// optional: cache NOAA's "not offered at this station" reply instead of re-asking every call.
async function latest(product, ttlMs, { optional = false } = {}) {
  const data = await cachedJson(url({ product, date: 'latest' }), { ttlMs, validate: optional ? undefined : noaaOk })
  const obs = data.data?.[0]
  if (!obs || obs.v === '') return null
  return { value: Number(obs.v), t: isoFromNoaa(obs.t) }
}

// Returns:
// { days: [{ date, tide: [{t, ft}], hilo: [{t, ft, type: "high"|"low"}] }],
//   waterTemp: { f, observedAt, stale, source } | null,
//   salinity: { psu, observedAt, source } | null,
//   source, updatedAt, missing: [string] }
// Water temp and salinity are the latest observation (NOAA has no forecast for them).
// Never throws: anything that fails is reported in `missing`.
export async function getTides({ start, days = 1 }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i))
  const begin = chicagoMidnight(start)
  const end = chicagoMidnight(addDays(start, days)) // exclusive
  const missing = []

  const [hourly, hilo, temp, sal] = await Promise.allSettled([
    predictions('h', begin, end),
    predictions('hilo', begin, end),
    latest('water_temperature', 30 * 60 * 1000),
    latest('salinity', 24 * HOUR, { optional: true }),
  ])

  // Bucket each point into its Chicago day: [midnight, next midnight).
  const bounds = dates.map((d, i) => [d, chicagoMidnight(d), chicagoMidnight(addDays(start, i + 1))])
  const inDay = (points, from, to) =>
    points.filter((p) => { const t = new Date(p.t); return t >= from && t < to })

  if (hourly.status === 'rejected') missing.push('tide')
  if (hilo.status === 'rejected') missing.push('tide_hilo')

  const result = {
    days: bounds.map(([date, from, to]) => ({
      date,
      tide: hourly.status === 'fulfilled' ? inDay(hourly.value, from, to).map(({ t, ft }) => ({ t, ft })) : [],
      hilo: hilo.status === 'fulfilled' ? inDay(hilo.value, from, to) : [],
    })),
    waterTemp: null,
    salinity: null,
    source: SOURCE,
    updatedAt: new Date().toISOString(),
    missing,
  }

  if (temp.status === 'fulfilled' && temp.value) {
    const stale = Date.now() - new Date(temp.value.t).getTime() > STALE_MS
    result.waterTemp = { f: temp.value.value, observedAt: temp.value.t, stale, source: SOURCE }
    if (stale) missing.push('water_temperature')
  } else {
    missing.push('water_temperature')
  }

  if (sal.status === 'fulfilled' && sal.value) {
    result.salinity = { psu: sal.value.value, observedAt: sal.value.t, source: SOURCE }
  } else {
    missing.push('salinity')
  }

  return result
}
