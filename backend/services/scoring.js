// Pure scoring functions. See AGENTS.md "SCORING".
// Each hour gets a `why` list; score = SCORE_BASE + sum(why[].effect), clamped 0-100.
// Every input yields a factor in [-1, 1]; effect = round(factor * weight), where the weights
// split 50 points 35/25/15/15/10 (tide/water temp/wind/light/pressure).
// Windows = consecutive hours >= WINDOW_MIN; the plan keeps the best ones that don't overlap.
import { species as allSpecies } from './data.js'
import { chicagoDate, chicagoHHMM } from './time.js'

export const SCORE_BASE = 50
export const WINDOW_MIN = 60
export const WEIGHTS = { tide: 17.5, waterTemp: 12.5, wind: 7.5, light: 7.5, pressure: 5 }

const HOUR_MS = 60 * 60 * 1000
// Used when a spot's lat/lon isn't filled in yet: NOAA Galveston Pier 21 (8771450).
const GALVESTON = { lat: 29.31, lon: -94.7933 }
// Galveston's Gulf beaches face roughly southeast; wind from within 67.5° of this is onshore.
export const SHORE_FACING_DEG = 145
// Used only while species.json temperature ranges are still "NEEDS CHECK".
const GENERIC_TEMP_F = [60, 82]

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
// Maps x linearly so that `lo` -> -1 and `hi` -> +1 (clamped).
const ramp = (x, lo, hi) => clamp(((x - lo) / (hi - lo)) * 2 - 1, -1, 1)
const effectOf = (input, factor) => Math.round(factor * WEIGHTS[input]) || 0
// species.json may hold nulls or "NEEDS CHECK" (AGENTS.md): treat those as unknown, as species.js does.
// [min, max] if both are numbers in order, else null.
const tempRange = (s) => {
  const r = s.waterTempF
  return Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1] ? r : null
}
// Unknown spot types count as every spot.
const livesAt = (s, spotType) => !Array.isArray(s.spotTypes) || !s.spotTypes.length || s.spotTypes.includes(spotType)

// --- Inputs -----------------------------------------------------------------------------

// Tide movement in ft/hour at instant t (central difference over the hourly series).
export function tideRate(tide, t) {
  const ms = new Date(t).getTime()
  const pts = tide.map((p) => ({ ms: new Date(p.t).getTime(), ft: p.ft }))
    .filter((p) => Number.isFinite(p.ft)).sort((a, b) => a.ms - b.ms)
  if (pts.length < 2) return null
  // The point at/just before t and the one after it; at an exact sample use its two neighbors.
  let i = pts.findIndex((p) => p.ms > ms)
  if (i === -1) i = pts.length - 1
  if (i === 0) i = 1
  const a = pts[i - 1].ms === ms && i >= 2 ? pts[i - 2] : pts[i - 1]
  const b = pts[i]
  return (b.ft - a.ft) / ((b.ms - a.ms) / HOUR_MS)
}

// Galveston tides are small (often < 2 ft a day), so the thresholds are small too:
// <= 0.02 ft/h is slack (-1), >= 0.10 ft/h is strong movement (+1).
export function tideWhy(rate) {
  if (rate == null) return { input: 'tide', value: 'No tide prediction', effect: 0, label: 'data' }
  const speed = Math.abs(rate)
  const dir = rate > 0 ? 'Incoming' : 'Falling'
  const value = speed <= 0.02 ? 'Slack tide (water barely moving)'
    : speed >= 0.1 ? `${dir} tide, strong movement`
    : `${dir} tide, moderate movement`
  return { input: 'tide', value, effect: effectOf('tide', ramp(speed, 0.02, 0.1)), label: 'data' }
}

// Positive when the water temp suits species that live at this spot type.
export function waterTempWhy(waterTempF, spotType, species = allSpecies) {
  if (!Number.isFinite(waterTempF)) {
    return { input: 'waterTemp', value: 'No water temperature reading', effect: 0, label: 'data' }
  }
  const temp = `${Math.round(waterTempF)}°F`
  const ranged = species.filter((s) => livesAt(s, spotType) && tempRange(s))
  if (!ranged.length) {
    const [lo, hi] = GENERIC_TEMP_F
    const ok = waterTempF >= lo && waterTempF <= hi
    return {
      input: 'waterTemp',
      value: ok ? `${temp}, comfortable for most Gulf fish` : `${temp}, outside the usual ${lo}–${hi}°F`,
      effect: effectOf('waterTemp', ok ? 0.5 : -1), label: 'rule of thumb',
    }
  }
  const fits = ranged.filter((s) => waterTempF >= tempRange(s)[0] && waterTempF <= tempRange(s)[1])
  const names = fits.slice(0, 2).map((s) => s.name.toLowerCase())
  return {
    input: 'waterTemp',
    value: fits.length ? `${temp}, in range for ${names.join(' and ')}` : `${temp}, outside every species' range`,
    effect: effectOf('waterTemp', fits.length ? Math.min(1, fits.length / 3) : -1), label: 'data',
  }
}

export function isOnshore(windFromDeg, facingDeg = SHORE_FACING_DEG) {
  if (!Number.isFinite(windFromDeg)) return false
  const diff = Math.abs((((windFromDeg - facingDeg) % 360) + 540) % 360 - 180)
  return diff < 67.5
}

// Light wind helps. On "high" exposure spots strong onshore wind is a penalty (muddy surf,
// hard to cast); "low" exposure spots are sheltered and never penalized here (wind safety is
// handled by safety.js).
export function windWhy({ windMph, windFromDeg } = {}, windExposure) {
  if (!Number.isFinite(windMph)) return { input: 'wind', value: 'No wind forecast', effect: 0, label: 'data' }
  const mph = `${Math.round(windMph)} mph`
  const calm = -ramp(windMph, 8, 32) // 8 mph -> +1, 20 -> 0, 32 -> -1
  if (windExposure === 'low') {
    return { input: 'wind', value: `${mph}, sheltered spot`, effect: effectOf('wind', Math.max(0, calm)), label: 'data' }
  }
  if (isOnshore(windFromDeg)) {
    const factor = Math.min(calm, -ramp(windMph, 8, 20)) // 14 mph onshore -> 0, 20 -> -1
    return { input: 'wind', value: `${mph} onshore, exposed spot`, effect: effectOf('wind', factor), label: 'data' }
  }
  return { input: 'wind', value: mph, effect: effectOf('wind', calm), label: 'data' }
}

// Sunrise and sunset (UTC Dates) for a Chicago calendar date, NOAA's simplified solar formula.
// Accurate to a few minutes, plenty for a dawn/dusk bonus. Missing or "NEEDS CHECK" coordinates
// fall back to Galveston (otherwise every hour would count as dark and there'd be no windows).
export function sunTimes(date, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) ({ lat, lon } = GALVESTON)
  const [y, m, d] = date.split('-').map(Number)
  const noonUtc = Date.UTC(y, m - 1, d, 12)
  const dayOfYear = (noonUtc - Date.UTC(y, 0, 0)) / 864e5
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const rad = (lat * Math.PI) / 180
  const ha = Math.acos(Math.cos((90.833 * Math.PI) / 180) / (Math.cos(rad) * Math.cos(decl))
    - Math.tan(rad) * Math.tan(decl)) * (180 / Math.PI)
  const minutesUtc = (sign) => 720 - 4 * (lon + sign * ha) - eqTime
  const at = (min) => new Date(Date.UTC(y, m - 1, d) + min * 60000)
  return { sunrise: at(minutesUtc(1)), sunset: at(minutesUtc(-1)) }
}

// Full bonus within 1 hour of sunrise/sunset, fading to 0 at 2.5 hours. Full dark is a
// penalty: our users are beginners on an unfamiliar shore.
export function lightWhy(t, sun) {
  const ms = new Date(t).getTime()
  const toRise = Math.abs(ms - sun.sunrise.getTime()) / HOUR_MS
  const toSet = Math.abs(ms - sun.sunset.getTime()) / HOUR_MS
  const near = Math.min(toRise, toSet)
  const factor = clamp(1 - (near - 1) / 1.5, 0, 1)
  const value = factor > 0 ? (toRise < toSet ? 'Sunrise window' : 'Sunset window') : isDaylight(t, sun) ? 'Midday' : 'Dark'
  return { input: 'light', value, effect: effectOf('light', isDaylight(t, sun) ? factor : -1), label: 'rule of thumb' }
}

// From 1 hour before sunrise to 1 hour after sunset (dawn and dusk count as daylight).
export function isDaylight(t, sun) {
  const ms = new Date(t).getTime()
  return ms >= sun.sunrise.getTime() - HOUR_MS && ms <= sun.sunset.getTime() + HOUR_MS
}

// Change in hPa over the previous ~3 hours. Slowly falling pressure (before a front) is the
// classic "fish bite" sign; steady is fine; fast changes are worse.
export function pressureWhy(change3h) {
  if (!Number.isFinite(change3h)) return { input: 'pressure', value: 'No pressure forecast', effect: 0, label: 'rule of thumb' }
  let value, factor
  if (change3h <= -3) [value, factor] = ['Falling fast', -0.5]
  else if (change3h <= -1) [value, factor] = ['Falling slowly', 1]
  else if (change3h < 1) [value, factor] = ['Steady', 0.4]
  else if (change3h < 3) [value, factor] = ['Rising', 0]
  else [value, factor] = ['Rising fast', -0.5]
  return { input: 'pressure', value, effect: effectOf('pressure', factor), label: 'rule of thumb' }
}

// --- Hours --------------------------------------------------------------------------------

export function totalScore(why, base = SCORE_BASE) {
  return clamp(base + why.reduce((sum, w) => sum + w.effect, 0), 0, 100)
}

// One spot, one hour. All inputs are plain values so this is easy to test.
export function scoreHour({ spot, t, tideRate: rate, waterTempF, weather, pressureChange3h, sun, species }) {
  sun ??= sunTimes(chicagoDate(new Date(t)), spot.lat, spot.lon)
  const why = [
    tideWhy(rate),
    waterTempWhy(waterTempF, spot.type, species),
    windWhy(weather, spot.windExposure),
    lightWhy(t, sun),
    pressureWhy(pressureChange3h),
  ]
  // The whole hour must be light, so a window never ends after dark (beginners packing up blind).
  const daylight = isDaylight(t, sun) && isDaylight(new Date(t).getTime() + HOUR_MS, sun)
  return { t, score: totalScore(why), why, daylight }
}

// Pressure change over the 3 hours before `i` (or as many as exist).
function pressureChange(hours, i) {
  const now = hours[i]?.pressureHpa
  for (let k = Math.min(3, i); k > 0; k--) {
    const then = hours[i - k]?.pressureHpa
    if (Number.isFinite(now) && Number.isFinite(then)) return ((now - then) * 3) / k
  }
  return null
}

// Scores every weather hour of one Chicago day for one spot.
// weatherHours: weather.js day.spots[spotId]; tide: tides.js day.tide.
export function scoreSpotDay({ spot, date, tide = [], waterTempF = null, weatherHours = [], species = allSpecies }) {
  const sun = sunTimes(date, spot.lat, spot.lon)
  return weatherHours.map((w, i) => scoreHour({
    spot, t: w.t, tideRate: tideRate(tide, w.t), waterTempF, weather: w,
    pressureChange3h: pressureChange(weatherHours, i), sun, species,
  }))
}

// --- Windows ------------------------------------------------------------------------------

// Runs of consecutive daylight hours scoring >= WINDOW_MIN (no night windows; an hour counts as
// daylight only if it ends by 1h after sunset). Long runs are trimmed to their best
// `maxHours` block so one spot can't swallow the whole day. Window score/why = peak hour.
export function buildWindows(spotId, hours, { maxHours = 3 } = {}) {
  const runs = []
  let run = []
  for (const h of [...hours].sort((a, b) => new Date(a.t) - new Date(b.t))) {
    const gap = run.length && new Date(h.t) - new Date(run.at(-1).t) > HOUR_MS
    const good = h.score >= WINDOW_MIN && h.daylight !== false
    if (gap || !good) { if (run.length) runs.push(run); run = [] }
    if (good) run.push(h)
  }
  if (run.length) runs.push(run)
  return runs.map((r) => {
    let best = r.slice(0, maxHours)
    for (let i = 1; i + maxHours <= r.length; i++) {
      const block = r.slice(i, i + maxHours)
      const sum = (xs) => xs.reduce((s, h) => s + h.score, 0)
      if (sum(block) > sum(best)) best = block
    }
    const peak = best.reduce((p, h) => (h.score > p.score ? h : p))
    const startMs = new Date(best[0].t).getTime()
    const endMs = new Date(best.at(-1).t).getTime() + HOUR_MS
    return { spotId, startMs, endMs, hours: best.length, score: peak.score, why: peak.why }
  })
}

// Best windows across spots that don't overlap in time (you can only stand in one place).
// Greedy by score, then length; returned in time order, shaped per the API contract.
export function pickWindows(windows, { max = 3 } = {}) {
  const ranked = [...windows].sort((a, b) => b.score - a.score || b.hours - a.hours || a.startMs - b.startMs)
  const picked = []
  for (const w of ranked) {
    if (picked.length >= max) break
    if (picked.some((p) => w.startMs < p.endMs && p.startMs < w.endMs)) continue
    picked.push(w)
  }
  return picked.sort((a, b) => a.startMs - b.startMs).map((w) => ({
    spotId: w.spotId,
    start: chicagoHHMM(new Date(w.startMs)),
    end: chicagoHHMM(new Date(w.endMs)),
    score: w.score,
    why: w.why,
  }))
}

// Convenience: score all spots for a day and return the contract `windows` array.
// bySpot: { [spotId]: hourly scores from scoreSpotDay }.
export function planWindows(spots, bySpot, opts) {
  return pickWindows(spots.flatMap((s) => buildWindows(s.id, bySpot[s.id] ?? [], opts)), opts)
}
