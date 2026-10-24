# Integration notes (backend → frontend lead)

Checked on 2026-10-24 against `main` at `e3d2580`, with the live `/api/plan`
(`VITE_USE_MOCK=false`), for Sat Oct 24 + Sun Oct 25 plus edge-case dates. Every field the
pages read exists in the live response with the expected type. The items below are about
behavior on edge cases. Tick a box when it's done.

Live values the frontend should expect: `reason.level` is one of `high`, `moderate`,
`unknown` (missing data), `low`, `none`, `info`. `reasons` come worst first. `draw` can be
`null` if the species step fails. `missing` always has `"salinity"` (Pier 21 has no
salinity sensor and the score doesn't use it), so ignore that item. Dates more than about 16
days out, and past dates, have no weather forecast: verdict `caution` and `windows: []`.

## Build blocker
- [ ] **`npm run build` fails on `main`.** `frontend/src/pages/Check.jsx:5` imports
  `DemoBadge` from `../components/Status`, and line 29 renders it, but
  `frontend/src/components/Status.jsx` no longer exports it (it was removed in the UI
  updates). Either add `DemoBadge` back to `Status.jsx` or drop it from `Check.jsx`.
  *Temporary local fix (not committed):* the old `DemoBadge` export was pasted back at
  the end of `Status.jsx` on the backend laptop so integration could continue.

## Must fix before the demo
- [ ] **Cached demo mode can't be reached.** `frontend/src/services/usePlan.js:16` never
  passes `snapshot`, so `?snapshot=demo` does nothing. Read
  `params.get('snapshot') === 'demo'` and pass `{ snapshot: true }` (all `Link`s already
  keep `search`). The demo days are 2026-10-31 and 2026-11-01, so use
  `/check?date=2026-10-31&snapshot=demo` (any other date falls back to `days[0]` at
  `usePlan.js:24`).
- [ ] **Missing safety data shows a green dot.** `frontend/src/pages/Check.jsx:36` renders
  `level-${reason.level}`, and the backend sends `level: "unknown"` for missing data, but
  `frontend/src/index.css:128-131` has no `.level-unknown`, so it falls back to the green
  default. Add `.condition-dot.level-unknown` (amber, same as moderate).
- [ ] **Duplicate React keys on Check.** `frontend/src/pages/Check.jsx:35` uses
  `key={reason.signal}`. A Rip Current Statement day sends two `rip_current` reasons (beach
  side "no", pier "caution"). Use `` key={`${reason.signal}-${index}`} ``.
- [ ] **Plan shows a 4.5-star outlook on a "no" day.** `frontend/src/pages/Check.jsx:40`
  always links to Plan, and `frontend/src/pages/Plan.jsx:34` has no safety reminder. When
  `day.safety.verdict !== 'go'`, show a banner on Plan with `day.safety.reasons[0].text`.
- [ ] **No empty state for `windows: []`.** `frontend/src/pages/Plan.jsx:34-42` shows
  "0.0/5", zero stars and "We found 0 promising times". Add a plain message, e.g. "We
  can't score this day yet. The forecast only goes about 2 weeks out." Also set `max` on
  the date input at `frontend/src/pages/Start.jsx:42` to about 14 days out.
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
- [ ] **"NEEDS CHECK" can show raw text.** `frontend/src/components/SpeciesCard.jsx:49`
  shows `species.eat.note` without `label()` when `eat.ok` is true or false.
  `frontend/src/pages/Deck.jsx:69` shows `clue.howTo` raw. Use the same
  `value !== 'NEEDS CHECK'` check. (Today every `eat.ok` is null and `howTo` is "", so
  nothing shows yet.)
- [ ] **License matching will give wrong answers once rules are filled in.**
  `frontend/src/components/LicenseQuiz.jsx:16`: `'nonresident'.includes('resident')` is
  true, the three answers are OR'd (any one match wins), and `age` is `'under17'` /
  `'adult'`, which won't appear in rule text. Today every rule is "NEEDS CHECK", so the safe
  fallback shows. Fix this before the content person fills `license.rules`. Matching on
  free text won't be reliable, so talk to the team about a structured condition.
- [ ] **Limits aren't shown.** `frontend/src/components/SpeciesCard.jsx:48,53` show only
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
