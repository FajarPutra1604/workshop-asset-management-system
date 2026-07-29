const ROLE_HIERARCHY = {
  viewer: 0,
  operator: 1,
  admin: 2,
  superadmin: 3,
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }
    const userRole = req.admin.role
    if (!allowedRoles.includes(userRole)) {
      const userLevel = ROLE_HIERARCHY[userRole] ?? -1
      const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] ?? 99))
      if (userLevel >= minLevel) return next()
      return res.status(403).json({ error: 'Akses ditolak. Role tidak memiliki izin.' })
    }
    next()
  }
}

export function requireMinLevel(minRole) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }
    const userLevel = ROLE_HIERARCHY[req.admin.role] ?? -1
    const minLevel = ROLE_HIERARCHY[minRole] ?? 0
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Akses ditolak. Level role tidak mencukupi.' })
    }
    next()
  }
}

export const ROLE_LEVELS = ROLE_HIERARCHY
