import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel } from '../middleware/authorize.js'

const router = Router()
router.use(requireAuth)

// GET /api/audit-logs — hanya superadmin yang bisa lihat semua
router.get('/', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
    const offset = (page - 1) * limit

    const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs')
    const total = parseInt(countResult.rows[0].count)

    const { rows } = await pool.query(
      `SELECT id, admin_id, admin_name, action, entity_type, entity_id, details, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json({
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
})

export default router
