// Tiny file cache so we don't hammer APIs (and so a flaky API can't break the demo).
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'

const dir = new URL('../cache/', import.meta.url)
mkdirSync(dir, { recursive: true })

export async function cachedJson(url, { ttlMs = 30 * 60 * 1000, headers = {} } = {}) {
  const file = new URL(createHash('sha1').update(url).digest('hex') + '.json', dir)
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < ttlMs) {
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const data = await res.json()
    writeFileSync(file, JSON.stringify(data))
    return data
  } catch (err) {
    // Serve stale cache rather than failing, if we have it.
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
    throw err
  }
}
