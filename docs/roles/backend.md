# Role: Backend and data (experienced)

Read AGENTS.md first. You are helping the team member who owns `backend/`.

Current state: Express server runs on :3001. `GET /api/plan` serves `backend/mock/plan.json`;
`?snapshot=demo` serves `backend/snapshots/demo.json`. `services/cache.js` and
`services/data.js` work. Everything else in `services/` is a stub that throws.

Priorities, in order:
1. tides.js: NOAA CO-OPS datagetter for station 8771450: tide predictions (hourly + hilo)
   and water_temperature. Try salinity; if unavailable, add "salinity" to `missing`.
2. weather.js: Open-Meteo hourly forecast (temp, wind speed/direction, pressure, apparent
   temp) and the Open-Meteo marine API (wave height). Use timezone=America/Chicago.
3. nws.js: api.weather.gov active alerts per spot lat/lon, and the Houston/Galveston
   surf zone forecast for rip current risk. Send a User-Agent header. If rip parsing is
   flaky, report it in `missing` (which forces caution).
4. scoring.js: pure functions implementing SCORING. Return the `why` breakdown so that
   score = scoreBase + sum(effects). Tests with `node --test`: slack tide scores lower than
   moving tide; strong onshore wind penalizes gisp-beach but not gisp-bay.
5. safety.js: pure function implementing SAFETY VERDICT. Missing/stale input => caution.
6. likelySpecies + draw: species whose waterTempF range contains the water temp and whose
   spotTypes match a recommended window. Draw = highest likelihood, ties broken by date.
7. routes/plan.js: assemble the real response; fall back to partial data plus `missing`,
   never crash. Add a script to save the live response into snapshots/demo.json.

Rules: plain JavaScript (ESM), no database, no auth, no new services. Convert times with
America/Chicago (DST ends Nov 1, 2026). Read spots/species/regulations via services/data.js.
Never change the API contract shape without updating AGENTS.md and telling the team.

## Progress
- tides.js (done): `getTides({ start, days })` returns per-day `tide` [{t UTC, ft}] and `hilo`
  [{t, ft, type}] split on Chicago midnight (DST-safe helpers in services/time.js), plus
  `waterTemp`, `salinity`, `missing`; never throws. Water temp is the latest NOAA reading,
  not a forecast (>6h old -> "water_temperature" in missing); salinity isn't offered at
  8771450, so it is always null and in `missing`. routes/plan.js must copy `missing` into each day.
- weather.js (done): `getWeather({ start, days, spots? })` returns per-day `spots[spotId]` hourly
  [{t UTC, tempF, feelsLikeF, windMph, windFromDeg, pressureHpa, waveFt}] plus per-day `missing`
  ("weather"/"waves", or "waves:<spotId>" if only some spots lack it); never throws. Spots with
  null lat/lon use the Pier 21 coordinate (logged). Open-Meteo applies one fixed offset to the
  whole response (wrong after DST ends), so we fetch unixtime and bucket by Chicago day.
  Range: forecast 16 days, marine waves only ~10 days. Pressure is hPa (no inHg option).
  Try it: `node scripts/try-weather.js [date] [days] [spotId]`.
- cache.js (stale cap): `cachedJson` returns the same data as before, but a failed fetch serves cache only if
  under 6h old (`MAX_STALE_MS`), else rethrows so the service reports the item in `missing`. Tide predictions
  (24h TTL) no longer survive a long NOAA outage, so record snapshots/demo.json while APIs are up.
