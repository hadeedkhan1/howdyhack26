// National Weather Service (api.weather.gov): active alerts per spot, mapped to the
// SAFETY VERDICT levels in AGENTS.md, plus rip current risk.
//
// Rip current risk: NWS Houston/Galveston (HGX) does not issue a Surf Zone Forecast (SRF):
// /products/types/SRF/locations has no HGX, and the nearest Texas SRF (CRP) covers only
// Corpus Christi zones. HGX announces high rip risk as a "Rip Current Statement" alert
// (Galveston Island = zone TXZ438) and moderate risk as a "Beach Hazards Statement". So an
// active Rip Current Statement = "high", Beach Hazards Statement = "moderate". No SRF is normal,
// so it is not missing data: if the alert check worked and neither statement is active, rip risk
// is "none" (safety.js adds an info reason). Only when the alert check itself is missing (fetch
// failed, stale, or past the alert horizon) does "rip_current" go in `missing` (forces caution).
import { statSync } from 'node:fs'
import { cachedJson, cacheFile } from './cache.js'
import { spots as allSpots } from './data.js'
import { addDays, chicagoMidnight } from './time.js'

const BASE = 'https://api.weather.gov'
export const SOURCE = 'National Weather Service (api.weather.gov)'
const HEADERS = {
  // NWS rejects requests without a User-Agent and asks for a way to contact the app.
  'User-Agent': 'GoFish-HowdyHack/1.0 (github.com/hadeedkhan1/howdyhack26)',
  Accept: 'application/geo+json',
}
const MIN = 60 * 1000
const HOUR = 60 * MIN
const TTL_MS = 10 * MIN // alerts change fast
const STALE_MS = HOUR // an alert list older than this (stale cache) counts as missing
// NWS issues watches and warnings at most ~48h ahead, so "no alerts" says nothing about
// days that start later than this. Those days get "nws_alerts" in `missing`.
const HORIZON_MS = 48 * HOUR

// Used when a spot's lat/lon isn't filled in yet. Seawall Blvd, Galveston Island: resolves to
// land zone TXZ438 (Galveston Island). Not Pier 21, which falls in marine zone GMZ335 (the bay)
// and would miss island alerts such as Rip Current Statements.
export const FALLBACK = { lat: 29.29, lon: -94.79 }

// Small craft advisories etc. are issued for marine zones, which a land point doesn't return.
// GMZ355: Gulf waters High Island to Freeport out 20 NM. GMZ335: Galveston Bay.
const MARINE_ZONE = { surf: 'GMZ355', pier: 'GMZ355', bay: 'GMZ335' }

// NWS event name -> { signal, verdict }. verdict follows AGENTS.md SAFETY VERDICT:
// "no" = thunderstorm, tropical or coastal flood warning (plus other life-threatening warnings);
// "caution" = small craft advisory, high waves, heat, wind, and watches.
// Rip Current Statement is handled per spot type in mapAlert.
const EVENTS = {
  'Severe Thunderstorm Warning': ['thunderstorm', 'no'],
  'Special Marine Warning': ['thunderstorm', 'no'], // marine thunderstorm / waterspout warning
  'Tornado Warning': ['thunderstorm', 'no'],
  'Extreme Wind Warning': ['tropical', 'no'],
  'Tropical Storm Warning': ['tropical', 'no'],
  'Hurricane Warning': ['tropical', 'no'],
  'Storm Surge Warning': ['tropical', 'no'],
  'Coastal Flood Warning': ['coastal_flood', 'no'],
  'Flash Flood Warning': ['flood', 'no'],
  'Tsunami Warning': ['coastal_flood', 'no'],
  'High Surf Warning': ['waves', 'no'],
  'Gale Warning': ['wind', 'no'],
  'Storm Warning': ['wind', 'no'],
  'Hurricane Force Wind Warning': ['wind', 'no'],

  'Small Craft Advisory': ['small_craft_advisory', 'caution'],
  'Small Craft Advisory for Hazardous Seas': ['small_craft_advisory', 'caution'],
  'Small Craft Advisory for Rough Bar': ['small_craft_advisory', 'caution'],
  'Small Craft Advisory for Winds': ['small_craft_advisory', 'caution'],
  'Beach Hazards Statement': ['rip_current', 'caution'], // HGX uses it for moderate rip risk
  'High Surf Advisory': ['waves', 'caution'],
  'Heat Advisory': ['heat', 'caution'],
  'Excessive Heat Warning': ['heat', 'caution'],
  'Extreme Heat Warning': ['heat', 'caution'],
  'Wind Advisory': ['wind', 'caution'],
  'Lake Wind Advisory': ['wind', 'caution'],
  'Coastal Flood Advisory': ['coastal_flood', 'caution'],
  'Coastal Flood Watch': ['coastal_flood', 'caution'],
  'Coastal Flood Statement': ['coastal_flood', 'caution'],
  'Flood Advisory': ['flood', 'caution'],
  'Flood Watch': ['flood', 'caution'],
  'Flash Flood Watch': ['flood', 'caution'],
  'Severe Thunderstorm Watch': ['thunderstorm', 'caution'],
  'Tornado Watch': ['thunderstorm', 'caution'],
  'Tropical Storm Watch': ['tropical', 'caution'],
  'Hurricane Watch': ['tropical', 'caution'],
  'Storm Surge Watch': ['tropical', 'caution'],
  'Gale Watch': ['wind', 'caution'],
  'Dense Fog Advisory': ['fog', 'caution'],
  'Marine Weather Statement': ['nws_alerts', 'caution'],
  'Special Weather Statement': ['nws_alerts', 'caution'],
}

// Unknown events: a warning is treated as "no", anything else as "caution" (never ignored).
function classify(event) {
  if (EVENTS[event]) return EVENTS[event]
  return ['nws_alerts', /Warning$/.test(event) ? 'no' : 'caution']
}

function geoJsonOk(data) {
  if (!Array.isArray(data?.features)) throw new Error('NWS: response has no features')
}

// Fetch active alerts; returns { alerts, fetchedAt } where fetchedAt is when the (possibly
// stale) cached copy was fetched.
async function active(params) {
  const q = new URLSearchParams({ status: 'actual', message_type: 'alert,update', ...params })
  const url = `${BASE}/alerts/active?${q}`
  const data = await cachedJson(url, { ttlMs: TTL_MS, headers: HEADERS, validate: geoJsonOk })
  return { alerts: data.features.map((f) => f.properties), fetchedAt: statSync(cacheFile(url)).mtime }
}

function coords(spot) {
  if (Number.isFinite(spot.lat) && Number.isFinite(spot.lon)) return { lat: spot.lat, lon: spot.lon, fallback: false }
  console.warn(`[nws] ${spot.id} has no lat/lon in spots.json; using Galveston Island fallback ${FALLBACK.lat},${FALLBACK.lon}`)
  return { ...FALLBACK, fallback: true }
}

// Trimmed alert, as printed by scripts/try-nws.js.
const summarize = (a) => ({
  id: a.id, event: a.event, severity: a.severity, headline: a.headline,
  onset: a.onset ?? a.effective, ends: a.ends ?? a.expires, sent: a.sent,
  zones: (a.affectedZones ?? []).map((z) => z.split('/').pop()),
})

// One alert -> one safety reason for a spot of the given type, or null if it doesn't apply.
// Reason shape matches the API's safety.reasons, plus `verdict` ("no" | "caution") and `event`
// for safety.js. level: "high" for verdict "no", "moderate" for "caution".
export function mapAlert(a, spotType) {
  if (a.status && a.status !== 'Actual') return null // NWS sends Test/Exercise messages too
  let [signal, verdict] = classify(a.event)
  // Rip currents form on Gulf-facing beaches, not in the bay. HGX uses both statements for rip risk.
  if (spotType === 'bay' && (a.event === 'Rip Current Statement' || a.event === 'Beach Hazards Statement')) return null
  if (a.event === 'Rip Current Statement') {
    // High rip risk is a "no" at surf spots; on the Gulf pier you're above the surf, so caution.
    signal = 'rip_current'
    verdict = spotType === 'surf' ? 'no' : 'caution'
  }
  return {
    signal, level: verdict === 'no' ? 'high' : 'moderate', verdict, event: a.event,
    text: a.parameters?.NWSheadline?.[0] ?? a.headline ?? a.event,
    source: `${SOURCE}: ${a.senderName ?? 'NWS'}`, updatedAt: a.sent,
  }
}

// Returns:
// { days: [{ date, spots: { <spotId>: [reason] }, rip: { level: "high"|"moderate", text, source, updatedAt } | null,
//            missing: [string] }],
//   alerts: [summary],                         every distinct alert fetched (for debugging)
//   spots: { <spotId>: { lat, lon, fallback, marineZone } }, source, updatedAt }
// An alert applies to a day if its [onset, ends] overlaps that Chicago day. A day's `missing`
// gets "nws_alerts" if any fetch failed, the data is stale, or the day is past the NWS alert
// horizon; and "rip_current" too if that happens with no rip statement active for a surf spot.
// Never throws.
export async function getAlerts({ start, days = 1, spots = allSpots }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i))
  const now = Date.now()
  let failed = false
  let oldest = null

  const track = async (promise, label) => {
    try {
      const r = await promise
      if (!oldest || r.fetchedAt < oldest) oldest = r.fetchedAt
      return r.alerts
    } catch (err) {
      console.warn(`[nws] ${label} failed: ${err.message}`)
      failed = true
      return []
    }
  }

  // Dedupe requests: spots without coordinates all share the fallback point.
  const spotInfo = Object.fromEntries(spots.map((s) => [s.id, { ...coords(s), marineZone: MARINE_ZONE[s.type] }]))
  const points = [...new Set(Object.values(spotInfo).map((c) => `${c.lat},${c.lon}`))]
  const zones = [...new Set(Object.values(spotInfo).map((c) => c.marineZone).filter(Boolean))]
  const [byPoint, byZone] = await Promise.all([
    Promise.all(points.map(async (p) => [p, await track(active({ point: p }), `alerts point=${p}`)])).then(Object.fromEntries),
    zones.length ? track(active({ zone: zones.join(',') }), `alerts zone=${zones}`) : [],
  ])

  const stale = oldest && now - oldest.getTime() > STALE_MS
  if (stale) console.warn(`[nws] alert data is stale (fetched ${oldest.toISOString()})`)

  // Alerts for each spot: its point, plus marine-zone alerts that list the spot's zone.
  const spotAlerts = Object.fromEntries(spots.map((s) => {
    const c = spotInfo[s.id]
    const marine = byZone.filter((a) => (a.affectedZones ?? []).some((z) => z.endsWith(`/${c.marineZone}`)))
    const seen = new Set()
    return [s.id, [...byPoint[`${c.lat},${c.lon}`], ...marine].filter((a) => !seen.has(a.id) && seen.add(a.id))]
  }))

  const all = new Map(Object.values(spotAlerts).flat().map((a) => [a.id, a]))
  const surfSpots = spots.filter((s) => s.type === 'surf')

  return {
    days: dates.map((date) => {
      const from = chicagoMidnight(date)
      const to = chicagoMidnight(addDays(date, 1))
      const overlaps = (a) => {
        const on = new Date(a.onset ?? a.effective ?? a.sent)
        const end = a.ends ?? a.expires
        return on < to && (!end || new Date(end) > from)
      }

      const bySpot = Object.fromEntries(spots.map((s) => [
        s.id, spotAlerts[s.id].filter(overlaps).map((a) => mapAlert(a, s.type)).filter(Boolean),
      ]))

      // Rip Current Statement = high risk; Beach Hazards Statement = moderate. Neither = none
      // (if the alert check worked; see `missing` below).
      const surfReasons = surfSpots.flatMap((s) => bySpot[s.id])
      const ripReason = surfReasons.find((r) => r.event === 'Rip Current Statement')
        ?? surfReasons.find((r) => r.event === 'Beach Hazards Statement')
      const rip = !ripReason ? null : {
        level: ripReason.event === 'Rip Current Statement' ? 'high' : 'moderate',
        text: ripReason.text, source: ripReason.source, updatedAt: ripReason.updatedAt,
      }

      const missing = []
      const unchecked = failed || stale || from.getTime() - now > HORIZON_MS
      if (unchecked) missing.push('nws_alerts')
      if (unchecked && surfSpots.length && !rip) missing.push('rip_current')
      return { date, spots: bySpot, rip, missing }
    }),
    alerts: [...all.values()].map(summarize),
    spots: spotInfo,
    source: SOURCE,
    updatedAt: (oldest ?? new Date()).toISOString(),
  }
}
