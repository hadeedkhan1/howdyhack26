// America/Chicago helpers. Never hard-code -5/-6: DST ends 2 AM Sunday Nov 1, 2026.
export const TZ = 'America/Chicago'

// Offset (ms) of Chicago from UTC at a given instant, e.g. -5h in CDT, -6h in CST.
function chicagoOffsetMs(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - (instant.getTime() - instant.getMilliseconds())
}

// UTC instant of local midnight starting the Chicago day "YYYY-MM-DD".
export function chicagoMidnight(date) {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  // Two passes settle the offset even when the guess lands across a DST change.
  let t = guess - chicagoOffsetMs(new Date(guess))
  t = guess - chicagoOffsetMs(new Date(t))
  return new Date(t)
}

// "YYYY-MM-DD" plus n days (calendar math, no time zone involved).
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// Chicago calendar date ("YYYY-MM-DD") of an instant.
export function chicagoDate(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(instant)
}

// Chicago wall-clock "HH:MM" of an instant.
export function chicagoHHMM(instant) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(instant)
}
