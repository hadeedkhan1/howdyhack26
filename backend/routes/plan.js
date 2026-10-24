import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { getTides } from '../services/tides.js'
import { getWeather } from '../services/weather.js'
import { getAlerts } from '../services/nws.js'
import { SCORE_BASE, scoreSpotDay, planWindows } from '../services/scoring.js'
import { safetyVerdict } from '../services/safety.js'
import { likelySpecies } from '../services/species.js'
import { spots } from '../services/data.js'
import { addDays, chicagoDate } from '../services/time.js'

const router = Router()
const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// A real calendar date: rejects 2026-02-30 (Date.parse rolls it to Mar 2) and years 0-99
// (Date.UTC maps them to the 1900s), since addDays would round-trip them to a different date.
const isRealDate = (s) => typeof s === 'string' && DATE_RE.test(s) && Number(s.slice(0, 4)) >= 1000 && addDays(s, 0) === s

// The services never throw, but a bug in one must not take down the whole plan.
// A result without a `days` list counts as a failure too.
async function settle(name, promise) {
  try {
    const r = await promise
    if (!Array.isArray(r?.days)) throw new Error('returned no days')
    return r
  } catch (err) {
    console.error(`[plan] ${name} failed: ${err.message}`)
    return null
  }
}

// One step of a day; on error, `fallback` is used and `name` goes into the day's missing list.
function attempt(name, missing, fn, fallback) {
  try {
    return fn()
  } catch (err) {
    console.error(`[plan] ${name} failed:`, err)
    missing.push(name)
    return fallback
  }
}

// Builds the API response (AGENTS.md "API contract"). Fetches tides, weather and NWS alerts in
// parallel; anything that fails or is stale ends up in each day's `missing` instead of crashing.
// `fetchers` lets tests swap in fake services.
const FETCHERS = { getTides, getWeather, getAlerts }
export async function buildPlan({ start, days = 1 }, fetchers = {}) {
  const f = { ...FETCHERS, ...fetchers }
  // async wrappers so a service that throws synchronously is caught too
  const [tides, weather, alerts] = await Promise.all([
    settle('tides', (async () => f.getTides({ start, days }))()),
    settle('weather', (async () => f.getWeather({ start, days }))()),
    settle('nws', (async () => f.getAlerts({ start, days }))()),
  ])
  // Water temp is the latest reading, so it's the same for every day. Stale counts as unknown.
  const waterTempF = tides?.waterTemp && !tides.waterTemp.stale ? tides.waterTemp.f : null

  const out = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    const tideDay = tides?.days.find((d) => d.date === date)
    const weatherDay = weather?.days.find((d) => d.date === date)
    const alertDay = alerts?.days.find((d) => d.date === date)

    const missing = [
      ...(tides ? tides.missing ?? [] : ['tide', 'water_temperature']),
      ...(tides && !tideDay?.tide?.length ? ['tide'] : []),
      ...(weatherDay ? weatherDay.missing ?? [] : ['weather', 'waves']),
      ...(alertDay ? alertDay.missing ?? [] : ['nws_alerts', 'rip_current']),
    ]

    const tide = tideDay?.tide ?? []
    const windows = attempt('windows', missing, () => {
      const bySpot = Object.fromEntries(spots.map((spot) => [spot.id, scoreSpotDay({
        spot, date, tide, waterTempF, weatherHours: weatherDay?.spots[spot.id] ?? [],
      })]))
      return planWindows(spots, bySpot)
    }, [])

    const { likelySpecies: likely, draw } = attempt('species',
      missing, () => likelySpecies({ date, waterTempF, windows }), { likelySpecies: [], draw: null })

    // Last, so it sees every missing item above. If it fails, the verdict is caution, never go.
    const safety = attempt('safety', missing, () => safetyVerdict({
      alerts: alertDay, weather: weatherDay, missing,
      updatedAt: { nws: alerts?.updatedAt, weather: weather?.updatedAt },
    }), {
      verdict: 'caution',
      reasons: [{ signal: 'safety', level: 'unknown', text: "We couldn't check today's conditions. Be careful and check the weather before you go.", source: 'Go Fish', updatedAt: null }],
    })

    return { date, safety, tide, windows, likelySpecies: likely, draw, missing: [...new Set(missing)] }
  })

  return { generatedAt: new Date().toISOString(), snapshot: false, scoreBase: SCORE_BASE, days: out }
}

// GET /api/plan?start=YYYY-MM-DD&days=1|2[&snapshot=demo]
router.get('/', async (req, res) => {
  if (req.query.snapshot === 'demo') {
    try {
      return res.json(readJson('../snapshots/demo.json'))
    } catch (err) {
      console.error(err)
      return res.status(404).json({ error: 'No demo snapshot saved yet (run node scripts/save-snapshot.js)' })
    }
  }
  const start = req.query.start ?? chicagoDate(new Date())
  const days = req.query.days === undefined ? 1 : Number(req.query.days)
  if (!isRealDate(start)) {
    return res.status(400).json({ error: 'start must be YYYY-MM-DD' })
  }
  if (days !== 1 && days !== 2) {
    return res.status(400).json({ error: 'days must be 1 or 2' })
  }
  try {
    return res.json(await buildPlan({ start, days }))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not build plan' })
  }
})

export default router
