// Prints the raw NWS alerts next to what services/nws.js maps them to, per spot and day.
// Usage: node scripts/try-nws.js [YYYY-MM-DD] [days]
// Defaults: today (Chicago), 2 days. Then replays the last 7 days of real (now expired)
// Galveston alerts through the same mapping, since there are often none active.
import { getAlerts, mapAlert } from '../services/nws.js'
import { spots } from '../services/data.js'
import { chicagoDate } from '../services/time.js'

const start = process.argv[2] || chicagoDate(new Date())
const days = Number(process.argv[3] || 2)

const r = await getAlerts({ start, days })
console.log(`source: ${r.source}  updatedAt: ${r.updatedAt}`)
console.log('spots:', r.spots)

console.log(`\n== RAW: ${r.alerts.length} active alert(s)`)
for (const a of r.alerts) console.log(`  ${a.event} | ${a.severity} | ${a.onset} -> ${a.ends} | ${a.zones.join(',')}\n    ${a.headline}`)

console.log('\n== MAPPED')
for (const day of r.days) {
  console.log(`${day.date}  rip: ${JSON.stringify(day.rip)}  missing: ${JSON.stringify(day.missing)}`)
  for (const [id, reasons] of Object.entries(day.spots)) {
    console.log(`  ${id.padEnd(15)} ${reasons.length ? '' : '(no alerts)'}`)
    for (const x of reasons) console.log(`    ${x.verdict.padEnd(7)} ${x.signal.padEnd(21)} ${x.level.padEnd(8)} ${x.event}: ${x.text}`)
  }
}

// Replay: recent alerts for Galveston Island + its marine zones, mapped for each spot type.
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z'
const res = await fetch(`https://api.weather.gov/alerts?zone=TXZ438,GMZ335,GMZ355&start=${since}&limit=50`, {
  headers: { 'User-Agent': 'GoFish-HowdyHack/1.0 (github.com/hadeedkhan1/howdyhack26)', Accept: 'application/geo+json' },
})
const past = (await res.json()).features?.map((f) => f.properties) ?? []
const types = [...new Set(spots.map((s) => s.type))]
console.log(`\n== REPLAY: ${past.length} alert(s) for TXZ438/GMZ335/GMZ355 since ${since}`)
console.log(`  ${'sent'.padEnd(25)} ${'event'.padEnd(33)} ${types.map((t) => t.padEnd(16)).join(' ')}`)
for (const a of past) {
  const cols = types.map((t) => { const m = mapAlert(a, t); return (m ? `${m.verdict}/${m.signal}` : '-').padEnd(16) })
  console.log(`  ${a.sent.padEnd(25)} ${(a.status === 'Actual' ? a.event : `${a.event} (${a.status})`).padEnd(33)} ${cols.join(' ')}`)
}
