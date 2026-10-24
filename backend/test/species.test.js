import { test } from 'node:test'
import assert from 'node:assert/strict'
import { likelySpecies } from '../services/species.js'
import { species as realSpecies, spots } from '../services/data.js'

const date = '2026-10-24'
const bayWindow = [{ spotId: 'gisp-bay', start: '07:00', end: '09:00', score: 72, why: [] }]
const surfWindow = [{ spotId: 'gisp-beach', start: '17:00', end: '19:00', score: 68, why: [] }]

// Small hand-made species list, independent of the content person's progress on species.json.
const fixture = [
  { id: 'croaker', spotTypes: ['bay', 'pier'], waterTempF: [60, 85] },
  { id: 'whiting', spotTypes: ['surf', 'pier'], waterTempF: [55, 80] },
  { id: 'sheepshead', spotTypes: ['pier', 'bay'], waterTempF: [50, 70] },
  { id: 'red-drum', spotTypes: ['surf', 'bay', 'pier'], waterTempF: [55, 90] },
  { id: 'speckled-trout', spotTypes: ['bay'], waterTempF: ['NEEDS CHECK', 'NEEDS CHECK'] },
  { id: 'black-drum', spotTypes: 'NEEDS CHECK', waterTempF: [50, 85] },
  { id: 'hardhead-catfish', spotTypes: [], waterTempF: null },
]
const run = (over) => likelySpecies({ date, waterTempF: 75, windows: bayWindow, species: fixture, ...over })
const level = (r, id) => r.likelySpecies.find((s) => s.id === id)?.likelihood

test('in range at a recommended spot type -> high; wrong spot or temp -> left out', () => {
  const r = run()
  assert.equal(level(r, 'croaker'), 'high')
  assert.equal(level(r, 'red-drum'), 'high')
  assert.equal(level(r, 'whiting'), undefined, 'surf/pier fish, only a bay window')
  assert.equal(level(r, 'sheepshead'), undefined, '75°F is well above 50-70')
  // Same water, surf window: whiting is in, croaker (bay/pier) is out.
  const surf = run({ windows: surfWindow })
  assert.equal(level(surf, 'whiting'), 'high')
  assert.equal(level(surf, 'croaker'), undefined)
})

test('just outside a range -> low', () => {
  assert.equal(level(run({ waterTempF: 72 }), 'sheepshead'), 'low') // 2°F over 70
  assert.equal(level(run({ waterTempF: 74 }), 'sheepshead'), undefined) // 4°F over
})

test('nulls and "NEEDS CHECK" -> medium, never a crash', () => {
  const r = run()
  assert.equal(level(r, 'speckled-trout'), 'medium', 'unknown temp range')
  assert.equal(level(r, 'black-drum'), 'medium', 'unknown spot types')
  assert.equal(level(r, 'hardhead-catfish'), 'medium', 'both unknown')
  // Unknown water temp or no windows: nothing can be ruled in or out.
  assert.ok(run({ waterTempF: null }).likelySpecies.every((s) => s.likelihood === 'medium'))
  assert.ok(run({ windows: [] }).likelySpecies.every((s) => ['medium', 'low'].includes(s.likelihood)))
})

test('works on the real species.json as it is today', () => {
  for (const waterTempF of [null, 45, 72, 90]) {
    for (const windows of [[], bayWindow, surfWindow]) {
      const r = likelySpecies({ date, waterTempF, windows })
      assert.ok(r.likelySpecies.length > 0)
      assert.ok(realSpecies.some((s) => s.id === r.draw))
      assert.equal(r.draw, r.likelySpecies[0].id)
    }
  }
})

test('draw = highest likelihood, the draw is first, list sorted best first', () => {
  const r = run()
  assert.ok(['croaker', 'red-drum'].includes(r.draw))
  assert.equal(r.likelySpecies[0].id, r.draw)
  const ranks = r.likelySpecies.map((s) => ['high', 'medium', 'low'].indexOf(s.likelihood))
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
})

test('ties break by date: same date -> same draw, different dates -> it changes', () => {
  const tied = fixture.map((s) => ({ ...s, spotTypes: ['bay'], waterTempF: [60, 80] }))
  const drawOn = (d) => likelySpecies({ date: d, waterTempF: 70, windows: bayWindow, species: tied }).draw
  assert.equal(drawOn(date), drawOn(date))
  // Input order doesn't matter either.
  assert.equal(likelySpecies({ date, waterTempF: 70, windows: bayWindow, species: [...tied].reverse() }).draw, drawOn(date))
  const draws = new Set(Array.from({ length: 30 }, (_, i) => drawOn(`2026-11-${String(i + 1).padStart(2, '0')}`)))
  assert.ok(draws.size > 1, 'not the same fish every day')
})

test('nothing qualifies -> every species "low", draw still set', () => {
  const r = run({ waterTempF: 30, species: fixture.slice(0, 4) })
  assert.equal(r.likelySpecies.length, 4)
  assert.ok(r.likelySpecies.every((s) => s.likelihood === 'low'))
  assert.ok(r.draw)
})

test('window spotIds come from spots.json types', () => {
  // The pier window should let in pier fish like sheepshead (in range at 65°F).
  const pier = spots.find((s) => s.type === 'pier')
  const r = run({ waterTempF: 65, windows: [{ spotId: pier.id }] })
  assert.equal(level(r, 'sheepshead'), 'high')
})
