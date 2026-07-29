import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { upload } from '../middleware/upload.js'

const router = Router()

function fileToBase64(file) {
  if (!file) return null
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
}

// ─── GET /api/public/assets/:assetCode ────────────────────────────────────
// Informasi aset + status untuk halaman scan (no auth, rate-limited dari index.js)
router.get(
  '/assets/:assetCode',
  [param('assetCode').trim().notEmpty()],
  async (req, res, next) => {
    try {
      const { assetCode } = req.params

      const { rows } = await pool.query(
        `SELECT a.*,
                vd.model, vd.plate_number, vd.last_odometer,
                rd.location, rd.capacity
         FROM assets a
         LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
         LEFT JOIN room_details rd ON rd.asset_id = a.id
         WHERE a.asset_code = $1 AND a.deleted_at IS NULL`,
        [assetCode.toUpperCase()],
      )

      if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })

      const asset = rows[0]

      // Cari transaksi aktif
      let activeTx = null
      if (asset.status === 'borrowed') {
        const txRes = await pool.query(
          `SELECT id, borrower_name, borrowed_at, expected_return_at, purpose
           FROM borrow_transactions
           WHERE asset_id = $1 AND status = 'active'
           ORDER BY borrowed_at DESC LIMIT 1`,
          [asset.id],
        )
        activeTx = txRes.rows[0] || null
      }

      res.json({ data: asset, active_transaction: activeTx })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/public/borrow ───────────────────────────────────────────────
router.post(
  '/borrow',
  [
    body('asset_code').trim().notEmpty().withMessage('asset_code wajib diisi'),
    body('borrower_name').trim().notEmpty().withMessage('Nama peminjam wajib diisi'),
    body('borrower_contact').optional().trim(),
    body('purpose').optional().trim(),
    body('estimated_duration_hours').optional().isNumeric().toFloat(),
    body('expected_return_at').optional().isISO8601(),
    body('odometer_start').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const {
        asset_code,
        borrower_name,
        borrower_contact,
        purpose,
        estimated_duration_hours,
        expected_return_at,
        odometer_start,
      } = req.body

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Kunci baris aset
        const { rows: assetRows } = await client.query(
          'SELECT id, status, category FROM assets WHERE asset_code = $1 AND deleted_at IS NULL FOR UPDATE',
          [asset_code.toUpperCase()],
        )
        if (assetRows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ error: 'Aset tidak ditemukan' })
        }

        const asset = assetRows[0]
        if (asset.status !== 'available') {
          await client.query('ROLLBACK')
          return res.status(409).json({
            error: `Aset tidak tersedia (status: ${asset.status})`,
          })
        }

        // Hitung expected_return_at jika belum ada tapi ada durasi
        let returnAt = expected_return_at || null
        if (!returnAt && estimated_duration_hours) {
          const d = new Date()
          d.setTime(d.getTime() + estimated_duration_hours * 3600 * 1000)
          returnAt = d.toISOString()
        }

        // Buat transaksi
        const { rows: txRows } = await client.query(
          `INSERT INTO borrow_transactions
             (asset_id, borrower_name, borrower_contact, purpose,
              estimated_duration_hours, expected_return_at, odometer_start)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            asset.id,
            borrower_name.trim(),
            borrower_contact || null,
            purpose || null,
            estimated_duration_hours || null,
            returnAt,
            odometer_start || null,
          ],
        )

        // Update status aset
        await client.query(
          "UPDATE assets SET status = 'borrowed', updated_at = NOW() WHERE id = $1",
          [asset.id],
        )

        await client.query('COMMIT')
        res.status(201).json({ data: txRows[0], message: 'Peminjaman berhasil dicatat' })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/public/return ───────────────────────────────────────────────
router.post(
  '/return',
  upload.single('return_photo'),
  [
    body('asset_code').trim().notEmpty().withMessage('asset_code wajib diisi'),
    body('return_by_name').trim().notEmpty().withMessage('Nama wajib diisi'),
    body('return_note').optional().trim(),
    body('odometer_end').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { asset_code, return_by_name, return_note, odometer_end } = req.body
      const return_photo_url = fileToBase64(req.file)

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Kunci baris aset
        const { rows: assetRows } = await client.query(
          'SELECT id, status FROM assets WHERE asset_code = $1 AND deleted_at IS NULL FOR UPDATE',
          [asset_code.toUpperCase()],
        )
        if (assetRows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ error: 'Aset tidak ditemukan' })
        }

        const asset = assetRows[0]
        if (asset.status !== 'borrowed') {
          await client.query('ROLLBACK')
          return res.status(409).json({ error: 'Aset ini tidak sedang dipinjam' })
        }

        // Cari transaksi aktif
        const { rows: txRows } = await client.query(
          `SELECT id FROM borrow_transactions
           WHERE asset_id = $1 AND status = 'active'
           ORDER BY borrowed_at DESC LIMIT 1`,
          [asset.id],
        )
        if (txRows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ error: 'Transaksi aktif tidak ditemukan' })
        }

        // Update transaksi
        const { rows: updated } = await client.query(
          `UPDATE borrow_transactions SET
             status = 'returned',
             returned_at = NOW(),
             return_by_name = $1,
             return_note = $2,
             return_photo_url = $3,
             odometer_end = $4
           WHERE id = $5 RETURNING *`,
          [
            return_by_name.trim(),
            return_note || null,
            return_photo_url,
            odometer_end || null,
            txRows[0].id,
          ],
        )

        // Update status aset
        await client.query(
          "UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = $1",
          [asset.id],
        )

        await client.query('COMMIT')
        res.json({ data: updated[0], message: 'Pengembalian berhasil dicatat' })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } catch (err) {
      next(err)
    }
  },
)

export default router
