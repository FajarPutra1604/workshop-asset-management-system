import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel, ROLE_LEVELS } from '../middleware/authorize.js'

const router = Router()
router.use(requireAuth)

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })
  next()
}

const MANAGED_ROLES = {
  superadmin: ['superadmin', 'admin', 'operator', 'viewer'],
  admin: ['operator', 'viewer'],
  operator: [],
  viewer: [],
}

function canManageRole(requesterRole, targetRole) {
  return MANAGED_ROLES[requesterRole]?.includes(targetRole) ?? false
}

// GET /api/admin-users
router.get('/', requireMinLevel('admin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM admin_users ORDER BY role DESC, created_at ASC`
    )
    res.json(rows)
  } catch (err) { next(err) }
})

// GET /api/admin-users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at, updated_at FROM admin_users WHERE id = $1`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Admin tidak ditemukan' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

// POST /api/admin-users — create admin
router.post('/',
  requireMinLevel('admin'),
  body('name').trim().notEmpty().withMessage('Nama wajib diisi'),
  body('email').isEmail().withMessage('Email tidak valid'),
  body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
  body('role').isIn(['superadmin', 'admin', 'operator', 'viewer']).withMessage('Role tidak valid'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body

      if (!canManageRole(req.admin.role, role)) {
        return res.status(403).json({ error: `Role ${req.admin.role} tidak bisa membuat role ${role}` })
      }

      const exists = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email.toLowerCase()])
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'Email sudah terdaftar' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const { rows } = await pool.query(
        `INSERT INTO admin_users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
        [name, email.toLowerCase(), passwordHash, role]
      )

      await pool.query('SELECT log_audit($1, $2, $3, $4, $5, $6)', [
        req.admin.id, req.admin.name, 'create_admin', 'admin_users',
        String(rows[0].id), JSON.stringify({ name, email, role })
      ])

      res.status(201).json(rows[0])
    } catch (err) { next(err) }
  }
)

// PUT /api/admin-users/:id — update admin
router.put('/:id',
  requireMinLevel('admin'),
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
  body('role').optional().isIn(['superadmin', 'admin', 'operator', 'viewer']),
  validate,
  async (req, res, next) => {
    try {
      const target = await pool.query('SELECT * FROM admin_users WHERE id = $1', [req.params.id])
      if (target.rows.length === 0) return res.status(404).json({ error: 'Admin tidak ditemukan' })

      const targetAdmin = target.rows[0]

      if (Number(req.params.id) === req.admin.id && req.body.role && req.body.role !== req.admin.role) {
        return res.status(400).json({ error: 'Tidak bisa mengubah role diri sendiri' })
      }

      if (req.body.role && !canManageRole(req.admin.role, targetAdmin.role)) {
        return res.status(403).json({ error: `Tidak bisa mengelola role ${targetAdmin.role}` })
      }

      if (req.body.role && !canManageRole(req.admin.role, req.body.role)) {
        return res.status(403).json({ error: `Tidak bisa mengubah ke role ${req.body.role}` })
      }

      const sets = []
      const vals = []
      let idx = 2

      if (req.body.name) { sets.push(`name = $${idx++}`); vals.push(req.body.name) }
      if (req.body.email) { sets.push(`email = $${idx++}`); vals.push(req.body.email.toLowerCase()) }
      if (req.body.password) {
        const hash = await bcrypt.hash(req.body.password, 10)
        sets.push(`password_hash = $${idx++}`)
        vals.push(hash)
      }
      if (req.body.role) { sets.push(`role = $${idx++}`); vals.push(req.body.role) }

      if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate' })

      const { rows } = await pool.query(
        `UPDATE admin_users SET ${sets.join(', ')} WHERE id = $1 RETURNING id, name, email, role, created_at, updated_at`,
        [req.params.id, ...vals]
      )

      await pool.query('SELECT log_audit($1, $2, $3, $4, $5, $6)', [
        req.admin.id, req.admin.name, 'update_admin', 'admin_users',
        String(req.params.id), JSON.stringify(req.body)
      ])

      res.json(rows[0])
    } catch (err) { next(err) }
  }
)

// DELETE /api/admin-users/:id — soft delete
router.delete('/:id', requireMinLevel('admin'), async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.admin.id) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' })
    }

    const target = await pool.query('SELECT role FROM admin_users WHERE id = $1', [req.params.id])
    if (target.rows.length === 0) return res.status(404).json({ error: 'Admin tidak ditemukan' })

    if (!canManageRole(req.admin.role, target.rows[0].role)) {
      return res.status(403).json({ error: `Tidak bisa menghapus role ${target.rows[0].role}` })
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [req.params.id])

    await pool.query('SELECT log_audit($1, $2, $3, $4, $5, $6)', [
      req.admin.id, req.admin.name, 'delete_admin', 'admin_users',
      String(req.params.id), JSON.stringify({ deleted_id: req.params.id })
    ])

    res.json({ message: 'Admin berhasil dihapus' })
  } catch (err) { next(err) }
})

export default router
