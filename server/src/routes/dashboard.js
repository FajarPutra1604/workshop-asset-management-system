import { Router } from 'express'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ─── GET /api/dashboard/summary ───────────────────────────────────────────
router.get('/summary', async (_req, res, next) => {
  try {
    // 1. Ringkasan status per kategori
    const { rows: statusRows } = await pool.query(`
      SELECT
        category,
        COUNT(*) FILTER (WHERE status = 'available') AS available,
        COUNT(*) FILTER (WHERE status = 'borrowed')  AS borrowed,
        COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance,
        COUNT(*) FILTER (WHERE status = 'lost')      AS lost,
        COUNT(*) AS total
      FROM assets
      WHERE deleted_at IS NULL
      GROUP BY category
      ORDER BY category
    `)

    // 2. Total global + overdue
    const { rows: globalRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_assets,
        COUNT(*) FILTER (WHERE status = 'available' AND deleted_at IS NULL) AS available,
        COUNT(*) FILTER (WHERE status = 'borrowed'  AND deleted_at IS NULL) AS borrowed,
        COUNT(*) FILTER (WHERE status = 'maintenance' AND deleted_at IS NULL) AS maintenance,
        COUNT(*) FILTER (WHERE status = 'lost'      AND deleted_at IS NULL) AS lost
      FROM assets
    `)

    // 3. Overdue count (active transactions past expected_return_at)
    const { rows: overdueRows } = await pool.query(`
      SELECT COUNT(*) AS overdue
      FROM borrow_transactions bt
      JOIN assets a ON a.id = bt.asset_id
      WHERE bt.status = 'active'
        AND bt.expected_return_at IS NOT NULL
        AND bt.expected_return_at < NOW()
        AND a.deleted_at IS NULL
    `)

    // 4. Top 5 aset paling sering dipinjam
    const { rows: topAssets } = await pool.query(`
      SELECT a.id, a.name, a.category, COUNT(bt.id) AS borrow_count
      FROM assets a
      JOIN borrow_transactions bt ON bt.asset_id = a.id
      WHERE a.deleted_at IS NULL
      GROUP BY a.id, a.name, a.category
      ORDER BY borrow_count DESC
      LIMIT 5
    `)

    // 4b. Dikembalikan telat (returned_at > expected_return_at)
    const { rows: lateRows } = await pool.query(`
      SELECT COUNT(*) AS late_returns
      FROM borrow_transactions bt
      JOIN assets a ON a.id = bt.asset_id
      WHERE bt.status = 'returned'
        AND bt.returned_at IS NOT NULL
        AND bt.expected_return_at IS NOT NULL
        AND bt.returned_at > bt.expected_return_at
        AND a.deleted_at IS NULL
    `)

    // 5. Tren peminjaman 8 minggu terakhir
    const { rows: weeklyTrend } = await pool.query(`
      SELECT
        date_trunc('week', borrowed_at) AS week_start,
        COUNT(*) AS borrow_count
      FROM borrow_transactions
      WHERE borrowed_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week_start
      ORDER BY week_start ASC
    `)

    // 6. Daftar transaksi overdue (untuk follow-up)
    const { rows: overdueList } = await pool.query(`
      SELECT bt.id, bt.borrower_name, bt.borrowed_at, bt.expected_return_at,
             a.name AS asset_name, a.category, a.asset_code
      FROM borrow_transactions bt
      JOIN assets a ON a.id = bt.asset_id
      WHERE bt.status = 'active'
        AND bt.expected_return_at IS NOT NULL
        AND bt.expected_return_at < NOW()
        AND a.deleted_at IS NULL
      ORDER BY bt.expected_return_at ASC
      LIMIT 20
    `)

    // 6b. Daftar transaksi dikembalikan telat (untuk review)
    const { rows: lateReturnList } = await pool.query(`
      SELECT bt.id, bt.borrower_name, bt.borrowed_at, bt.expected_return_at, bt.returned_at,
             a.name AS asset_name, a.category
      FROM borrow_transactions bt
      JOIN assets a ON a.id = bt.asset_id
      WHERE bt.status = 'returned'
        AND bt.returned_at IS NOT NULL
        AND bt.expected_return_at IS NOT NULL
        AND bt.returned_at > bt.expected_return_at
        AND a.deleted_at IS NULL
      ORDER BY bt.returned_at DESC
      LIMIT 20
    `)

    const global = globalRows[0]

    res.json({
      summary: {
        total_assets: parseInt(global.total_assets, 10),
        available: parseInt(global.available, 10),
        borrowed: parseInt(global.borrowed, 10),
        maintenance: parseInt(global.maintenance, 10),
        lost: parseInt(global.lost, 10),
        overdue: parseInt(overdueRows[0].overdue, 10),
        late_returns: parseInt(lateRows[0].late_returns, 10),
      },
      by_category: statusRows.map((r) => ({
        category: r.category,
        available: parseInt(r.available, 10),
        borrowed: parseInt(r.borrowed, 10),
        maintenance: parseInt(r.maintenance, 10),
        lost: parseInt(r.lost, 10),
        total: parseInt(r.total, 10),
      })),
      top_assets: topAssets.map((r) => ({
        ...r,
        borrow_count: parseInt(r.borrow_count, 10),
      })),
      weekly_trend: weeklyTrend.map((r) => ({
        week_start: r.week_start,
        borrow_count: parseInt(r.borrow_count, 10),
      })),
      overdue_list: overdueList,
      late_return_list: lateReturnList,
    })
  } catch (err) {
    next(err)
  }
})

export default router
