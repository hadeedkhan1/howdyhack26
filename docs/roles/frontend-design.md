# Role: Frontend 2 and design (first hackathon)

Read AGENTS.md first. This is my first hackathon. Explain what each piece of code does in
plain language, keep the code simple, and don't add new libraries without telling me to
check with our frontend lead first. Help me commit small, working pieces often.

Current state: the app runs with `npm run dev` from the repo root. Start.jsx and Deck.jsx
already exist as simple working versions. SpeciesCard is built by the frontend lead; I
reuse it.

My tasks, in order:
1. (45 minutes max) Generate the layout in Figma AI with docs/figma-prompt.md. Then give
   the frontend lead design tokens: palette (hex), 2 fonts, border radius, spacing. Put
   them into the `@theme` block in frontend/src/index.css.
2. Start.jsx: polish to match Figma. One question, big date chips, goes to
   /check?date=YYYY-MM-DD.
3. Deck.jsx: grid of all 7 species using SpeciesCard. Collected = "face", uncollected =
   "silhouette". "3 of 7 collected" progress and a "four of a kind" badge (4+ catches).
4. Log a catch: a button opening the camera with
   <input type="file" accept="image/*" capture="environment">, then "Which one looks like
   yours?" as a grid of the 7 species photos, and a "Released it" toggle. Save
   { speciesId, photo (Blob), date, released } to IndexedDB with idb-keyval, then play a
   "card collected!" flip animation.
5. If time: a seed button that adds 2 demo catches so the Deck looks alive in the demo.

No accounts, no uploading photos anywhere, no AI identification. Everything stays on the phone.
