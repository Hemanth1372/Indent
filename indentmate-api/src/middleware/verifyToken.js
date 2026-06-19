import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'

export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' })
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    const loginName = String(payload.login_name ?? payload.employeeId ?? payload.employee_id ?? '').trim()

    if (!loginName) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

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

    if (!result.rows[0] || currentSessionVersion !== tokenSessionVersion) {
      return res.status(401).json({ message: 'Session expired. Please login again.' })
    }

    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function requireAdministrator(req, res, next) {
  const primaryRole = String(req.user?.primary_role ?? '').toLowerCase()
  const assignedProjects = Array.isArray(req.user?.assigned_projects)
    ? req.user.assigned_projects
    : []

  const allowedRoles = ['super admin', 'administrator', 'admin']
  const isAdministrator =
    allowedRoles.includes(primaryRole) ||
    assignedProjects.some((project) =>
      allowedRoles.includes(String(project.role_name).toLowerCase()),
    )

  if (!isAdministrator) {
    return res.status(403).json({ message: 'Administrator role is required' })
  }

  return next()
}

export function requirePasswordAdministrator(req, res, next) {
  const primaryRole = String(req.user?.primary_role ?? '').toLowerCase()
  const assignedProjects = Array.isArray(req.user?.assigned_projects)
    ? req.user.assigned_projects
    : []

  const allowedRoles = ['super admin', 'administrator']
  const hasPrimaryRole = allowedRoles.includes(primaryRole)
  const hasProjectRole = assignedProjects.some((project) =>
    allowedRoles.includes(String(project.role_name).toLowerCase()),
  )

  if (!hasPrimaryRole && !hasProjectRole) {
    return res.status(403).json({ message: 'Super Admin or Administrator role is required' })
  }

  return next()
}

export function requireSuperAdmin(req, res, next) {
  const primaryRole = String(req.user?.primary_role ?? '').toLowerCase()
  const assignedProjects = Array.isArray(req.user?.assigned_projects)
    ? req.user.assigned_projects
    : []

  const isSuperAdmin =
    primaryRole === 'super admin' ||
    assignedProjects.some((project) =>
      String(project.role_name).toLowerCase() === 'super admin',
    )

  if (!isSuperAdmin) {
    return res.status(403).json({ message: 'Super Admin role is required' })
  }

  return next()
}
