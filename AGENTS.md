# Go Fish — Project Brief (source of truth)

Every AI assistant on this team reads this file. Claude Code reads it through CLAUDE.md;
Cursor, GitHub Copilot, Codex and other agents read AGENTS.md directly. If you use a chat
assistant (ChatGPT, Gemini, Claude.ai), paste this whole file first, then your role file
from docs/roles/.

Assistant rules: stay consistent with this brief (same IDs, field names, file names,
decisions). If something here seems wrong, say so, but do not silently change it.
Contract changes are announced to the whole team and made in this file first.

## Context
- Howdy Hack 2026 (Texas A&M), 24 hours, deadline 12:00 CDT Sunday Oct 25, 2026.
- Team of 4. Target tracks: Beach track and UI/UX.

## One-liner
"Your first Gulf fishing trip, planned. When to go, where to stand, what to buy,
what you'll catch, and whether it's safe."

## Target user
A beginner (e.g., a college student) with a cheap rod, no boat, no license yet, planning a
Galveston trip. Most fishing apps target experts; we target beginners. Plain language
everywhere. No jargon without a one-line explanation.

## Scope
- Region: Galveston Island, Texas only. Shore and pier fishing only (no boats).
- 3 spots, 7 species, all hand-curated in JSON.
- Visual theme: the "Go Fish" card game. Species are playing cards. Today's plan is
  "your hand." Today's target species is "the draw." The collection is "your deck."

## User flow (5 screens, in order)
1. Start (/start): "When's your trip?" Pick a date.
2. Check (/check): "Can I fish today?" Safety verdict (Go / Caution / No) with reasons,
   plus a 3-question license check (Texas resident? Age? Inside a state park?).
3. Plan (/plan): Map of 3 spots, ranked time windows by spot ("7:00 bay side, then 17:00
   surf"), tide curve, and a "why" panel explaining the score. Directions via a Google/
   Apple Maps deep link (no in-app navigation).
4. Hand (/hand): Today's draw (one target species) plus 2-3 likely species as cards. Each
   card: bait, how to rig it, limits, "can I eat it?", handling tip.
5. Deck (/deck): All 7 species cards. Uncollected cards are silhouettes that explain how to
   catch them. Log a catch: take a photo, pick "which one looks like yours?" from the 7,
   card is collected. Catch-and-release photos count. 4 catches of one species = "four of
   a kind" badge.

The selected date travels in the URL as ?date=YYYY-MM-DD.

## Priority
- MUST: Start, Check (safety + license), Plan (score + spot×hour windows + map), Hand
  (species cards), cached demo mode.
- SHOULD: Deck (collection, silhouettes, photo logging, today's draw animation).
- IF TIME: "Share this trip" link/image to send to a friend.

## Decided — do not suggest or add
- No user accounts, auth, Supabase, or any database. Deck data is on-device (IndexedDB via idb-keyval).
- No community feed, profiles, comments, or messaging.
- No AI/ML fish identification. Users pick the species manually.
- No turn-by-turn routing or routing APIs. Directions = map deep link.
- No FishPulse, GBIF, FishBase, or iNaturalist.
- No freshwater, no other regions, no boats.
- Do not add new npm packages without telling the team.

## Tech stack
- Frontend: React + Vite, Tailwind CSS v4, React Router, Leaflet + react-leaflet,
  Recharts, idb-keyval.
- Backend: Node.js + Express (ESM). One main endpoint. File-based cache.
- Data: Open-Meteo (weather, wind, pressure, marine waves), NOAA CO-OPS (tide
  predictions, water temperature; Galveston Pier 21 = station 8771450), National Weather
  Service api.weather.gov (alerts, surf zone forecast / rip current risk), hand-curated
  JSON for spots, species, regulations, advisories.

## Repo layout
```
go-fish/
  AGENTS.md          this brief (source of truth)
  CLAUDE.md          imports AGENTS.md for Claude Code
  docs/roles/        one prompt per team member
  docs/figma-prompt.md
  frontend/src/
    pages/           Start, Check, Plan, Hand, Deck
    components/      SpeciesCard, SafetyBadge, TideChart, SpotMap, WhyPanel,
                     LicenseQuiz, BottomNav, Screen, Status
    services/        api.js (USE_MOCK), usePlan.js, content.js
    data/            species.json, spots.json, regulations.json  (shared with backend)
  backend/
    server.js, routes/plan.js
    services/        weather.js, tides.js, nws.js, scoring.js, safety.js, cache.js, data.js
    mock/plan.json   THE mock. Frontend imports this same file in mock mode.
    snapshots/       demo.json served by ?snapshot=demo
```

## Shared IDs (use exactly these)
- Spots: `gisp-beach` (Galveston Island State Park, beach side, type "surf"),
  `gisp-bay` (Galveston Island State Park, bay side, type "bay"),
  `galveston-pier` (Galveston Fishing Pier, type "pier").
- Species: `croaker`, `whiting`, `sheepshead`, `black-drum`, `red-drum`,
  `speckled-trout`, `hardhead-catfish`.

## Data schemas
spots.json:
```
[{ "id", "name", "type": "surf"|"bay"|"pier", "lat", "lon", "inStatePark": bool,
   "windExposure": "high"|"low", "noaaStation", "fee", "amenities": [string],
   "beginnerNotes", "sourceUrl" }]
```
species.json:
```
[{ "id", "name", "aka": [string], "photo", "photoCredit", "silhouette",
   "spotTypes": [string], "waterTempF": [min, max], "bait": [string], "rig", "howTo",
   "handling", "eat": { "ok": bool, "note", "sourceUrl" }, "funFact" }]
```
regulations.json:
```
{ "updated": "YYYY-MM-DD", "sourceUrl",
  "species": { "<speciesId>": { "minIn", "maxIn", "dailyBag", "notes", "sourceUrl" } },
  "license": { "rules": [ { "condition", "result", "sourceUrl" } ] },
  "advisories": [ { "area", "speciesIds": [], "text", "sourceUrl", "updated" } ] }
```
Any value not yet verified from an official source is the string "NEEDS CHECK".

## API contract
`GET /api/plan?start=YYYY-MM-DD&days=1|2[&snapshot=demo]`
```
{
  "generatedAt": ISO, "snapshot": bool, "scoreBase": 50,
  "days": [{
    "date": "YYYY-MM-DD",
    "safety": { "verdict": "go"|"caution"|"no",
      "reasons": [{ "signal", "level", "text", "source", "updatedAt" }] },
    "tide": [{ "t": ISO (UTC), "ft": number }],
    "windows": [{ "spotId", "start": "HH:MM", "end": "HH:MM" (local Central time),
      "score": 0-100,
      "why": [{ "input", "value", "effect": number, "label": "data"|"rule of thumb" }] }],
    "likelySpecies": [{ "id", "likelihood": "high"|"medium"|"low" }],
    "draw": "<speciesId>",
    "missing": [string]
  }]
}
```
- score = scoreBase + sum(why[].effect), clamped to 0-100.
- The license result is computed on the frontend (quiz answers + spot.inStatePark +
  regulations.json). It is NOT in the API.
- Time zone: always convert with America/Chicago. DST ends 2 AM Sunday Nov 1, 2026 (that
  day has 25 hours). Never add a fixed -5 or -6 hour offset.

## Scoring (per spot, per hour)
Tide movement 35% (moving water > slack), water temp within species range 25%, wind 15%
(penalize strong onshore wind on "high" exposure spots), dawn/dusk 15%, pressure trend
10%. A window = consecutive hours scoring >= 60. The plan picks the best non-overlapping
windows across spots. Label each input as "data" or "rule of thumb".

## Safety verdict
- "no": active NWS warning (thunderstorm, tropical, coastal flood), or high rip current
  risk (surf spots).
- "caution": moderate rip risk, small craft advisory, high waves, heat index >= 103°F,
  wind > 20 mph, or ANY safety data missing or stale.
- "go": none of the above. Display as "Go: no hazards flagged," never "safe."
- Rip current risk: NWS Houston/Galveston (HGX) publishes no surf zone forecast. A Rip
  Current Statement = high risk, a Beach Hazards Statement = moderate risk. If the NWS
  alerts check succeeded and neither is active, that is NOT missing data: add an
  info-level rip_current reason ("No rip current statement is active. Stay in shallow
  water on the beach side.") that does not force caution. If the alerts check failed
  (or is stale, or the day is past the ~48h alert horizon), rip risk is missing ->
  caution.

## Principles
- Missing data never counts as safe. Missing data means "caution."
- Every number shown has a source and an "updated" time.
- Scores are labeled as estimates.
- Regulations and advisories come from official sources (TPWD, Texas DSHS), never from
  AI memory.
- Beginner-first: one decision per screen, simple verdict first, details on tap.
- Mobile-first (390px wide), high contrast for sunlight, tap targets >= 48px.

## Team roles
- Backend and data (experienced): `backend/`. API, scoring, safety, caching, snapshots.
- Frontend lead (experienced): app shell, SpeciesCard, Check/Plan/Hand pages, integration.
- Frontend 2 / design (first hackathon): Figma layout, Start and Deck pages, photo logging.
- Content and pitch (first hackathon): `frontend/src/data/*.json`, copy, user tests,
  Devpost, demo.

## Git workflow
- Work on your own branch (e.g. `backend`, `frontend`, `deck`, `content`).
- Merge to `main` at least every 2 hours. `main` must always run with `npm run dev`.
- Small commits with clear messages. Pull `main` before you start each session.

## Timeline (CDT)
- 15:00: repo cloned and running on all 4 laptops.
- 19:00: first integration (real data end-to-end).
- 06:00: feature freeze.
- 07:00: usability tests with 3-5 attendees.
- 11:30: submit on Devpost. 12:00: hard deadline.
