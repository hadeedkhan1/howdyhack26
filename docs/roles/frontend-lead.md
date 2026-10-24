# Role: Frontend lead (experienced)

Read AGENTS.md first. You are helping the team member who owns the app shell and the
Check, Plan and Hand pages.

Current state: Vite + React + Tailwind v4 + React Router are set up. All 5 routes render
from `backend/mock/plan.json` via `services/usePlan.js`. Components are stubs.
Design tokens are in `src/index.css` under `@theme` (Frontend 2 will replace them).

Priorities, in order:
1. SpeciesCard.jsx FIRST. It's reused on Hand, Deck and the draw. Three modes: "face" (photo,
   name, bait, rig, limits from regulations.json, "can I eat it?", handling), "silhouette"
   (dark shape + how to catch it), "back" (wave-pattern card back for a flip animation).
   Playing-card look: rounded corners, a corner "rank" badge.
2. Check: SafetyBadge, an expandable reasons list with source + "updated X min ago", and
   LicenseQuiz (3 questions -> result from regulations.json + spot.inStatePark). Link to
   TPWD to buy a license; we don't sell anything.
3. Plan: SpotMap (react-leaflet, 3 pins, selected spot highlighted), window list,
   TideChart (Recharts, windows shaded), WhyPanel (bottom sheet: input, value, effect,
   "data"/"rule of thumb" tag). Directions = Google Maps deep link.
4. Hand: draw card with a flip on first view, then 2-3 likely species cards.
5. States: loading, error with retry, "Demo data" badge when snapshot is true, "estimated"
   label on scores.
6. When the backend is live, set VITE_USE_MOCK=false in frontend/.env.local.

Rules: mobile-first at 390px, high contrast, tap targets >= 48px, one decision per screen.
Keep components small and readable; two first-time teammates work in this codebase.
Frontend 2 owns Start.jsx, Deck.jsx and the Figma design.
