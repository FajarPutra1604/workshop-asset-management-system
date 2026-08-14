import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import pool from '../db/pool.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { loginRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

// POST /api/auth/login
router.post(
  '/login',
  loginRateLimiter,
  [
    body('email').isEmail().withMessage('Email tidak valid'),
    body('password').isLength({ min: 1 }).withMessage('Password wajib diisi'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { email, password } = req.body
      const { rows } = await pool.query(
        'SELECT id, name, email, password_hash, role FROM admin_users WHERE email = $1',
        [email.toLowerCase()],
      )

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Email atau password salah' })
      }

      const admin = rows[0]
      const match = await bcrypt.compare(password, admin.password_hash)
      if (!match) {
        return res.status(401).json({ error: 'Email atau password salah' })
      }

      const token = signToken({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      })

      res.json({
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// GET /api/auth/me — verifikasi token & ambil info admin
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ admin: req.admin })
  } catch (err) {
    next(err)
  }
})

export default router
