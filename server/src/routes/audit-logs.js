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

    const conditions = []
    const params = []
    if (req.query.action) {
      params.push(req.query.action)
      conditions.push(`action = $${params.length}`)
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`)
      conditions.push(
        `(admin_name ILIKE $${params.length} OR entity_type ILIKE $${params.length} OR details::text ILIKE $${params.length})`,
      )
    }
    if (req.query.from) {
      params.push(req.query.from)
      conditions.push(`created_at >= $${params.length}`)
    }
    if (req.query.to) {
      params.push(req.query.to)
      conditions.push(`created_at <= $${params.length}`)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params,
    )
    const total = parseInt(countResult.rows[0].count)

    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT id, admin_id, admin_name, action, entity_type, entity_id, details, created_at
       FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
})

export default router
