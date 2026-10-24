// Tiny file cache so we don't hammer APIs (and so a flaky API can't break the demo).
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// GOFISH_CACHE_DIR lets tests use a throwaway directory instead of backend/cache/.
const dir = process.env.GOFISH_CACHE_DIR
  ? pathToFileURL(`${process.env.GOFISH_CACHE_DIR.replace(/\/$/, '')}/`)
  : new URL('../cache/', import.meta.url)
mkdirSync(dir, { recursive: true })

// Stale cache older than this is not served; the fetch error is thrown so the caller
// reports the item in "missing" (missing data never counts as safe).
export const MAX_STALE_MS = 6 * 60 * 60 * 1000
// Give up on an API that doesn't answer (undici's own default is 5 minutes).
export const TIMEOUT_MS = 8000

export const cacheFile = (url) => new URL(createHash('sha1').update(url).digest('hex') + '.json', dir)

// Cached JSON if the file exists, is younger than maxAgeMs and parses; else undefined.
// A half-written file (server killed mid-write) is treated as no cache, not a crash.
function readCache(file, maxAgeMs) {
  if (!existsSync(file) || Date.now() - statSync(file).mtimeMs >= maxAgeMs) return undefined
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

// validate(data) may throw to reject a bad 200 response (e.g. NOAA's {"error": ...}),
// so it is not cached and stale cache (up to MAX_STALE_MS old) is served instead.
export async function cachedJson(url, { ttlMs = 30 * 60 * 1000, headers = {}, validate, timeoutMs = TIMEOUT_MS } = {}) {
  const file = cacheFile(url)
  const fresh = readCache(file, ttlMs)
  if (fresh !== undefined) return fresh
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const data = await res.json()
    validate?.(data)
    // Write then rename, so a reader never sees a partial file.
    const tmp = new URL(`${file.href}.${process.pid}.tmp`)
    writeFileSync(tmp, JSON.stringify(data))
    renameSync(tmp, file)
    return data
  } catch (err) {
    // Serve stale cache rather than failing, if we have it and it isn't too old.
    const stale = readCache(file, MAX_STALE_MS)
    if (stale !== undefined) return stale
    throw err
  }
}
