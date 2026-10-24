// SAFETY VERDICT (AGENTS.md): one "go" | "caution" | "no" per day, with plain-language reasons.
// Pure: no fetching, no clock. routes/plan.js passes in one day from getAlerts (nws.js), one
// day from getWeather (weather.js) and the day's combined `missing` list.
//
// The API has one verdict per day, so it is the worst case across the spots: high rip risk on
// the beach side makes the whole day "no", and the reason text names the spot it applies to.
// Missing data never counts as safe: any missing safety input makes the day at least "caution".
import { spots as allSpots } from './data.js'
import { SOURCE as NWS_SOURCE } from './nws.js'

export const WEATHER_SOURCE = 'Open-Meteo'
export const HEAT_INDEX_F = 103 // AGENTS.md: heat index >= 103°F => caution
export const WIND_MPH = 20 // AGENTS.md: wind > 20 mph => caution
// Rule of thumb: waves over 4 ft knock you off your feet wading and wash over low piers and
// rocks. AGENTS.md says "high waves" without a number.
export const HIGH_WAVES_FT = 4

const RANK = { go: 0, caution: 1, no: 2 }

// Short spot names for reason text.
const PLACE = { surf: 'Beach side', bay: 'Bay side', pier: 'Pier' }

// What each NWS signal means for someone standing on the shore with a rod.
const ALERT_TEXT = {
  thunderstorm: {
    no: 'Thunderstorm warning. A fishing rod is a lightning rod: stay off the beach and pier today.',
    caution: 'Thunderstorms are possible. If you hear thunder, put the rod down and get inside.',
  },
  tropical: {
    no: 'Tropical storm or hurricane warning. Do not go to the coast.',
    caution: 'A tropical storm could reach the coast. Check again before you leave.',
  },
  coastal_flood: {
    no: 'Coastal flood warning. Seawater is flooding low roads and beaches.',
    caution: 'Higher than normal tides may flood low roads and parts of the beach.',
  },
  flood: {
    no: 'Flood warning. Roads to the coast may be under water.',
    caution: 'Heavy rain may flood some roads. Leave extra time.',
  },
  waves: {
    no: 'Dangerous surf warning. Big waves can sweep people off the beach and pier.',
    caution: 'High surf. Stay out of the water and back from the edge of the pier.',
  },
  wind: {
    no: 'Gale or storm wind warning. Too windy to fish safely from shore.',
    caution: 'Strong wind advisory. Casting will be hard and loose gear will blow away.',
  },
  small_craft_advisory: {
    caution: 'Small craft advisory: rough water offshore. Expect spray and big waves at the pier and beach.',
  },
  rip_current: {
    no: 'High rip current risk. Rip currents are strong channels of water that pull swimmers away from shore. Do not wade in.',
    caution: 'Moderate rip current risk. Rip currents can pull you away from shore. Stay out of water deeper than your knees.',
  },
  heat: {
    caution: 'Heat advisory. Bring lots of water, wear a hat and take breaks in the shade.',
  },
  fog: {
    caution: 'Dense fog. Drive slowly and watch your footing on the pier.',
  },
}
// nws.js rates a Rip Current Statement (high risk) as only "caution" on the pier, since you're
// standing above the surf there. Say so instead of calling it moderate.
const PIER_RIP_TEXT = "High rip current risk off the beach. You're above the water on the pier, but don't climb down or wade in."
const GENERIC_ALERT = {
  no: 'The National Weather Service has a warning out for this area.',
  caution: 'The National Weather Service has an advisory out for this area.',
}

// Missing-data names (from tides/weather/nws) that matter for safety, with what we couldn't check.
const MISSING_TEXT = {
  nws_alerts: "We couldn't check weather warnings for this day (too far ahead, or the weather service didn't answer).",
  rip_current: "We couldn't get today's rip current risk. Treat the surf as risky and stay out of the water.",
  weather: "We couldn't get the wind and heat forecast.",
  waves: "We couldn't get the wave forecast.",
}
// Non-safety missing items (water temperature, salinity, tide) affect the score, not the verdict.
function safetyMissing(item) {
  const [name, spotId] = item.split(':')
  return MISSING_TEXT[name] ? { name, spotId } : null
}

// "Beach side: " prefix when a reason only applies to some spots.
function where(spotIds, spots) {
  if (spotIds.length >= spots.length) return ''
  const names = spotIds.map((id) => PLACE[spots.find((s) => s.id === id)?.type] ?? id)
  return `${names.join(' and ')}: `
}

const latest = (a, b) => (!a ? b : !b ? a : a > b ? a : b)

// Inputs:
//   alerts:  one day from getAlerts: { spots: { <spotId>: [reason with verdict] }, rip, missing }
//   weather: one day from getWeather: { spots: { <spotId>: [hour] }, missing }
//   missing: the day's combined missing list (anything from nws/weather/tides)
//   updatedAt: { nws, weather } ISO times for the "all clear" reasons
//   spots: defaults to spots.json
// Returns { verdict, reasons } in the API contract shape ({ signal, level, text, source, updatedAt }).
// level: "high" (=> no), "moderate" (=> caution), "unknown" (missing => caution), "low"/"none" (fine).
export function safetyVerdict({ alerts, weather, missing = [], updatedAt = {}, spots = allSpots } = {}) {
  const reasons = []
  const add = (verdict, reason) => reasons.push({ verdict, ...reason })

  // 1. Missing safety data. Absent inputs count as missing too.
  const gaps = new Map() // name -> [spotId] ([] = all spots)
  const noteGap = (name, spotId) => {
    const ids = gaps.get(name) ?? []
    if (spotId) ids.push(spotId)
    gaps.set(name, spotId ? ids : [])
  }
  const allMissing = [...missing, ...(alerts?.missing ?? []), ...(weather?.missing ?? [])]
  if (!alerts) allMissing.push('nws_alerts', 'rip_current')
  if (!weather) allMissing.push('weather', 'waves')
  for (const item of new Set(allMissing)) {
    const m = safetyMissing(item)
    if (!m) continue
    // Bay waves are calm and the marine model often has no bay cell: not a safety gap.
    if (m.name === 'waves' && m.spotId && spots.find((s) => s.id === m.spotId)?.type === 'bay') continue
    if (gaps.has(m.name) && gaps.get(m.name).length === 0) continue
    noteGap(m.name, m.spotId)
  }
  for (const [name, ids] of gaps) {
    add('caution', {
      signal: name, level: 'unknown', text: where(ids.length ? ids : spots.map((s) => s.id), spots) + MISSING_TEXT[name],
      source: name === 'nws_alerts' || name === 'rip_current' ? NWS_SOURCE : WEATHER_SOURCE, updatedAt: null,
    })
  }

  // 2. NWS alerts, merged across spots so one alert gives one reason naming the spots it covers.
  const merged = new Map()
  for (const spot of spots) {
    for (const r of alerts?.spots?.[spot.id] ?? []) {
      const key = `${r.signal}|${r.verdict}|${r.event}`
      const m = merged.get(key) ?? { ...r, spotIds: [] }
      m.spotIds.push(spot.id)
      m.updatedAt = latest(m.updatedAt, r.updatedAt)
      merged.set(key, m)
    }
  }
  for (const r of merged.values()) {
    const plain = r.event === 'Rip Current Statement' && r.verdict === 'caution'
      ? PIER_RIP_TEXT
      : ALERT_TEXT[r.signal]?.[r.verdict] ?? GENERIC_ALERT[r.verdict]
    add(r.verdict, {
      signal: r.signal, level: r.level,
      text: `${where(r.spotIds, spots)}${plain} NWS says: "${r.text}"`,
      source: r.source, updatedAt: r.updatedAt,
    })
  }
  if (alerts && !gaps.has('nws_alerts') && merged.size === 0) {
    add('go', {
      signal: 'nws_alerts', level: 'none', text: 'No weather warnings or advisories for Galveston.',
      source: NWS_SOURCE, updatedAt: updatedAt.nws ?? null,
    })
  }

  // 3. Forecast thresholds, worst hour of the day at each spot.
  if (weather?.spots) {
    const worst = { feelsLikeF: { v: null, ids: [] }, windMph: { v: null, ids: [] }, waveFt: { v: null, ids: [] } }
    for (const spot of spots) {
      for (const key of Object.keys(worst)) {
        if (key === 'waveFt' && spot.type === 'bay') continue
        const vals = (weather.spots[spot.id] ?? []).map((h) => h[key]).filter(Number.isFinite)
        if (!vals.length) continue
        const max = Math.max(...vals)
        const w = worst[key]
        if (w.v == null || max > w.v) w.v = max
        const over = key === 'feelsLikeF' ? max >= HEAT_INDEX_F : key === 'windMph' ? max > WIND_MPH : max > HIGH_WAVES_FT
        if (over) w.ids.push(spot.id)
      }
    }
    const src = { source: WEATHER_SOURCE, updatedAt: updatedAt.weather ?? null }
    const { feelsLikeF: heat, windMph: wind, waveFt: waves } = worst
    if (heat.v != null) {
      const f = Math.round(heat.v)
      add(heat.ids.length ? 'caution' : 'go', heat.ids.length
        ? { signal: 'heat', level: 'moderate', text: `Feels like up to ${f}°F. That's dangerous heat: bring lots of water, wear a hat and rest in the shade.`, ...src }
        : { signal: 'heat', level: 'none', text: `Feels like up to ${f}°F. No heat danger.`, ...src })
    }
    if (wind.v != null) {
      const mph = Math.round(wind.v)
      add(wind.ids.length ? 'caution' : 'go', wind.ids.length
        ? { signal: 'wind', level: 'moderate', text: `${where(wind.ids, spots)}Wind up to ${mph} mph. Strong wind makes casting hard and waves rough. Pick a sheltered spot.`, ...src }
        : { signal: 'wind', level: 'low', text: `Wind up to ${mph} mph. Fine for fishing from shore.`, ...src })
    }
    if (waves.v != null) {
      const ft = Math.round(waves.v * 10) / 10
      add(waves.ids.length ? 'caution' : 'go', waves.ids.length
        ? { signal: 'waves', level: 'moderate', text: `${where(waves.ids, spots)}Waves up to ${ft} ft. Stay out of the water and back from the pier edge.`, ...src }
        : { signal: 'waves', level: 'low', text: `Waves up to ${ft} ft. Calm enough from shore.`, ...src })
    }
  }

  const verdict = reasons.reduce((v, r) => (RANK[r.verdict] > RANK[v] ? r.verdict : v), 'go')
  return {
    verdict,
    // Worst first, so the screen can show the top reason as the headline.
    reasons: reasons
      .sort((a, b) => RANK[b.verdict] - RANK[a.verdict])
      .map(({ verdict: _, ...r }) => r),
  }
}
