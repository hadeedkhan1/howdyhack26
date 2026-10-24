// Prints what services/weather.js returns, as a table you can hold up against weather.gov.
// Usage: node scripts/try-weather.js [YYYY-MM-DD] [days] [spotId]
// Defaults: today (Chicago), 1 day, galveston-pier.
import { getWeather } from '../services/weather.js'
import { addDays, chicagoDate, chicagoHHMM } from '../services/time.js'

const start = process.argv[2] || chicagoDate(new Date())
const days = Number(process.argv[3] || 1)
const spotId = process.argv[4] || 'galveston-pier'

const compass = (deg) => deg == null ? '?' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
const fmt = (v, d = 0) => v == null ? '  -' : v.toFixed(d)

const w = await getWeather({ start, days })
console.log(`source: ${w.source}  updatedAt: ${w.updatedAt}`)
console.log('coords:', w.spots)

for (const day of w.days) {
  const hours = day.spots[spotId] ?? []
  console.log(`\n== ${day.date}  ${spotId}  (${hours.length} hours)  missing: ${JSON.stringify(day.missing)}`)
  if (!hours.length) continue
  console.log('local  tempF feelsF  wind mph  from  hPa     waveFt')
  for (const h of hours) {
    console.log([
      chicagoHHMM(new Date(h.t)).padEnd(6), fmt(h.tempF).padStart(5), fmt(h.feelsLikeF).padStart(6),
      fmt(h.windMph).padStart(9), compass(h.windFromDeg).padStart(5), fmt(h.pressureHpa, 1).padStart(7),
      fmt(h.waveFt, 1).padStart(7),
    ].join(' '))
  }
  const temps = hours.map((h) => h.tempF)
  console.log(`high ${Math.max(...temps)}°F  low ${Math.min(...temps)}°F  max wind ${Math.max(...hours.map((h) => h.windMph))} mph`)
}

// Edge cases: DST-end day (25 hours) and a date past the 16-day forecast.
const edge = await getWeather({ start: '2026-11-01', days: 1 })
console.log(`\n2026-11-01 (DST ends): ${edge.days[0].spots[spotId].length} hours, missing ${JSON.stringify(edge.days[0].missing)}`)
const far = await getWeather({ start: addDays(chicagoDate(new Date()), 30), days: 1 })
console.log(`${far.days[0].date} (+30 days): missing ${JSON.stringify(far.days[0].missing)}`)
