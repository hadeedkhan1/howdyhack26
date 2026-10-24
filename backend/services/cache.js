// Tiny file cache so we don't hammer APIs (and so a flaky API can't break the demo).
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'

const dir = new URL('../cache/', import.meta.url)
mkdirSync(dir, { recursive: true })

// Stale cache older than this is not served; the fetch error is thrown so the caller
// reports the item in "missing" (missing data never counts as safe).
export const MAX_STALE_MS = 6 * 60 * 60 * 1000

export const cacheFile = (url) => new URL(createHash('sha1').update(url).digest('hex') + '.json', dir)

// validate(data) may throw to reject a bad 200 response (e.g. NOAA's {"error": ...}),
// so it is not cached and stale cache (up to MAX_STALE_MS old) is served instead.
export async function cachedJson(url, { ttlMs = 30 * 60 * 1000, headers = {}, validate } = {}) {
  const file = cacheFile(url)
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < ttlMs) {
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const data = await res.json()
    validate?.(data)
    writeFileSync(file, JSON.stringify(data))
    return data
  } catch (err) {
    // Serve stale cache rather than failing, if we have it and it isn't too old.
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_STALE_MS) {
      return JSON.parse(readFileSync(file, 'utf8'))
    }
    throw err
  }
}
