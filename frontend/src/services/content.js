// Static content shared with the backend. Edited by the content person.
import species from '../data/species.json'
import spots from '../data/spots.json'
import regulations from '../data/regulations.json'

export { species, spots, regulations }
export const speciesById = Object.fromEntries(species.map((s) => [s.id, s]))
export const spotsById = Object.fromEntries(spots.map((s) => [s.id, s]))
