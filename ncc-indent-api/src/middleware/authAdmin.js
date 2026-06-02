import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function verifySuperAdmin(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' })
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    const role = String(payload.role ?? payload.primary_role ?? '').trim().toUpperCase()

    const allowedRoles = ['SUPER ADMIN', 'ADMINISTRATOR', 'ADMIN']

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        errorCode: 'UNAUTHORIZED_PORTAL_ACCESS',
        message: 'Access Denied: Only Administrators can access the Admin Portal.',
      })
    }

    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
