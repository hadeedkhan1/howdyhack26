import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, utimesSync, rmSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Use a throwaway cache dir so tests never touch (or read) the real backend/cache/.
process.env.GOFISH_CACHE_DIR = mkdtempSync(join(tmpdir(), 'gofish-cache-'))
const { cachedJson, cacheFile, MAX_STALE_MS } = await import('../services/cache.js')

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

test('fresh cache is served without fetching', async () => {
  setup(10 * 60 * 1000)
  globalThis.fetch = async () => { throw new Error('should not fetch') }
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR }), { cached: true })
})

test('successful fetch replaces expired cache', async () => {
  setup(2 * HOUR)
  globalThis.fetch = async () => Response.json({ fresh: true })
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR }), { fresh: true })
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR }), { fresh: true }, 'and caches it')
})

test('HTTP error status (e.g. NWS 503) serves stale cache instead', async () => {
  setup(2 * HOUR)
  globalThis.fetch = async () => new Response('Service Unavailable', { status: 503 })
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR }), { cached: true })
})

test('a 200 with an HTML body (captive portal on venue wifi) is not cached', async () => {
  setup(MAX_STALE_MS + HOUR)
  globalThis.fetch = async () => new Response('<html>Sign in to Wi-Fi</html>', { headers: { 'content-type': 'text/html' } })
  await assert.rejects(cachedJson(url, { ttlMs: HOUR }))
})

test('a half-written (corrupt) cache file is refetched, not a crash for the whole TTL', async () => {
  const file = cacheFile(url)
  writeFileSync(file, '{"predictions": [{"t": "2026-10')
  globalThis.fetch = async () => Response.json({ fresh: true })
  assert.deepEqual(await cachedJson(url, { ttlMs: 24 * HOUR }), { fresh: true })
})

test('a corrupt cache file plus a failed fetch rethrows the fetch error', async () => {
  writeFileSync(cacheFile(url), '{not json')
  globalThis.fetch = async () => { throw new Error('network down') }
  await assert.rejects(cachedJson(url, { ttlMs: 0 }), /network down/)
})

test('a hung API times out instead of hanging the plan request', async () => {
  // Never answers until aborted, like NWS on a bad day.
  globalThis.fetch = (_url, { signal } = {}) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason))
  })
  const t0 = Date.now()
  await assert.rejects(cachedJson(url, { ttlMs: HOUR, timeoutMs: 50 }))
  assert.ok(Date.now() - t0 < 2000, 'gave up quickly')
  // ...and still serves stale cache when it has some.
  setup(2 * HOUR)
  globalThis.fetch = (_url, { signal } = {}) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason))
  })
  assert.deepEqual(await cachedJson(url, { ttlMs: HOUR, timeoutMs: 50 }), { cached: true })
})

test('headers are sent (NWS rejects requests without a User-Agent)', async () => {
  let seen
  globalThis.fetch = async (_url, opts) => { seen = opts.headers; return Response.json({ ok: 1 }) }
  await cachedJson(url, { ttlMs: 0, headers: { 'User-Agent': 'x' } })
  assert.equal(seen['User-Agent'], 'x')
})

test('cache writes leave no temp files behind', async () => {
  globalThis.fetch = async () => Response.json({ ok: 1 })
  await cachedJson(url, { ttlMs: 0 })
  assert.deepEqual(readdirSync(process.env.GOFISH_CACHE_DIR).filter((f) => !f.endsWith('.json')), [])
})
