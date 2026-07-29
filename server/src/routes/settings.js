import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel } from '../middleware/authorize.js'

const router = Router()
router.use(requireAuth)

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })
  next()
}

// ── GET /api/settings/constants ──
// Mengembalikan semua kategori, status aset, status transaksi, dan category_fields
router.get('/constants', async (_req, res, next) => {
  try {
    const [categories, assetStatuses, txStatuses, categoryFields] = await Promise.all([
      pool.query('SELECT slug, name, icon, color, description, sort_order FROM asset_categories WHERE is_active = TRUE ORDER BY sort_order'),
      pool.query('SELECT slug, name, color, badge_class FROM asset_statuses WHERE is_active = TRUE ORDER BY sort_order'),
      pool.query('SELECT slug, name, color FROM transaction_statuses WHERE is_active = TRUE ORDER BY sort_order'),
      pool.query('SELECT category_slug, field_key, field_label, field_type, is_required, placeholder FROM category_fields WHERE is_active = TRUE ORDER BY sort_order'),
    ])
    res.json({
      categories: categories.rows,
      asset_statuses: assetStatuses.rows,
      transaction_statuses: txStatuses.rows,
      category_fields: categoryFields.rows,
    })
  } catch (err) { next(err) }
})

// ── CRUD Asset Categories ── (write: superadmin only)
router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM asset_categories ORDER BY sort_order')
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/categories',
  requireMinLevel('superadmin'),
  body('slug').matches(/^[a-z0-9_]+$/).withMessage('Slug hanya boleh huruf kecil, angka, dan underscore'),
  body('name').trim().notEmpty().withMessage('Nama kategori wajib diisi'),
  body('color').optional().isLength({ min: 7, max: 7 }).withMessage('Warna harus format HEX (contoh: #ff0000)'),
  validate,
  async (req, res, next) => {
    try {
      const { slug, name, icon, color, description, sort_order } = req.body
      const { rows } = await pool.query(
        `INSERT INTO asset_categories (slug, name, icon, color, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [slug, name, icon || '', color || '#6366f1', description || '', sort_order || 0]
      )
      res.status(201).json(rows[0])
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Slug kategori sudah ada' })
      next(err)
    }
  }
)

router.put('/categories/:slug',
  requireMinLevel('superadmin'),
  param('slug').isString(),
  body('name').optional().trim().notEmpty(),
  body('color').optional().isLength({ min: 7, max: 7 }),
  validate,
  async (req, res, next) => {
    try {
      const fields = ['name', 'icon', 'color', 'description', 'sort_order', 'is_active']
      const sets = fields.filter(f => req.body[f] !== undefined).map((f, i) => `${f} = $${i + 2}`)
      if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate' })
      const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f])
      const { rows } = await pool.query(
        `UPDATE asset_categories SET ${sets.join(', ')} WHERE slug = $1 RETURNING *`,
        [req.params.slug, ...vals]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'Kategori tidak ditemukan' })
      res.json(rows[0])
    } catch (err) { next(err) }
  }
)

router.delete('/categories/:slug', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM asset_categories WHERE slug = $1', [req.params.slug])
    if (rowCount === 0) return res.status(404).json({ error: 'Kategori tidak ditemukan' })
    res.json({ message: 'Kategori berhasil dihapus' })
  } catch (err) { next(err) }
})

// ── CRUD Asset Statuses ──
router.get('/asset-statuses', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM asset_statuses ORDER BY sort_order')
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/asset-statuses',
  requireMinLevel('superadmin'),
  body('slug').matches(/^[a-z0-9_]+$/).withMessage('Slug hanya boleh huruf kecil, angka, dan underscore'),
  body('name').trim().notEmpty().withMessage('Nama status wajib diisi'),
  validate,
  async (req, res, next) => {
    try {
      const { slug, name, color, badge_class, sort_order } = req.body
      const { rows } = await pool.query(
        `INSERT INTO asset_statuses (slug, name, color, badge_class, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [slug, name, color || '#6366f1', badge_class || '', sort_order || 0]
      )
      res.status(201).json(rows[0])
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Slug status sudah ada' })
      next(err)
    }
  }
)

router.put('/asset-statuses/:slug',
  requireMinLevel('superadmin'),
  param('slug').isString(),
  validate,
  async (req, res, next) => {
    try {
      const fields = ['name', 'color', 'badge_class', 'sort_order', 'is_active']
      const sets = fields.filter(f => req.body[f] !== undefined).map((f, i) => `${f} = $${i + 2}`)
      if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate' })
      const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f])
      const { rows } = await pool.query(
        `UPDATE asset_statuses SET ${sets.join(', ')} WHERE slug = $1 RETURNING *`,
        [req.params.slug, ...vals]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'Status tidak ditemukan' })
      res.json(rows[0])
    } catch (err) { next(err) }
  }
)

router.delete('/asset-statuses/:slug', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM asset_statuses WHERE slug = $1', [req.params.slug])
    if (rowCount === 0) return res.status(404).json({ error: 'Status tidak ditemukan' })
    res.json({ message: 'Status berhasil dihapus' })
  } catch (err) { next(err) }
})

// ── CRUD Transaction Statuses ──
router.get('/transaction-statuses', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM transaction_statuses ORDER BY sort_order')
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/transaction-statuses',
  requireMinLevel('superadmin'),
  body('slug').matches(/^[a-z0-9_]+$/),
  body('name').trim().notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { slug, name, color, sort_order } = req.body
      const { rows } = await pool.query(
        `INSERT INTO transaction_statuses (slug, name, color, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
        [slug, name, color || '#6366f1', sort_order || 0]
      )
      res.status(201).json(rows[0])
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Slug status sudah ada' })
      next(err)
    }
  }
)

router.put('/transaction-statuses/:slug', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const fields = ['name', 'color', 'sort_order', 'is_active']
    const sets = fields.filter(f => req.body[f] !== undefined).map((f, i) => `${f} = $${i + 2}`)
    if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate' })
    const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f])
    const { rows } = await pool.query(
      `UPDATE transaction_statuses SET ${sets.join(', ')} WHERE slug = $1 RETURNING *`,
      [req.params.slug, ...vals]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Status tidak ditemukan' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.delete('/transaction-statuses/:slug', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM transaction_statuses WHERE slug = $1', [req.params.slug])
    if (rowCount === 0) return res.status(404).json({ error: 'Status tidak ditemukan' })
    res.json({ message: 'Status berhasil dihapus' })
  } catch (err) { next(err) }
})

// ── CRUD Category Fields ──
router.get('/category-fields', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM category_fields ORDER BY category_slug, sort_order')
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/category-fields',
  requireMinLevel('superadmin'),
  body('category_slug').notEmpty(),
  body('field_key').matches(/^[a-z0-9_]+$/),
  body('field_label').trim().notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { category_slug, field_key, field_label, field_type, is_required, placeholder, sort_order } = req.body
      const { rows } = await pool.query(
        `INSERT INTO category_fields (category_slug, field_key, field_label, field_type, is_required, placeholder, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [category_slug, field_key, field_label, field_type || 'text', is_required || false, placeholder || '', sort_order || 0]
      )
      res.status(201).json(rows[0])
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Field sudah ada untuk kategori ini' })
      next(err)
    }
  }
)

router.delete('/category-fields/:id', requireMinLevel('superadmin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM category_fields WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ error: 'Field tidak ditemukan' })
    res.json({ message: 'Field berhasil dihapus' })
  } catch (err) { next(err) }
})

export default router
