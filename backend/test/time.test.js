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

test('DST starts (23-hour days): Mar 8, 2026 and Mar 14, 2027', () => {
  for (const d of ['2026-03-08', '2027-03-14']) {
    assert.equal((chicagoMidnight(addDays(d, 1)) - chicagoMidnight(d)) / 3.6e6, 23, d)
  }
  assert.equal(chicagoMidnight('2027-03-14').toISOString(), '2027-03-14T06:00:00.000Z')
  assert.equal(chicagoMidnight('2027-03-15').toISOString(), '2027-03-15T05:00:00.000Z')
})

test('every day of 2026-2027 is 23, 24 or 25 hours, and only the DST days differ', () => {
  const odd = []
  for (let d = '2026-01-01'; d < '2028-01-01'; d = addDays(d, 1)) {
    const h = (chicagoMidnight(addDays(d, 1)) - chicagoMidnight(d)) / 3.6e6
    if (h !== 24) odd.push(`${d}:${h}`)
  }
  assert.deepEqual(odd, ['2026-03-08:23', '2026-11-01:25', '2027-03-14:23', '2027-11-07:25'])
})

test('addDays: month ends, leap years, year boundary, negative', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2027-02-28', 1), '2027-03-01')
  assert.equal(addDays('2026-11-01', -1), '2026-10-31')
  assert.equal(addDays('2026-10-24', 0), '2026-10-24')
})

test('the repeated 1 AM hour on Nov 1 maps to the right local date and time', () => {
  assert.equal(chicagoDate(new Date('2026-11-01T05:00:00Z')), '2026-11-01') // 00:00 CDT
  assert.equal(chicagoHHMM(new Date('2026-11-01T06:30:00Z')), '01:30') // CDT
  assert.equal(chicagoHHMM(new Date('2026-11-01T07:30:00Z')), '01:30') // CST, again
  assert.equal(chicagoHHMM(new Date('2026-11-01T08:00:00Z')), '02:00')
  assert.equal(chicagoDate(new Date('2026-11-02T05:59:00Z')), '2026-11-01') // 23:59 CST
  assert.equal(chicagoHHMM(new Date('2026-10-25T04:59:00Z')), '23:59')
})
