import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel } from '../middleware/authorize.js'
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
                END AS is_overdue,
                CASE
                  WHEN bt.status = 'returned'
                    AND bt.returned_at IS NOT NULL
                    AND bt.expected_return_at IS NOT NULL
                    AND bt.returned_at > bt.expected_return_at
                  THEN true ELSE false
                END AS is_late_return
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

// ─── PUT /api/transactions/:id/return (force return) ────────────────────────
router.put('/:id/return', requireMinLevel('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM borrow_transactions WHERE id = $1',
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' })
    const tx = rows[0]
    if (tx.status !== 'active') {
      return res.status(409).json({ error: 'Hanya transaksi berstatus aktif yang bisa ditandai dikembalikan' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE borrow_transactions SET
           status = 'returned', returned_at = NOW(),
           return_by_name = $1, return_note = 'Dikembalikan paksa oleh admin'
         WHERE id = $2`,
        [req.admin.name, tx.id],
      )
      await client.query(
        "UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = $1",
        [tx.asset_id],
      )
      await client.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
        req.admin.id, req.admin.name, 'force_return', 'borrow_transactions',
        String(tx.id), JSON.stringify({ asset_id: tx.asset_id, borrower_name: tx.borrower_name }),
      ])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    res.json({ message: 'Transaksi ditandai dikembalikan' })
  } catch (err) { next(err) }
})

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────
router.delete('/:id', requireMinLevel('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM borrow_transactions WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' })
    const tx = rows[0]

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (tx.status === 'active') {
        await client.query(
          "UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = $1 AND status = 'borrowed'",
          [tx.asset_id],
        )
      }
      await client.query('DELETE FROM borrow_transactions WHERE id = $1', [tx.id])
      await client.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
        req.admin.id, req.admin.name, 'delete_transaction', 'borrow_transactions',
        String(tx.id), JSON.stringify({ asset_id: tx.asset_id, borrower_name: tx.borrower_name, status: tx.status }),
      ])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    res.json({ message: 'Transaksi dihapus' })
  } catch (err) { next(err) }
})

export default router
