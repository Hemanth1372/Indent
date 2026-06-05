import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' })
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret)
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
