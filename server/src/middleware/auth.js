import { verifyToken } from '../utils/jwt.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' })
  }
  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    req.admin = { id: payload.id, email: payload.email, name: payload.name, role: payload.role }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' })
  }
}
