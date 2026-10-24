// Shared content files, the mock and the demo snapshot vs. AGENTS.md. These catch the realistic
// mistakes: a typo in an ID, a NEEDS CHECK left in a number field, a mock that drifted from
// what the live API returns.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spots, species, regulations } from '../services/data.js'
import { checkPlan, SPOT_IDS, SPECIES_IDS } from './contract-helpers.js'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const NEEDS_CHECK = 'NEEDS CHECK'
// A value may be unverified (null or "NEEDS CHECK"); otherwise it must have the right type.
const unverified = (v) => v === null || v === NEEDS_CHECK || v === ''
const urlOrBlank = (v) => unverified(v) || /^https:\/\/\S+$/.test(v)

test('spots.json: exactly the 3 shared IDs, types and park flags from AGENTS.md', () => {
  assert.deepEqual(spots.map((s) => s.id).sort(), [...SPOT_IDS].sort())
  const byId = Object.fromEntries(spots.map((s) => [s.id, s]))
  assert.equal(byId['gisp-beach'].type, 'surf')
  assert.equal(byId['gisp-bay'].type, 'bay')
  assert.equal(byId['galveston-pier'].type, 'pier')
  assert.equal(byId['gisp-beach'].inStatePark, true)
  assert.equal(byId['gisp-bay'].inStatePark, true)
  assert.equal(byId['galveston-pier'].inStatePark, false)
  for (const s of spots) {
    for (const k of ['id', 'name', 'type', 'lat', 'lon', 'inStatePark', 'windExposure', 'noaaStation', 'fee', 'amenities', 'beginnerNotes', 'sourceUrl']) {
      assert.ok(k in s, `${s.id}.${k} present`)
    }
    assert.ok(['high', 'low'].includes(s.windExposure), `${s.id}.windExposure`)
    assert.equal(s.noaaStation, '8771450')
    assert.ok(Array.isArray(s.amenities))
    assert.ok(urlOrBlank(s.sourceUrl), `${s.id}.sourceUrl`)
    // Galveston Island is roughly 29.0-29.4 N, 94.7-95.2 W. A swapped or unsigned lon would put
    // the spot in China or the Atlantic and break weather and NWS lookups.
    if (!unverified(s.lat) || !unverified(s.lon)) {
      assert.ok(Number.isFinite(s.lat) && s.lat > 29 && s.lat < 29.5, `${s.id}.lat ${s.lat} is on Galveston Island`)
      assert.ok(Number.isFinite(s.lon) && s.lon > -95.2 && s.lon < -94.6, `${s.id}.lon ${s.lon} is on Galveston Island (negative)`)
    }
  }
})

test('species.json: exactly the 7 shared IDs, schema keys, sane ranges', () => {
  assert.deepEqual(species.map((s) => s.id).sort(), [...SPECIES_IDS].sort())
  for (const s of species) {
    for (const k of ['id', 'name', 'aka', 'photo', 'photoCredit', 'silhouette', 'spotTypes', 'waterTempF', 'bait', 'rig', 'howTo', 'handling', 'eat', 'funFact']) {
      assert.ok(k in s, `${s.id}.${k} present`)
    }
    assert.ok(typeof s.name === 'string' && s.name, `${s.id}.name`)
    if (Array.isArray(s.spotTypes)) {
      for (const t of s.spotTypes) assert.ok(['surf', 'bay', 'pier'].includes(t), `${s.id}.spotTypes "${t}"`)
    } else {
      assert.equal(s.spotTypes, NEEDS_CHECK, `${s.id}.spotTypes is a list`)
    }
    if (Array.isArray(s.waterTempF) && s.waterTempF.every(Number.isFinite)) {
      const [lo, hi] = s.waterTempF
      assert.ok(lo < hi, `${s.id}.waterTempF is [min, max]`)
      assert.ok(lo >= 35 && hi <= 100, `${s.id}.waterTempF ${lo}-${hi} is in °F, not °C`)
    }
    // "Can I eat it?" must come from an official source (Texas DSHS), never AI memory.
    assert.ok(s.eat && 'ok' in s.eat, `${s.id}.eat.ok present`)
    if (typeof s.eat.ok === 'boolean') {
      assert.match(s.eat.sourceUrl, /^https:\/\//, `${s.id}: an eat verdict needs a sourceUrl`)
    }
  }
})

test('regulations.json: one entry per species, filled numbers carry an official source', () => {
  assert.deepEqual(Object.keys(regulations.species).sort(), [...SPECIES_IDS].sort())
  assert.ok(urlOrBlank(regulations.sourceUrl))
  for (const [id, r] of Object.entries(regulations.species)) {
    for (const k of ['minIn', 'maxIn', 'dailyBag']) {
      assert.ok(unverified(r[k]) || (Number.isFinite(r[k]) && r[k] >= 0), `${id}.${k} is a number`)
    }
    if ([r.minIn, r.maxIn, r.dailyBag].some(Number.isFinite)) {
      assert.match(r.sourceUrl, /^https:\/\//, `${id}: limits need a TPWD sourceUrl`)
    }
    if (Number.isFinite(r.minIn) && Number.isFinite(r.maxIn)) assert.ok(r.minIn < r.maxIn, `${id}: minIn < maxIn`)
  }
  assert.ok(Array.isArray(regulations.license.rules))
  for (const a of regulations.advisories) {
    for (const id of a.speciesIds) assert.ok(SPECIES_IDS.includes(id), `advisory species "${id}"`)
  }
})

test('mock/plan.json follows the API contract (the frontend builds against it)', () => {
  checkPlan(readJson('../mock/plan.json'))
})

test('snapshots/demo.json follows the API contract and is marked as a snapshot', () => {
  checkPlan(readJson('../snapshots/demo.json'), { snapshot: true })
})
