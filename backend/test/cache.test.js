import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, utimesSync, rmSync } from 'node:fs'
import { cachedJson, cacheFile, MAX_STALE_MS } from '../services/cache.js'

const HOUR = 60 * 60 * 1000
const url = 'https://example.test/cache-test'
const realFetch = globalThis.fetch

// Write a cache entry that looks `ageMs` old, and make every fetch fail.
function setup(ageMs) {
  const file = cacheFile(url)
  writeFileSync(file, JSON.stringify({ cached: true }))
  const t = new Date(Date.now() - ageMs)
  utimesSync(file, t, t)
  globalThis.fetch = async () => { throw new Error('network down') }
}

afterEach(() => {
  globalThis.fetch = realFetch
  rmSync(cacheFile(url), { force: true })
})

test('failed fetch serves stale cache under 6 hours old', async () => {
  setup(2 * HOUR)
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR }), { cached: true })
})

test('failed fetch throws when cache is older than 6 hours', async () => {
  setup(MAX_STALE_MS + HOUR)
  await assert.rejects(cachedJson(url, { ttlMs: HOUR }), /network down/)
})

test('rejected 200 response also refuses too-old cache', async () => {
  setup(MAX_STALE_MS + HOUR)
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'no data' }))
  const validate = (d) => { if (d.error) throw new Error(d.error) }
  await assert.rejects(cachedJson(url, { ttlMs: HOUR, validate }), /no data/)
})
