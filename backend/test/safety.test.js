import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safetyVerdict } from '../services/safety.js'
import { mapAlert } from '../services/nws.js'
import { spots } from '../services/data.js'

const sent = '2026-10-24T14:00:00Z'
const alert = (event, headline) => ({ id: event, event, status: 'Actual', headline, sent, senderName: 'NWS Houston/Galveston TX' })

// One day from getAlerts with the given NWS alerts active at every spot, and a known rip risk.
function nwsDay(events = [], { rip = { level: 'low' }, missing = [] } = {}) {
  return {
    date: '2026-10-24',
    spots: Object.fromEntries(spots.map((s) => [s.id, events.map((a) => mapAlert(a, s.type)).filter(Boolean)])),
    rip, missing,
  }
}

// One day from getWeather: a calm, mild day unless overridden.
function weatherDay(over = {}, { missing = [] } = {}) {
  const hour = { t: '2026-10-24T17:00:00Z', tempF: 78, feelsLikeF: 80, windMph: 9, windFromDeg: 150, pressureHpa: 1015, waveFt: 1.5, ...over }
  return { date: '2026-10-24', spots: Object.fromEntries(spots.map((s) => [s.id, [hour]])), missing }
}

const updatedAt = { nws: sent, weather: sent }
const signals = (r) => r.reasons.map((x) => x.signal)

function assertContractShape({ verdict, reasons }) {
  assert.ok(['go', 'caution', 'no'].includes(verdict))
  for (const r of reasons) {
    assert.deepEqual(Object.keys(r).sort(), ['level', 'signal', 'source', 'text', 'updatedAt'])
    assert.ok(r.text.length > 10)
    assert.ok(r.source)
  }
}

test('active thunderstorm warning -> "no"', () => {
  const r = safetyVerdict({
    alerts: nwsDay([alert('Severe Thunderstorm Warning', 'Severe Thunderstorm Warning until 3:00 PM CDT')]),
    weather: weatherDay(), updatedAt,
  })
  assert.equal(r.verdict, 'no')
  assert.equal(r.reasons[0].signal, 'thunderstorm')
  assert.equal(r.reasons[0].level, 'high')
  assert.match(r.reasons[0].text, /lightning/)
  assert.equal(r.reasons.filter((x) => x.signal === 'thunderstorm').length, 1, 'one reason, not one per spot')
  assertContractShape(r)
})

test('moderate rip risk -> "caution"', () => {
  // HGX signals moderate rip risk with a Beach Hazards Statement (see nws.js).
  const r = safetyVerdict({
    alerts: nwsDay([alert('Beach Hazards Statement', 'Beach Hazards Statement in effect through this evening')], { rip: { level: 'moderate' } }),
    weather: weatherDay(), updatedAt,
  })
  assert.equal(r.verdict, 'caution')
  const rip = r.reasons.find((x) => x.signal === 'rip_current')
  assert.equal(rip.level, 'moderate')
  assert.match(rip.text, /pull you away from shore/)
  assertContractShape(r)
})

test('high rip risk -> "no", and the reason names the beach side only', () => {
  const r = safetyVerdict({
    alerts: nwsDay([alert('Rip Current Statement', 'High Rip Current Risk in effect')], { rip: { level: 'high' } }),
    weather: weatherDay(), updatedAt,
  })
  assert.equal(r.verdict, 'no')
  const high = r.reasons.find((x) => x.level === 'high')
  assert.match(high.text, /^Beach side: /)
  const pier = r.reasons.find((x) => x.text.startsWith('Pier: '))
  assert.match(pier.text, /High rip current risk/, 'pier reason does not downplay a high-risk statement')
})

test('any missing safety input -> at least "caution"', () => {
  const cases = {
    'nws_alerts in missing': { alerts: nwsDay([], { missing: ['nws_alerts'] }), weather: weatherDay() },
    'rip_current in missing': { alerts: nwsDay([], { rip: null, missing: ['rip_current'] }), weather: weatherDay() },
    'weather in missing': { alerts: nwsDay(), weather: weatherDay({}, { missing: ['weather'] }) },
    'waves for the pier missing': { alerts: nwsDay(), weather: weatherDay(), missing: ['waves:galveston-pier'] },
    'no alerts input at all': { weather: weatherDay() },
    'no weather input at all': { alerts: nwsDay() },
    'nothing at all': {},
  }
  for (const [name, input] of Object.entries(cases)) {
    const r = safetyVerdict({ ...input, updatedAt })
    assert.notEqual(r.verdict, 'go', name)
    assert.ok(r.reasons.some((x) => x.level === 'unknown'), `${name}: explains what's missing`)
    assertContractShape(r)
  }
  // Missing data never downgrades a real warning.
  const storm = safetyVerdict({ alerts: nwsDay([alert('Tropical Storm Warning', 'TS warning')], { missing: ['rip_current'] }), weather: weatherDay() })
  assert.equal(storm.verdict, 'no')
})

test('non-safety missing data (water temp, bay waves) does not block "go"', () => {
  const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay(), missing: ['water_temperature', 'salinity', 'waves:gisp-bay'], updatedAt })
  assert.equal(r.verdict, 'go')
})

test('nothing flagged -> "go", with reasons saying what was checked', () => {
  const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay(), updatedAt })
  assert.equal(r.verdict, 'go')
  assert.deepEqual(signals(r).sort(), ['heat', 'nws_alerts', 'waves', 'wind'])
  assert.ok(r.reasons.every((x) => ['none', 'low'].includes(x.level)))
  assert.ok(r.reasons.every((x) => x.updatedAt === sent))
  assertContractShape(r)
})

test('forecast thresholds: heat index >= 103, wind > 20 mph, high waves -> "caution"', () => {
  for (const [over, signal] of [[{ feelsLikeF: 103 }, 'heat'], [{ windMph: 21 }, 'wind'], [{ waveFt: 5 }, 'waves']]) {
    const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay(over), updatedAt })
    assert.equal(r.verdict, 'caution', signal)
    assert.equal(r.reasons[0].signal, signal)
    assert.equal(r.reasons[0].level, 'moderate')
  }
  // Exactly 20 mph is not "> 20".
  assert.equal(safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ windMph: 20 }), updatedAt }).verdict, 'go')
})

// --- Edge cases and realistic days ----------------------------------------------------------

const onlyAt = (types, alerts) => ({
  date: '2026-10-24', rip: { level: 'low' }, missing: [],
  spots: Object.fromEntries(spots.map((s) => [s.id, types.includes(s.type) ? alerts.flatMap((a) => mapAlert(a, s.type) ?? []) : []])),
})

test('two overlapping advisories of the same kind name only the spots they cover', () => {
  // NWS often has two Small Craft Advisories out at once (now, and a later period), Gulf zone only.
  const r = safetyVerdict({
    alerts: onlyAt(['surf', 'pier'], [
      { ...alert('Small Craft Advisory', 'SCA until 10 AM'), id: 'sca-1' },
      { ...alert('Small Craft Advisory', 'SCA from 4 PM'), id: 'sca-2' },
    ]),
    weather: weatherDay(), updatedAt,
  })
  const sca = r.reasons.filter((x) => x.signal === 'small_craft_advisory')
  assert.equal(sca.length, 1, 'one reason')
  assert.match(sca[0].text, /^Beach side and Pier: /, 'does not claim the bay side too')
})

test('hurricane day: "no" first, even with heat and missing data piled on', () => {
  const r = safetyVerdict({
    alerts: nwsDay([alert('Hurricane Warning', 'Hurricane Warning in effect')], { rip: null, missing: ['rip_current'] }),
    weather: weatherDay({ feelsLikeF: 108, windMph: 45, waveFt: 9 }), updatedAt,
  })
  assert.equal(r.verdict, 'no')
  assert.equal(r.reasons[0].signal, 'tropical')
  assert.match(r.reasons[0].text, /Do not go/)
  const rank = { high: 2, moderate: 1, unknown: 1, low: 0, none: 0 }
  const ranks = r.reasons.map((x) => rank[x.level])
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a), 'worst first')
  assertContractShape(r)
})

test('summer afternoon: heat index 106 -> caution with plain-language advice', () => {
  const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ feelsLikeF: 106 }), updatedAt })
  assert.equal(r.verdict, 'caution')
  assert.match(r.reasons[0].text, /106°F/)
  assert.match(r.reasons[0].text, /water/)
})

test('numbers shown never contradict the verdict near a threshold', () => {
  // 20.3 mph is over 20: the text must not say "20 mph".
  const wind = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ windMph: 20.3 }), updatedAt })
  assert.equal(wind.verdict, 'caution')
  assert.doesNotMatch(wind.reasons[0].text, /\b20 mph/)
  // 102.6°F would display as 103°F, which is the heat threshold: never "103°F. No heat danger."
  const heat = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ feelsLikeF: 102.6 }), updatedAt })
  const h = heat.reasons.find((x) => x.signal === 'heat')
  assert.ok(!(/103°F/.test(h.text) && h.level === 'none'), h.text)
  // 4.04 ft waves are over 4 ft: don't print "4 ft" next to a high-waves caution.
  const waves = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ waveFt: 4.04 }), updatedAt })
  const w = waves.reasons.find((x) => x.signal === 'waves')
  assert.equal(w.level, 'moderate')
  assert.doesNotMatch(w.text, /up to 4 ft/)
})

test('bay waves are ignored for safety (sheltered), Gulf waves are not', () => {
  const day = weatherDay()
  day.spots['gisp-bay'] = [{ ...day.spots['gisp-bay'][0], waveFt: 7 }]
  assert.equal(safetyVerdict({ alerts: nwsDay(), weather: day, updatedAt }).verdict, 'go')
  day.spots['galveston-pier'] = [{ ...day.spots['galveston-pier'][0], waveFt: 6 }]
  const r = safetyVerdict({ alerts: nwsDay(), weather: day, updatedAt })
  assert.equal(r.verdict, 'caution')
  assert.match(r.reasons[0].text, /^Pier: /)
})

test('null/NaN forecast values do not leak into the text', () => {
  const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({ feelsLikeF: null, windMph: Number.NaN }), updatedAt })
  for (const x of r.reasons) assert.doesNotMatch(x.text, /NaN|null|undefined|Infinity/)
})

test('weather missing for one spot names that spot; for every spot it does not', () => {
  const one = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({}, { missing: ['weather:gisp-beach'] }), updatedAt })
  assert.match(one.reasons.find((x) => x.signal === 'weather').text, /^Beach side: /)
  const all = safetyVerdict({ alerts: nwsDay(), weather: weatherDay({}, { missing: ['weather:gisp-beach', 'weather'] }), updatedAt })
  const w = all.reasons.filter((x) => x.signal === 'weather')
  assert.equal(w.length, 1)
  assert.doesNotMatch(w[0].text, /^Beach side/)
})

test('"go" reasons never use the word safe (AGENTS.md: "Go: no hazards flagged")', () => {
  const r = safetyVerdict({ alerts: nwsDay(), weather: weatherDay(), updatedAt })
  assert.equal(r.verdict, 'go')
  for (const x of r.reasons) assert.doesNotMatch(x.text, /\bsafe\b/i)
})
