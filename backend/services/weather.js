// Open-Meteo hourly forecast (temp, feels-like, wind, pressure) + Open-Meteo marine (waves).
// Requests use timezone=America/Chicago, but Open-Meteo applies ONE fixed offset to the whole
// response (CDT -5h even after DST ends Nov 1), so we ask for unixtime and bucket hours into
// Chicago days ourselves with services/time.js.
import { statSync } from 'node:fs'
import { cachedJson, cacheFile } from './cache.js'
import { spots as allSpots } from './data.js'
import { TZ, addDays, chicagoMidnight } from './time.js'

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const MARINE = 'https://marine-api.open-meteo.com/v1/marine'
export const SOURCE = 'Open-Meteo forecast + marine (open-meteo.com)'
const TTL_MS = 60 * 60 * 1000 // Open-Meteo models update roughly hourly
const MAX_DAYS = 16 // longest range both APIs accept; marine fills the tail with nulls

// Used when a spot's lat/lon isn't filled in yet: NOAA Galveston Pier 21 (8771450).
export const FALLBACK = { lat: 29.31, lon: -94.7933 }

// Open-Meteo returns HTTP 200 with {"error": true, "reason"} for some bad requests.
function openMeteoOk(data) {
  if (data?.error) throw new Error(`Open-Meteo: ${data.reason}`)
}

function url(base, lat, lon, params) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: TZ, timeformat: 'unixtime',
    forecast_days: MAX_DAYS, ...params,
  })
  return `${base}?${q}`
}

// When the cached copy of `u` was fetched (it may be stale cache served after a failed fetch).
const fetchedAt = (u) => statSync(cacheFile(u)).mtime

// Same URL for every date, so one cached response per spot serves all trip dates.
async function forecast(lat, lon) {
  const u = url(FORECAST, lat, lon, {
    hourly: 'temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,pressure_msl',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph',
  })
  const data = await cachedJson(u, { ttlMs: TTL_MS, validate: openMeteoOk })
  const h = data.hourly
  const hours = h.time.map((s, i) => ({
    t: new Date(s * 1000).toISOString(),
    tempF: h.temperature_2m[i],
    feelsLikeF: h.apparent_temperature[i],
    windMph: h.wind_speed_10m[i],
    windFromDeg: h.wind_direction_10m[i], // meteorological: direction the wind blows FROM
    pressureHpa: h.pressure_msl[i],
  }))
  return { hours, fetchedAt: fetchedAt(u) }
}

async function marine(lat, lon) {
  const u = url(MARINE, lat, lon, { hourly: 'wave_height', length_unit: 'imperial' })
  const data = await cachedJson(u, { ttlMs: TTL_MS, validate: openMeteoOk })
  const waves = new Map(data.hourly.time.map((s, i) => [new Date(s * 1000).toISOString(), data.hourly.wave_height[i]]))
  return { waves, fetchedAt: fetchedAt(u) }
}

function coords(spot) {
  if (Number.isFinite(spot.lat) && Number.isFinite(spot.lon)) return { lat: spot.lat, lon: spot.lon, fallback: false }
  console.warn(`[weather] ${spot.id} has no lat/lon in spots.json; using Galveston fallback ${FALLBACK.lat},${FALLBACK.lon}`)
  return { ...FALLBACK, fallback: true }
}

// Returns:
// { days: [{ date, spots: { <spotId>: [{ t (UTC ISO), tempF, feelsLikeF, windMph, windFromDeg,
//            pressureHpa, waveFt }] }, missing: [string] }],
//   spots: { <spotId>: { lat, lon, fallback } }, source, updatedAt }
// updatedAt is when the oldest data used was fetched (stale cache counts as its real age).
// A day's `missing` holds "weather"/"waves" when no spot has that data for the date (e.g.
// beyond the forecast range), or "weather:<spotId>"/"waves:<spotId>" when only some spots lack it.
// Never throws.
export async function getWeather({ start, days = 1, spots = allSpots }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i))
  const perSpot = await Promise.all(spots.map(async (spot) => {
    const c = coords(spot)
    const [fc, wv] = await Promise.allSettled([forecast(c.lat, c.lon), marine(c.lat, c.lon)])
    if (fc.status === 'rejected') console.warn(`[weather] forecast failed for ${spot.id}: ${fc.reason.message}`)
    if (wv.status === 'rejected') console.warn(`[weather] marine failed for ${spot.id}: ${wv.reason.message}`)
    return {
      id: spot.id, coords: c,
      hours: fc.status === 'fulfilled' ? fc.value.hours : [],
      waves: wv.status === 'fulfilled' ? wv.value.waves : new Map(),
      fetchedAt: [fc, wv].filter((r) => r.status === 'fulfilled').map((r) => r.value.fetchedAt),
    }
  }))
  // Oldest data actually used (stale cache can be up to 6h old); now if nothing was fetched.
  const oldest = perSpot.flatMap((s) => s.fetchedAt).reduce((a, b) => (b < a ? b : a), new Date())

  const result = {
    days: dates.map((date) => {
      const from = chicagoMidnight(date)
      const to = chicagoMidnight(addDays(date, 1)) // 25 hours on Nov 1, 2026
      const lacking = { weather: [], waves: [] }
      const bySpot = {}
      for (const s of perSpot) {
        const hours = s.hours
          .filter((h) => { const t = new Date(h.t); return t >= from && t < to && h.tempF != null })
          .map((h) => ({ ...h, waveFt: s.waves.get(h.t) ?? null }))
        if (!hours.length) lacking.weather.push(s.id)
        if (!hours.some((h) => h.waveFt != null)) lacking.waves.push(s.id)
        bySpot[s.id] = hours
      }
      const missing = Object.entries(lacking).flatMap(([signal, ids]) =>
        ids.length === perSpot.length ? [signal] : ids.map((id) => `${signal}:${id}`))
      return { date, spots: bySpot, missing }
    }),
    spots: Object.fromEntries(perSpot.map((s) => [s.id, s.coords])),
    source: SOURCE,
    updatedAt: oldest.toISOString(),
  }
  return result
}
