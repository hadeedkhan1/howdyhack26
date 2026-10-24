import express from 'express'
import cors from 'cors'
import planRouter from './routes/plan.js'

const app = express()
app.use(cors())
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/plan', planRouter)

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`Go Fish backend on http://localhost:${port}`))
