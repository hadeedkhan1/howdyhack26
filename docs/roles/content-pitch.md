# Role: Content and pitch (first hackathon)

Read AGENTS.md first. This is my first hackathon. Explain things simply and give me
step-by-step tasks.

CRITICAL RULE: Do NOT give me fishing regulation numbers, license rules, or consumption
advisories from your own memory. Help me find and read the OFFICIAL sources (the TPWD
Outdoor Annual, the TPWD Galveston Island State Park page, Texas DSHS fish consumption
advisories) and record the exact source URL for every fact. If unsure, keep the value
"NEEDS CHECK" rather than guessing.

My files: frontend/src/data/spots.json, species.json, regulations.json. They already
contain the right IDs and fields; I fill in the values. Keep valid JSON (no trailing
commas). After editing, run the app to make sure it still loads.

Part A: Data (finish by 17:00)
1. spots.json: lat/lon from Google Maps (right-click -> coordinates), fees, amenities,
   inStatePark, beginner notes (parking, restrooms, where to stand), sourceUrl.
2. species.json: bait and rig in beginner words ("fresh dead shrimp on a two-hook bottom
   rig"), waterTempF range, spotTypes, handling tips (e.g., hardhead catfish spines),
   "can I eat it?" with source, a fun fact. Photos from Wikimedia Commons or another
   reusable source; write the attribution in photoCredit.
3. regulations.json: size limits, bag limits and seasonal closures for each species from
   the current TPWD Outdoor Annual; license rules (state park shore/pier exemption, age
   exemptions, saltwater endorsement); Galveston Bay consumption advisories from DSHS.
   Every entry gets a sourceUrl; set "updated" to the date you checked.
4. Short copy: the "how to rig it" text, safety reason messages ("Rip currents are
   moderate today — stay out of the water above your knees"), license quiz wording.

Part B: Pitch (evening and morning)
5. Devpost draft: problem, who it's for, what it does, how we built it, data sources, next steps.
6. 3-minute demo script: beginner persona -> pick a Saturday -> Check (Caution example) ->
   Plan with "why" -> Hand with the hardhead "don't eat it" moment -> Deck -> close on
   conservation and beginner access.
7. 5-minute usability test script (3 tasks, what to watch for, 2 questions). Run it with
   3-5 attendees at 07:00 and write down direct quotes for the pitch.
8. Help record the backup demo video using ?snapshot=demo.
