// Shared checks for the AGENTS.md "API contract". Used on mock/plan.json, snapshots/demo.json
// and live buildPlan output so all three stay interchangeable for the frontend.
// (node --test also loads this file as a test file; it has no tests of its own.)
import assert from 'node:assert/strict'
import { addDays, chicagoMidnight } from '../services/time.js'

export const SPOT_IDS = ['gisp-beach', 'gisp-bay', 'galveston-pier']
export const SPECIES_IDS = ['croaker', 'whiting', 'sheepshead', 'black-drum', 'red-drum', 'speckled-trout', 'hardhead-catfish']
export const VERDICTS = ['go', 'caution', 'no']
export const LEVELS = ['none', 'low', 'info', 'moderate', 'high', 'unknown']
export const LIKELIHOODS = ['high', 'medium', 'low']
const RANK = { go: 0, caution: 1, no: 2 }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/
const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s)
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

export function checkReason(r, where) {
  assert.deepEqual(Object.keys(r).sort(), ['level', 'signal', 'source', 'text', 'updatedAt'], `${where} keys`)
  assert.ok(typeof r.signal === 'string' && r.signal, `${where}.signal`)
  assert.ok(LEVELS.includes(r.level), `${where}.level "${r.level}"`)
  assert.ok(typeof r.text === 'string' && r.text.trim().length > 5, `${where}.text`)
  assert.ok(typeof r.source === 'string' && r.source, `${where}.source`)
  assert.ok(r.updatedAt === null || isIso(r.updatedAt), `${where}.updatedAt "${r.updatedAt}"`)
}

export function checkSafety(safety, where) {
  assert.ok(VERDICTS.includes(safety.verdict), `${where}.verdict`)
  assert.ok(Array.isArray(safety.reasons) && safety.reasons.length > 0, `${where}: at least one reason`)
  safety.reasons.forEach((r, i) => checkReason(r, `${where}.reasons[${i}]`))
  const levels = safety.reasons.map((r) => r.level)
  // The verdict must agree with its reasons (missing data never counts as safe).
  if (levels.includes('high')) assert.equal(safety.verdict, 'no', `${where}: a high-level reason means "no"`)
  if (levels.some((l) => l === 'moderate' || l === 'unknown')) {
    assert.ok(RANK[safety.verdict] >= RANK.caution, `${where}: moderate/unknown reasons mean at least caution`)
  }
  if (safety.verdict === 'go') {
    assert.ok(levels.every((l) => ['none', 'low', 'info'].includes(l)), `${where}: "go" only with none/low/info reasons`)
    // AGENTS.md: show "Go: no hazards flagged", never "safe".
    for (const r of safety.reasons) assert.doesNotMatch(r.text, /\bsafe\b/i, `${where}: "go" text never says safe`)
  }
}

export function checkWindow(w, scoreBase, where) {
  assert.deepEqual(Object.keys(w).sort(), ['end', 'score', 'spotId', 'start', 'why'], `${where} keys`)
  assert.ok(SPOT_IDS.includes(w.spotId), `${where}.spotId "${w.spotId}"`)
  assert.match(w.start, HHMM, `${where}.start`)
  assert.match(w.end, HHMM, `${where}.end`)
  assert.ok(minutes(w.start) < minutes(w.end), `${where}: start ${w.start} before end ${w.end}`)
  assert.ok(Number.isInteger(w.score) && w.score >= 0 && w.score <= 100, `${where}.score`)
  assert.ok(Array.isArray(w.why) && w.why.length > 0, `${where}.why`)
  for (const [i, y] of w.why.entries()) {
    assert.deepEqual(Object.keys(y).sort(), ['effect', 'input', 'label', 'value'], `${where}.why[${i}] keys`)
    assert.ok(['data', 'rule of thumb'].includes(y.label), `${where}.why[${i}].label`)
    assert.ok(Number.isFinite(y.effect), `${where}.why[${i}].effect`)
  }
  const sum = w.why.reduce((s, y) => s + y.effect, 0)
  assert.equal(w.score, Math.min(100, Math.max(0, scoreBase + sum)), `${where}: score = scoreBase + sum(effects)`)
}

// opts.tideEndInclusive: the hand-made mock also lists the next midnight's tide point.
export function checkPlan(plan, { snapshot, tideEndInclusive = false } = {}) {
  assert.ok(isIso(plan.generatedAt), 'generatedAt is ISO')
  assert.equal(typeof plan.snapshot, 'boolean')
  if (snapshot !== undefined) assert.equal(plan.snapshot, snapshot)
  assert.equal(plan.scoreBase, 50)
  assert.ok(Array.isArray(plan.days) && plan.days.length >= 1 && plan.days.length <= 2, '1 or 2 days')
  plan.days.forEach((day, d) => {
    const where = `days[${d}]`
    assert.deepEqual(Object.keys(day).sort(), ['date', 'draw', 'likelySpecies', 'missing', 'safety', 'tide', 'windows'], `${where} keys`)
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/)
    if (d > 0) assert.equal(day.date, addDays(plan.days[0].date, d), `${where}: consecutive dates`)
    checkSafety(day.safety, `${where}.safety`)

    const from = chicagoMidnight(day.date).getTime()
    const to = chicagoMidnight(addDays(day.date, 1)).getTime()
    let prev = -Infinity
    for (const [i, p] of day.tide.entries()) {
      assert.match(p.t, ISO_UTC, `${where}.tide[${i}].t is UTC`)
      assert.ok(Number.isFinite(p.ft), `${where}.tide[${i}].ft`)
      const ms = Date.parse(p.t)
      assert.ok(ms > prev, `${where}.tide sorted, no duplicates`)
      assert.ok(ms >= from && (tideEndInclusive ? ms <= to : ms < to), `${where}.tide[${i}] inside the Chicago day`)
      prev = ms
    }

    day.windows.forEach((w, i) => checkWindow(w, plan.scoreBase, `${where}.windows[${i}]`))
    const sorted = [...day.windows].sort((a, b) => minutes(a.start) - minutes(b.start))
    assert.deepEqual(day.windows, sorted, `${where}.windows in time order`)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(minutes(sorted[i].start) >= minutes(sorted[i - 1].end), `${where}.windows don't overlap`)
    }

    assert.ok(Array.isArray(day.likelySpecies) && day.likelySpecies.length > 0, `${where}.likelySpecies not empty`)
    const ids = day.likelySpecies.map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length, `${where}.likelySpecies unique`)
    for (const s of day.likelySpecies) {
      assert.ok(SPECIES_IDS.includes(s.id), `${where}: species id "${s.id}"`)
      assert.ok(LIKELIHOODS.includes(s.likelihood), `${where}: likelihood "${s.likelihood}"`)
    }
    const ranks = day.likelySpecies.map((s) => LIKELIHOODS.indexOf(s.likelihood))
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${where}.likelySpecies sorted best first`)
    assert.ok(ids.includes(day.draw), `${where}.draw "${day.draw}" is one of likelySpecies`)
    assert.equal(day.draw, ids[0], `${where}.draw is the most likely species`)

    assert.ok(Array.isArray(day.missing) && day.missing.every((m) => typeof m === 'string'), `${where}.missing`)
    assert.equal(new Set(day.missing).size, day.missing.length, `${where}.missing has no duplicates`)
  })
}
