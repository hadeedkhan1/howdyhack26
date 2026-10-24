# Figma AI prompt (paste everything below the line)

---

Design a mobile app (iPhone, 390×844) called "Go Fish": a beginner-friendly saltwater
fishing trip planner for Galveston, Texas. The visual theme is the "Go Fish" card game:
fish species are shown as illustrated playing cards. It should feel friendly, calm, and
coastal, not like a technical pro-angler tool. It is used outdoors in bright sun, so use
high contrast, large text, and big tap targets (at least 48px). Avoid dense dashboards.
Each screen has one main question or decision.

Style: rounded playing-card components with a small corner "rank" badge and a subtle
wave-pattern card back. Palette: deep navy, warm sand, sea-foam green, and white, with
coral/amber reserved for warnings. A friendly rounded sans-serif for headings and a clean
sans-serif for body text. Bottom navigation with 3 tabs: Plan, Hand, Deck.

Screens:
1. Start: a single question, "When's your Galveston trip?", with large date chips (This
   Saturday / This Sunday / Pick a date) and a "Plan my trip" button.
2. Check, "Can I fish today?": one large verdict badge (Go / Caution / No) with a
   one-sentence reason, an expandable list of reasons with small "updated 12 min ago"
   labels, and a 3-question license check below it (resident? age? inside a state park?)
   with a clear result ("No license needed here").
3. Plan: a map in the top half with 3 location pins. Below it, a timeline of recommended
   time windows ("7:00–9:30 · Bay side · score 82"), a smooth tide curve chart with those
   windows shaded, a "Get directions" button, and a "Why?" link that opens a bottom sheet
   listing factors (tide, water temp, wind, time of day) with small up/down effect indicators.
4. Hand: a large featured "Today's draw" card at the top (one fish species card, face up),
   then 2–3 smaller species cards. Tapping a card opens a detail view: fish photo, bait, a
   simple rig illustration, size/bag limits, "Can I eat it?" with a short note, and a
   handling tip.
5. Deck: a 2-column grid of 7 species cards; collected cards are face up in color,
   uncollected ones are dark silhouettes with "How to catch me" text. Progress text "3 of 7
   collected", and a small "Four of a kind" badge on one card. A floating "Log a catch" button.
6. Log a catch: a camera photo preview, then "Which one looks like yours?" with a grid of 7
   fish photos to pick from, a "Released it" toggle, and a "Card collected!" celebration state.

Also show 3 states for the verdict badge (Go / Caution / No), a loading skeleton for the
Plan screen, and a small "Demo data" badge style.
