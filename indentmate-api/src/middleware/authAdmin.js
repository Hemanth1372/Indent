import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'

export async function verifySuperAdmin(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' })
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    const loginName = String(payload.login_name ?? payload.employeeId ?? payload.employee_id ?? '').trim()
    const result = await query(
      `
        SELECT session_version
        FROM users
        WHERE login_name = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
          AND COALESCE(is_active, TRUE) = TRUE
        LIMIT 1
      `,
      [loginName],
    )
    const currentSessionVersion = Number(result.rows[0]?.session_version ?? -1)
    const tokenSessionVersion = Number(payload.session_version ?? 0)

    if (!loginName || !result.rows[0] || currentSessionVersion !== tokenSessionVersion) {
      return res.status(401).json({ message: 'Session expired. Please login again.' })
    }

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
