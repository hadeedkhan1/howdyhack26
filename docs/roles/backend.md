# Role: Backend and data (experienced)

Read AGENTS.md first. You are helping the team member who owns `backend/`.

Current state: Express server runs on :3001. `GET /api/plan` builds the live plan from NOAA,
Open-Meteo and NWS (routes/plan.js, all priorities below done); `?snapshot=demo` serves
`backend/snapshots/demo.json`. The frontend still uses `backend/mock/plan.json` while `USE_MOCK` is on.
`npm test` in backend/ runs the full suite offline (fake fetch, throwaway cache dir).

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
  Range: forecast 16 days, marine waves only ~10 days. Pressure is hPa (no inHg option). `updatedAt` is when the
  oldest data used was fetched (stale cache shows its real age, not "now"). Try it: `node scripts/try-weather.js [date] [days] [spotId]`.
- cache.js (stale cap): a failed fetch serves cache only if under 6h old (`MAX_STALE_MS`), else rethrows so the
  service reports the item in `missing`. Tide predictions (24h TTL) don't survive a long NOAA outage, so record
  snapshots/demo.json while APIs are up. Fetches time out after 8s (`TIMEOUT_MS`; undici's default is 5 min),
  writes are atomic (temp + rename) and a corrupt cache file is refetched instead of failing for the whole TTL.
  `GOFISH_CACHE_DIR` overrides backend/cache/ (tests use it).
- nws.js (done): `getAlerts({ start, days, spots? })` -> per-day `spots[spotId]` reasons (each with `verdict` "no"|"caution"), `rip`, `missing`; never throws.
  HGX has no Surf Zone Forecast (re-checked live Oct 24: /products/types/SRF/locations has no HGX): rip risk comes only from Rip Current / Beach Hazards statements, else "rip_current" is in `missing`, and days starting >48h out get "nws_alerts". Try: `node scripts/try-nws.js`.
  Consequence for the demo and pitch: on a quiet day live data is "caution" (unknown rip risk), never "go"; only the hand-made demo.json shows "go".
  Both statements are ignored for the bay side (no rip currents there). Alerts missing `affectedZones` don't crash it.
- scoring.js (done): pure. `scoreSpotDay({ spot, date, tide, waterTempF, weatherHours })` -> hourly `{ t, score, why, daylight }`; `planWindows(spots, bySpot)` -> contract `windows`
  (max 3, each at most 3 hours on the hour, non-overlapping, score/why = peak hour). Daylight = the whole hour falls between 1h before sunrise and 1h after sunset, so no window ends after dark.
  Missing inputs score 0, so routes/plan.js must list them in `missing`; water temp uses a generic 60–82°F rule until species.json ranges are filled. "NEEDS CHECK"/null coordinates, ranges or spotTypes are treated as unknown (sun times fall back to Galveston), never a crash.
  Known gap vs. the brief's "7:00 bay side, then 17:00 surf": all spots share one coordinate and the same tide/water/pressure data, and only the beach/pier lose points to onshore wind, so on the usual SE breeze the bay side wins every window (live Oct 25–Nov 1: bay only). Surf/pier only show on calm or offshore days until spots.json coordinates and species spotTypes differ per spot.
- safety.js (done): pure. `safetyVerdict({ alerts, weather, missing, updatedAt: { nws, weather } })` (one day each from getAlerts/getWeather) -> contract `{ verdict, reasons }`, worst first; one verdict per day = worst across spots, reason text prefixed "Beach side: " etc. when spot-specific.
  routes/plan.js must pass the day's full `missing`: nws_alerts/rip_current/weather/waves (or an absent input) force at least caution, other items are ignored. Thresholds: feels-like >= 103°F, wind > 20 mph, waves > 4 ft (`HIGH_WAVES_FT`, rule of thumb),
  checked on the number shown, rounded up (20.3 mph shows "21 mph" and is caution; text never contradicts the verdict). One reason per alert type, prefixed only with the spots it really covers.
- species.js (done): pure. `likelySpecies({ date, waterTempF, windows })` -> contract `{ likelySpecies, draw }`, best first, draw = first; ties ordered by a hash of date+id (same draw all day, varies by day).
  In range + spotType matches a window's spot = high, ≤3°F outside = low, unknown range/spotTypes/water temp = medium, wrong spot or far out = left out; never empty. Pass `waterTempF: null` if the reading is stale.
- routes/plan.js (done): `buildPlan({ start, days }, fetchers?)` runs tides/weather/nws in parallel and assembles the contract; a failing service only empties what it feeds and lands in each day's `missing` (tests swap in fake fetchers, offline).
  Bad start/days -> 400, including impossible dates like 2026-02-30 (Date.parse rolls them to March) and years < 1000; `?snapshot=demo` ignores the other params. A service result without a `days` list counts as failed.
  `node scripts/save-snapshot.js [date] [days=2]` writes snapshots/demo.json (snapshot: true). Live differs from the mock: "unknown"-level reasons with `updatedAt: null`, 24-point tide days (25 on Nov 1; the mock also lists the next midnight), hour-aligned windows, all 7 species at "medium" while species.json is empty.
  TODO before the demo: snapshots/demo.json is still a copy of the hand-made mock (generatedAt 2026-10-30, cites an "NWS Surf Zone Forecast" that HGX doesn't issue). Re-record it with save-snapshot.js once spots/species are filled in.
- Tests: `npm test` (115, offline, ~1s). contract.test.js checks spots/species/regulations IDs and schemas plus mock, demo.json and live output against the API contract (verdict agrees with reasons, score = base + effects, sorted species, no overlapping windows).
  services.test.js runs tides/weather/nws against a fake network (DST bucketing, NOAA/Open-Meteo error bodies, stale data, marine zones). The mock's day 2 `likelySpecies` was re-sorted best first to match live.
- Integration (Oct 24, main e3d2580): live /api/plan checked against every page/component; frontend items in docs/integration-notes.md. Backend fixes: past days get "nws_alerts"/"rip_current" in `missing` (active alerts say nothing about them, so caution), mock + demo.json no longer list the next midnight's tide point (24/25 points like live), unknown /api paths and server errors are JSON (server.js exports `app`). 118 tests.
