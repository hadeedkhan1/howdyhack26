// Saves a live /api/plan response to snapshots/demo.json, served by ?snapshot=demo.
// Run it while NOAA, Open-Meteo and NWS are up, so the demo doesn't depend on venue wifi.
// Usage: node scripts/save-snapshot.js [YYYY-MM-DD] [days]
// Defaults: today (Chicago), 2 days.
import { writeFileSync } from 'node:fs'
import { buildPlan } from '../routes/plan.js'
import { chicagoDate } from '../services/time.js'

const start = process.argv[2] || chicagoDate(new Date())
const days = Number(process.argv[3] || 2)
const out = new URL('../snapshots/demo.json', import.meta.url)

const plan = await buildPlan({ start, days })
plan.snapshot = true
writeFileSync(out, JSON.stringify(plan, null, 2) + '\n')

console.log(`saved ${out.pathname}  (generatedAt ${plan.generatedAt})`)
for (const d of plan.days) {
  console.log(`${d.date}  ${d.safety.verdict.padEnd(7)}  ${d.windows.length} windows  draw: ${d.draw}  missing: ${JSON.stringify(d.missing)}`)
}
if (plan.days.some((d) => d.missing.length)) {
  console.log('\nSome data was missing. That is fine for the demo (it shows as caution), but check the list above.')
}
