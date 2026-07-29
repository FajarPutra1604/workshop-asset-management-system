import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel } from '../middleware/authorize.js'
import { upload } from '../middleware/upload.js'
import { generateAssetCode } from '../utils/crypto.js'
import { validateCategory, validateAssetStatus, validateQueryCategory, validateQueryAssetStatus } from '../middleware/dynamicValidate.js'

const router = Router()

router.use(requireAuth)

function fileToBase64(file) {
  if (!file) return null
  const mime = file.mimetype
  return `data:${mime};base64,${file.buffer.toString('base64')}`
}

// ─── GET /api/assets ────────────────────────────────────────────────────────
router.get(
  '/',
  validateQueryCategory,
  validateQueryAssetStatus,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { category, status, search } = req.query
      const page = req.query.page || 1
      const limit = req.query.limit || 20
      const offset = (page - 1) * limit

      const conditions = ['a.deleted_at IS NULL']
      const params = []

      if (category) {
        params.push(category)
        conditions.push(`a.category = $${params.length}`)
      }
      if (status) {
        params.push(status)
        conditions.push(`a.status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        conditions.push(`(a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`)
      }

      const where = conditions.join(' AND ')

      // Count total
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM assets a WHERE ${where}`,
        params,
      )
      const total = parseInt(countRes.rows[0].count, 10)

      // Fetch data
      params.push(limit, offset)
      const { rows } = await pool.query(
        `SELECT a.*,
                vd.model, vd.plate_number, vd.last_odometer,
                rd.location, rd.capacity
         FROM assets a
         LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
         LEFT JOIN room_details rd ON rd.asset_id = a.id
         WHERE ${where}
         ORDER BY a.created_at DESC
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

// ─── GET /api/assets/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              vd.model, vd.plate_number, vd.last_odometer,
              rd.location, rd.capacity
       FROM assets a
       LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
       LEFT JOIN room_details rd ON rd.asset_id = a.id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })
    res.json({ data: rows[0] })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/assets/:id/qrcode ─────────────────────────────────────────────
router.get('/:id/qrcode', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, asset_code FROM assets WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })

    const asset = rows[0]
    const frontendUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173'
    const qrUrl = `${frontendUrl}/scan/${asset.asset_code}`

    res.json({
      asset_code: asset.asset_code,
      asset_name: asset.name,
      qr_url: qrUrl,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/assets ────────────────────────────────────────────────────────
router.post(
  '/',
  requireMinLevel('admin'),
  upload.single('photo'),
  validateCategory,
  [
    body('name').trim().notEmpty().withMessage('Nama aset wajib diisi'),
    body('description').optional().trim(),
    body('status').optional(),
    // vehicle details
    body('model').optional().trim(),
    body('plate_number').optional().trim(),
    body('last_odometer').optional().isInt({ min: 0 }).toInt(),
    // room details
    body('location').optional().trim(),
    body('capacity').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const {
        name, category, description, status = 'available',
        model, plate_number, last_odometer,
        location, capacity,
      } = req.body

      const asset_code = generateAssetCode()
      const photo_url = fileToBase64(req.file)

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const { rows } = await client.query(
          `INSERT INTO assets (asset_code, category, name, description, photo_url, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [asset_code, category, name, description || null, photo_url, status],
        )
        const asset = rows[0]

        if (category === 'vehicle') {
          await client.query(
            `INSERT INTO vehicle_details (asset_id, model, plate_number, last_odometer)
             VALUES ($1, $2, $3, $4)`,
            [asset.id, model || null, plate_number || null, last_odometer || null],
          )
        } else if (category === 'room') {
          await client.query(
            `INSERT INTO room_details (asset_id, location, capacity)
             VALUES ($1, $2, $3)`,
            [asset.id, location || null, capacity || null],
          )
        }

        await client.query('COMMIT')
        res.status(201).json({ data: asset })
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

// ─── PUT /api/assets/:id ─────────────────────────────────────────────────────
router.put(
  '/:id',
  requireMinLevel('admin'),
  upload.single('photo'),
  validateAssetStatus,
  [
    body('name').optional().trim().notEmpty().withMessage('Nama tidak boleh kosong'),
    body('status').optional(),
    body('description').optional().trim(),
    body('model').optional().trim(),
    body('plate_number').optional().trim(),
    body('last_odometer').optional().isInt({ min: 0 }).toInt(),
    body('location').optional().trim(),
    body('capacity').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { id } = req.params
      const { name, description, status, model, plate_number, last_odometer, location, capacity } =
        req.body

      const { rows: existing } = await pool.query(
        'SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL',
        [id],
      )
      if (existing.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })

      const asset = existing[0]
      const photo_url = req.file ? fileToBase64(req.file) : asset.photo_url

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const { rows } = await client.query(
          `UPDATE assets SET
             name = $1, description = $2, status = $3, photo_url = $4, updated_at = NOW()
           WHERE id = $5 RETURNING *`,
          [
            name ?? asset.name,
            description !== undefined ? description : asset.description,
            status ?? asset.status,
            photo_url,
            id,
          ],
        )

        const category = asset.category
        if (category === 'vehicle') {
          await client.query(
            `INSERT INTO vehicle_details (asset_id, model, plate_number, last_odometer)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (asset_id) DO UPDATE SET
               model = EXCLUDED.model,
               plate_number = EXCLUDED.plate_number,
               last_odometer = EXCLUDED.last_odometer`,
            [id, model ?? null, plate_number ?? null, last_odometer ?? null],
          )
        } else if (category === 'room') {
          await client.query(
            `INSERT INTO room_details (asset_id, location, capacity)
             VALUES ($1, $2, $3)
             ON CONFLICT (asset_id) DO UPDATE SET
               location = EXCLUDED.location,
               capacity = EXCLUDED.capacity`,
            [id, location ?? null, capacity ?? null],
          )
        }

        await client.query('COMMIT')
        res.json({ data: rows[0] })
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

// ─── DELETE /api/assets/:id (soft delete) ────────────────────────────────────
router.delete('/:id', requireMinLevel('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE assets SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })
    res.json({ message: 'Aset berhasil dihapus', id: rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
