import { Router } from 'express'
import { readFileSync } from 'node:fs'

const router = Router()
const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

// GET /api/plan?start=YYYY-MM-DD&days=1|2[&snapshot=demo]
router.get('/', async (req, res) => {
  if (req.query.snapshot === 'demo') {
    return res.json(readJson('../snapshots/demo.json'))
  }
  try {
    // TODO (backend): build the real plan from services/*. Until then, serve the mock.
    return res.json(readJson('../mock/plan.json'))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not build plan' })
  }
})

export default router
