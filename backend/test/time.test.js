import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chicagoMidnight, chicagoHHMM, chicagoDate, addDays } from '../services/time.js'

test('chicagoMidnight handles CDT and CST', () => {
  assert.equal(chicagoMidnight('2026-10-24').toISOString(), '2026-10-24T05:00:00.000Z')
  assert.equal(chicagoMidnight('2026-11-02').toISOString(), '2026-11-02T06:00:00.000Z')
})

test('Nov 1, 2026 (DST ends) is 25 hours long', () => {
  const hours = (chicagoMidnight(addDays('2026-11-01', 1)) - chicagoMidnight('2026-11-01')) / 3.6e6
  assert.equal(hours, 25)
})

test('local formatting', () => {
  assert.equal(chicagoHHMM(new Date('2026-10-24T12:00:00Z')), '07:00')
  assert.equal(chicagoHHMM(new Date('2026-11-02T12:00:00Z')), '06:00')
  assert.equal(chicagoDate(new Date('2026-10-25T04:30:00Z')), '2026-10-24')
})
