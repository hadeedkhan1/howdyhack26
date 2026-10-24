// likelySpecies + draw for one day. Pure: no fetching, no clock.
//
// A species is likely when its waterTempF range contains today's water temperature and its
// spotTypes include the type of a spot the plan recommends (a window's spotId). species.json is
// hand-curated and may still hold nulls or "NEEDS CHECK"; an unknown range or spot list never
// rules a species out, it just makes it "medium".
import { species as allSpecies, spots as allSpots } from './data.js'

export const LIKELIHOODS = ['high', 'medium', 'low']
// Within this many °F outside a species' range it may still bite, just less often.
export const NEAR_RANGE_F = 3

const RANK = { high: 0, medium: 1, low: 2 }
const SPOT_TYPES = new Set(['surf', 'bay', 'pier'])

// [min, max] if both are real numbers, else null (nulls, "NEEDS CHECK", wrong shape).
function tempRange(s) {
  const r = s.waterTempF
  if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite) || r[0] > r[1]) return null
  return r
}

// Valid spot types, or null if the list is empty or unusable.
function spotTypes(s) {
  const t = Array.isArray(s.spotTypes) ? s.spotTypes.filter((x) => SPOT_TYPES.has(x)) : []
  return t.length ? t : null
}

// "in" | "near" | "out" | "unknown"
function tempFit(s, waterTempF) {
  const r = tempRange(s)
  if (!r || !Number.isFinite(waterTempF)) return 'unknown'
  const [lo, hi] = r
  if (waterTempF >= lo && waterTempF <= hi) return 'in'
  return waterTempF >= lo - NEAR_RANGE_F && waterTempF <= hi + NEAR_RANGE_F ? 'near' : 'out'
}

// "yes" | "no" | "unknown"
function spotFit(s, windowTypes) {
  const t = spotTypes(s)
  if (!t || !windowTypes.size) return 'unknown'
  return t.some((x) => windowTypes.has(x)) ? 'yes' : 'no'
}

// null = not likely today (wrong spot or water far too warm/cold).
export function likelihood(s, { waterTempF, windowTypes }) {
  const temp = tempFit(s, waterTempF)
  const spot = spotFit(s, windowTypes)
  if (temp === 'out' || spot === 'no') return null
  if (temp === 'near') return 'low'
  if (temp === 'in' && spot === 'yes') return 'high'
  return 'medium' // at least one of the two is unknown
}

// Stable 32-bit FNV-1a hash, so tie order depends only on the date and species id.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193)
  return h >>> 0
}

// Inputs:
//   date: "YYYY-MM-DD" (breaks ties so the draw is the same all day but changes day to day)
//   waterTempF: number or null (pass null if the reading is missing or stale)
//   windows: the day's contract `windows` (only spotId is used)
// Returns { likelySpecies: [{ id, likelihood }], draw } in contract shape. likelySpecies is
// sorted best first and the draw is always likelySpecies[0]. If nothing qualifies (e.g. very
// cold water), every species comes back "low" so the Hand screen is never empty.
export function likelySpecies({ date, waterTempF, windows = [], species = allSpecies, spots = allSpots }) {
  const typeOf = Object.fromEntries(spots.map((s) => [s.id, s.type]))
  const windowTypes = new Set(windows.map((w) => typeOf[w.spotId]).filter(Boolean))

  let list = species
    .map((s) => ({ id: s.id, likelihood: likelihood(s, { waterTempF, windowTypes }) }))
    .filter((s) => s.likelihood)
  if (!list.length) list = species.map((s) => ({ id: s.id, likelihood: 'low' }))

  list.sort((a, b) => RANK[a.likelihood] - RANK[b.likelihood]
    || hash(`${date}|${a.id}`) - hash(`${date}|${b.id}`))
  return { likelySpecies: list, draw: list[0]?.id ?? null }
}
