# Go Fish 🎣

Beginner-friendly Galveston fishing trip planner. Howdy Hack 2026.

## Run it (everyone)
Requires Node 20+ (22 recommended).
```
npm run setup     # once, installs root + frontend + backend
npm run dev       # starts backend on :3001 and frontend on :5173
```
Open http://localhost:5173. The app uses mock data until the backend is ready.
To use the real backend: create `frontend/.env.local` containing `VITE_USE_MOCK=false`.

## Using your AI assistant
- **AGENTS.md is the project brief and source of truth.** Claude Code (via CLAUDE.md),
  Cursor, GitHub Copilot and Codex pick it up automatically.
- Using a chat assistant (ChatGPT, Gemini, Claude.ai)? Paste AGENTS.md, then your file from
  `docs/roles/`.
- Your role prompt: `docs/roles/backend.md`, `frontend-lead.md`, `frontend-design.md`,
  or `content-pitch.md`. Figma prompt: `docs/figma-prompt.md`.

## Who owns what
| Folder | Owner |
|---|---|
| `backend/` | Backend |
| `frontend/src/pages/{Check,Plan,Hand}.jsx`, `components/` | Frontend lead |
| `frontend/src/pages/{Start,Deck}.jsx`, `src/index.css` tokens | Frontend 2 |
| `frontend/src/data/*.json`, `docs/` pitch material | Content |

## Git
Work on your own branch, merge to `main` at least every 2 hours, and keep `main` runnable.
```
git checkout -b <your-branch>
git add -A && git commit -m "what you did"
git checkout main && git pull && git merge <your-branch> && git push
```
