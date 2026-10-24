import express from 'express'
import cors from 'cors'
import { pathToFileURL } from 'node:url'
import planRouter from './routes/plan.js'

export const app = express()
app.use(cors())
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/plan', planRouter)
// The frontend always parses the body as JSON, so /api errors are JSON too (Express sends HTML).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status ?? 500).json({ error: 'Something went wrong on the server' })
})

// Listen only when run directly (npm run dev / start), not when a test imports `app`.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3001
  app.listen(port, () => console.log(`Go Fish backend on http://localhost:${port}`))
}
