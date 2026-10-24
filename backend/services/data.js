// Loads the shared content files (single source of truth lives in frontend/src/data).
import { readFileSync } from 'node:fs'

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../../frontend/src/data/${name}`, import.meta.url), 'utf8'))

export const spots = load('spots.json')
export const species = load('species.json')
export const regulations = load('regulations.json')
