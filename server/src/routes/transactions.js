import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { validateQueryCategory, validateQueryAssetStatus } from '../middleware/dynamicValidate.js'

const router = Router()
router.use(requireAuth)

// ─── GET /api/transactions ─────────────────────────────────────────────────
router.get(
  '/',
  validateQueryCategory,
  [
    query('asset_id').optional().isInt().toInt(),
    query('status').optional(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { asset_id, category, search } = req.query
      const page = req.query.page || 1
      const limit = req.query.limit || 20
      const offset = (page - 1) * limit

      let { status, from, to } = req.query

      const conditions = ['a.deleted_at IS NULL']
      const params = []

      if (asset_id) {
        params.push(asset_id)
        conditions.push(`bt.asset_id = $${params.length}`)
      }
      if (category) {
        params.push(category)
        conditions.push(`a.category = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        conditions.push(
          `(bt.borrower_name ILIKE $${params.length} OR a.name ILIKE $${params.length})`,
        )
      }
      if (from) {
        params.push(from)
        conditions.push(`bt.borrowed_at >= $${params.length}`)
      }
      if (to) {
        params.push(to)
        conditions.push(`bt.borrowed_at <= $${params.length}`)
      }

      // Overdue is computed: active + expected_return_at passed
      if (status === 'overdue') {
        conditions.push(`bt.status = 'active' AND bt.expected_return_at IS NOT NULL AND bt.expected_return_at < NOW()`)
      } else if (status) {
        params.push(status)
        conditions.push(`bt.status = $${params.length}`)
      }

      const where = conditions.join(' AND ')

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM borrow_transactions bt
         JOIN assets a ON a.id = bt.asset_id
         WHERE ${where}`,
        params,
      )
      const total = parseInt(countRes.rows[0].count, 10)

      params.push(limit, offset)
      const { rows } = await pool.query(
        `SELECT bt.*,
                a.name AS asset_name, a.category, a.asset_code,
                CASE
                  WHEN bt.status = 'active'
                    AND bt.expected_return_at IS NOT NULL
                    AND bt.expected_return_at < NOW()
                  THEN true ELSE false
                END AS is_overdue
         FROM borrow_transactions bt
         JOIN assets a ON a.id = bt.asset_id
         WHERE ${where}
         ORDER BY bt.borrowed_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      )

      res.json({
        data: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (err) {
      next(err)
    }
  },
)

export default router
