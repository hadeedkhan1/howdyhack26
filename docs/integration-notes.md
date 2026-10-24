# Integration notes (backend → frontend lead)

First checked on 2026-10-24 against `main` at `e3d2580`. Re-checked against `main` at
`9594576` (includes the frontend "fixing" commit `d548777`), with the live `/api/plan`
(`VITE_USE_MOCK=false`), for Sat Oct 24 + Sun Oct 25 plus edge-case dates. Every field the
pages read exists in the live response with the expected type. `npm test` (backend) and
`npm run build` (frontend) both pass. The items below are about behavior on edge cases and
the brief. Line numbers are for `9594576`. Tick a box when it's done.

Live values the frontend should expect: `reason.level` is one of `high`, `moderate`,
`unknown` (missing data), `low`, `none`, `info`. `reasons` come worst first. `draw` can be
`null` if the species step fails. `missing` always has `"salinity"` (Pier 21 has no
salinity sensor and the score doesn't use it), so ignore that item. Dates more than about 16
days out, and past dates, have no weather forecast: verdict `caution` and `windows: []`.

## Resolved in d548777
- [x] Build blocker: `Check.jsx` no longer imports `DemoBadge`, so the build passes.
  `frontend/src/components/Status.jsx:23` still exports `DemoBadge` (committed as a stopgap
  in `46c530d`), but nothing uses it. Delete it, or reuse it for demo mode (see below).
- [x] Old license matching bug (`'nonresident'.includes('resident')`): that code is gone.
  The new version raises its own concern, below.

## Against the brief (please look first)
- [ ] **License answers are hard-coded and no longer come from `regulations.json`.**
  `frontend/src/components/LicenseQuiz.jsx:11-25` writes the rules into the component
  (under 17 exempt, state park exempt, born before 1931). The brief says the license
  result comes from the quiz answers + `spot.inStatePark` + `regulations.json`, and that
  regulations come from TPWD, "never from AI memory". `regulations.license.rules` is now
  unused. The "Official rules · Updated …" source line was also removed, so no source or
  date is shown. Suggested fix: move these rules into `regulations.json` `license.rules`
  with a TPWD `sourceUrl` each, have the content person verify the wording, and show the
  source and `updated` again. Also, the resident answer only changes the small detail
  text, never the result.
- [ ] **The outlook rating no longer says it's an estimate.**
  `frontend/src/pages/Plan.jsx:35-38` shows stars, "4.5/5" and "90/100" under just
  "Fishing outlook". The "Forecast estimate · not visitor reviews" line is gone (only the
  screen-reader `aria-label` on line 34 still says so), and so is "estimated" under each
  window score (line 53). The brief requires "Scores are labeled as estimates." Five stars
  out of five also reads like visitor reviews. The removed Plan and Hand footnotes and
  the WhyPanel disclaimer were nice to have. The "ESTIMATES" tag on line 47 and "your
  estimate" in `WhyPanel.jsx:8` are still there. At minimum, put "Estimate" back next to
  the rating.

## Must fix before the demo
- [ ] **Cached demo mode can't be reached.** `frontend/src/services/usePlan.js:16` never
  passes `snapshot`, so `?snapshot=demo` does nothing. Read
  `params.get('snapshot') === 'demo'` and pass `{ snapshot: true }` (all `Link`s already
  keep `search`). The demo days are 2026-10-31 and 2026-11-01, and since `d548777`
  (`usePlan.js:24-27`) any other date is an error. So the demo URL must be
  `/check?date=2026-10-31&snapshot=demo`. Nothing marks snapshot data anymore, so show a
  small "Demo data" badge when `plan.snapshot` is true (that's what `DemoBadge` was for).
- [ ] **Missing safety data shows a green dot.** `frontend/src/pages/Check.jsx:35` renders
  `level-${reason.level}`, and the backend sends `level: "unknown"` for missing data, but
  `frontend/src/index.css:141-144` has no `.level-unknown`, so it falls back to the green
  default. Add `.condition-dot.level-unknown` (amber, same as moderate).
- [ ] **Duplicate React keys on Check.** `frontend/src/pages/Check.jsx:34` uses
  `key={reason.signal}`. A Rip Current Statement day sends two `rip_current` reasons (beach
  side "no", pier "caution"). Use `` key={`${reason.signal}-${index}`} ``.
- [ ] **Plan shows a 4.5-star outlook on a "no" day.** `frontend/src/pages/Check.jsx:39`
  always links to Plan, and `frontend/src/pages/Plan.jsx:34` has no safety reminder. When
  `day.safety.verdict !== 'go'`, show a banner on Plan with `day.safety.reasons[0].text`.
- [ ] **No empty state for `windows: []`.** `frontend/src/pages/Plan.jsx:34-42` shows
  "0.0/5", zero stars and "We found 0 promising times". Add a plain message, e.g. "We
  can't score this day yet. The forecast only goes about 2 weeks out." The new calendar
  in `frontend/src/pages/Start.jsx` blocks past days (line 80) but has no upper limit
  (line 75 pages forward forever). Disable days more than about 14 days out.
- [ ] **Non-JSON errors show "Unexpected end of JSON input".**
  `frontend/src/services/api.js:16` calls `res.json()` before checking `res.ok`. When
  the backend is down, the Vite proxy returns a 500 with no JSON body. Wrap it in
  try/catch and fall back to `Plan request failed (${res.status})`. (The backend now
  always sends JSON for `/api/*`, including 404s.)

## Should fix
- [ ] **Tide chart on Nov 1 (DST ends).** `frontend/src/components/TideChart.jsx:10`
  uses the local clock hour as x, so the 25-hour day has two points at x=1. Drop the
  second 1 AM point (or key x by elapsed hours). The mock and demo used to include the
  next midnight's point, which drew a line back across the chart. That's fixed on the
  backend side.
- [ ] **"NEEDS CHECK" can show raw text.** `frontend/src/components/SpeciesCard.jsx:46`
  shows `species.eat.note` without `label()` when `eat.ok` is true or false.
  `frontend/src/pages/Deck.jsx:72` shows `clue.howTo` raw. Use the same
  `value !== 'NEEDS CHECK'` check. (Today every `eat.ok` is null and `howTo` is "", so
  nothing shows yet.)
- [ ] **Limits aren't shown.** `frontend/src/components/SpeciesCard.jsx:45,49` show only
  `regulations.species[id].notes`. `minIn`, `maxIn` and `dailyBag` are never displayed
  (the brief says each card shows limits).
- [ ] **`day.missing` is never shown.** Plan should say what the estimate is missing
  (e.g. "water temperature"), skipping `salinity`. Missing safety items already appear on
  Check as `unknown` reasons.
- [ ] `frontend/src/pages/Hand.jsx:32`: if `likelySpecies` is empty, "Also in the cards"
  is an empty section. Add a line of text. `Hand.jsx:24`: `ErrorState` has no `onRetry`
  (Check and Plan pass `retry`).
- [ ] `frontend/src/components/WhyPanel.jsx:11` shows raw input keys (`waterTemp`,
  `light`). Map them to plain words: Tide, Water temp, Wind, Daylight, Air pressure.
- [ ] `frontend/src/components/TideChart.jsx:25`: "Updated" shows the first prediction's
  date, not an update time. Pass `plan.generatedAt` instead.

## For the content person
- [ ] Every species in `frontend/src/data/species.json` has `waterTempF: [null, null]`,
  `spotTypes: []` and `bait: []`. Until those are filled, the backend rates all 7 species
  "medium", Hand shows three "medium" cards, and the draw depends only on the date.
- [ ] Verify the license wording now in `LicenseQuiz.jsx:16-23` against TPWD and move it
  into `regulations.json` `license.rules` with `sourceUrl`s (see "Against the brief").
