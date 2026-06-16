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

    if (!isPortalAdminRole(role)) {
      return res.status(403).json({
        errorCode: 'WEB_ACCESS_DENIED',
        message: 'Unauthorized Access: Web Admin Portal access is restricted to authorized Admin accounts.',
      })
    }

    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function checkSuperAdmin(req, res, next) {
  const role = String(req.user?.role ?? req.user?.primary_role ?? '').trim().toUpperCase()

  if (isPortalAdminRole(role)) {
    return next()
  }

  return res.status(403).json({
    errorCode: 'WEB_PORTAL_UNAUTHORIZED',
    message: 'Unauthorized Access: Web Admin Portal environments are restricted to authorized Admin sessions.',
  })
}

function isPortalAdminRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()

  return (
    normalizedRole === 'SUPER ADMIN' ||
    normalizedRole.includes('SUPER ADMIN') ||
    normalizedRole === 'ADMINISTRATOR' ||
    normalizedRole.includes('ADMINISTRATOR') ||
    normalizedRole === 'ADMIN' ||
    normalizedRole.startsWith('ADMIN ') ||
    normalizedRole.includes('(ADMIN)')
  )
}
