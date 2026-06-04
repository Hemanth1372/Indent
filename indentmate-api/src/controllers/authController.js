import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'

const USER_BY_LOGIN_NAME_SQL = `
  SELECT user_id, login_name, employee_name, primary_role, password_hash, is_active
  FROM users
  WHERE login_name = $1
  LIMIT 1
`

const USER_CONTEXT_SQL = `
  SELECT
    u.user_id,
    u.employee_name,
    u.login_name,
    u.primary_role,
    COALESCE(
      json_agg(
        json_build_object(
          'project_id', p.project_id,
          'project_name', p.project_name,
          'location', p.location,
          'status', p.status,
          'role_name', upr.role_name
        )
        ORDER BY p.project_name
      ) FILTER (WHERE p.project_id IS NOT NULL),
      '[]'::json
    ) AS assigned_projects
  FROM users u
  LEFT JOIN user_project_roles upr ON upr.user_id = u.user_id
  LEFT JOIN projects p ON p.project_id = upr.project_id
  WHERE u.user_id = $1
  GROUP BY u.user_id, u.employee_name, u.login_name, u.primary_role
`

const USER_MASTER_BY_EMPLOYEE_SQL = `
  SELECT
    id,
    employee_id,
    employee_name,
    responsibility,
    manual_status,
    valid_from,
    valid_to,
    password_hash
  FROM user_master
  WHERE employee_id = $1
  ORDER BY project_id ASC, responsibility ASC
`

export async function login(req, res, next) {
  return handleFieldLogin(req, res, next)
}

export async function portalLogin(req, res, next) {
  return handleLogin(req, res, next, { requirePortalAccess: true })
}

export async function webLogin(req, res, next) {
  try {
    const { login_name, password } = req.validated.body
    const result = await query(
      `
        SELECT
          id,
          employee_id,
          employee_name,
          project_id,
          project_description,
          responsibility,
          manual_status,
          valid_from,
          valid_to,
          password_hash
        FROM responsibility_master
        WHERE employee_id = $1
        ORDER BY project_id ASC, responsibility ASC
      `,
      [login_name],
    )
    const assignments = result.rows

    if (!assignments.length) {
      return res.status(401).json({ message: 'Invalid employee ID or password' })
    }

    const passwordMatches = await verifyFieldPin(password, assignments)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid employee ID or password' })
    }

    const activeAssignments = assignments.filter((assignment) => computeUserMasterStatus(assignment) === 'Active')

    if (!activeAssignments.length) {
      return res.status(403).json({
        errorCode: 'ACCOUNT_INACTIVE',
        message: 'User is deactivated, or no longer in use.',
      })
    }

    const superAdminAssignment = activeAssignments.find((assignment) =>
      String(assignment.responsibility ?? '').trim() === 'Super Admin'
    )

    if (!superAdminAssignment) {
      return res.status(403).json({
        errorCode: 'WEB_ACCESS_DENIED',
        message: 'Unauthorized Access: Web Admin Portal access is strictly restricted to Super Admin accounts.',
      })
    }

    const payload = {
      user_id: String(superAdminAssignment.id),
      userId: String(superAdminAssignment.id),
      employeeId: superAdminAssignment.employee_id,
      employee_id: superAdminAssignment.employee_id,
      login_name: superAdminAssignment.employee_id,
      employeeName: superAdminAssignment.employee_name,
      name: superAdminAssignment.employee_name,
      role: 'Super Admin',
      primary_role: 'Super Admin',
      responsibility: superAdminAssignment.responsibility,
      isActive: true,
      assigned_projects: [],
      assignedProjects: [],
    }

    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    })

    return res.json({
      token,
      user: payload,
    })
  } catch (error) {
    return next(error)
  }
}

export async function resetAdminPassword(req, res, next) {
  try {
    const employeeId = req.validated.body.employee_id
    const password = req.validated.body.password
    const adminResult = await query(
      `
        SELECT id
        FROM responsibility_master
        WHERE employee_id = $1
          AND LOWER(TRIM(responsibility)) = 'super admin'
          AND COALESCE(manual_status, 'Active') <> 'Inactive'
        LIMIT 1
      `,
      [employeeId],
    )

    if (!adminResult.rows.length) {
      return res.status(404).json({
        message: 'No active Super Admin account found for this Employee ID.',
      })
    }

    await query(
      `
        UPDATE responsibility_master
        SET password_hash = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
          AND LOWER(TRIM(responsibility)) = 'super admin'
      `,
      [employeeId, password],
    )

    const hashedPassword = await bcrypt.hash(password, 10)
    await query(
      `
        UPDATE users
        SET password_hash = $2,
            current_pin = $3
        WHERE login_name = $1
      `,
      [employeeId, hashedPassword, password],
    )

    return res.json({
      message: 'Admin password updated successfully. You can login with the new password now.',
    })
  } catch (error) {
    return next(error)
  }
}

async function handleLogin(req, res, next, { requirePortalAccess }) {
  try {
    const { login_name, password } = req.validated.body
    const userResult = await query(USER_BY_LOGIN_NAME_SQL, [login_name])
    const user = userResult.rows[0]

    if (!user) {
      return res.status(404).json({
        errorCode: 'LOGIN_ID_NOT_FOUND',
        message: 'No login ID found.',
      })
    }

    if (!user.is_active) {
      return res.status(403).json({
        errorCode: 'ACCOUNT_DEACTIVATED',
        message: 'User is deactivated, or no longer in use.',
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid employee ID or password' })
    }

    if (requirePortalAccess && !isPortalAdminRole(user.primary_role)) {
      return res.status(403).json({
        errorCode: 'UNAUTHORIZED_PORTAL_ACCESS',
        message: 'Access Denied: Only Administrators can access the Admin Portal.',
      })
    }

    const contextResult = await query(USER_CONTEXT_SQL, [user.user_id])
    const context = contextResult.rows[0]

    const payload = {
      user_id: context.user_id,
      userId: context.user_id,
      employeeId: context.login_name,
      login_name: context.login_name,
      employeeName: context.employee_name,
      name: context.employee_name,
      role: context.primary_role,
      primary_role: context.primary_role,
      isActive: true,
      assigned_projects: context.assigned_projects,
      assignedProjects: context.assigned_projects,
    }

    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    })

    return res.json({
      token,
      user: payload,
    })
  } catch (error) {
    return next(error)
  }
}

function isPortalAdminRole(role) {
  return ['SUPER ADMIN', 'ADMINISTRATOR', 'ADMIN'].includes(String(role ?? '').trim().toUpperCase())
}

async function handleFieldLogin(req, res, next) {
  try {
    const { login_name, password } = req.validated.body
    const userMasterResult = await query(USER_MASTER_BY_EMPLOYEE_SQL, [login_name])
    const assignments = userMasterResult.rows

    if (!assignments.length) {
      return res.status(401).json({ message: 'Invalid Employee ID or PIN.' })
    }

    const activeAssignments = assignments.filter((assignment) => computeUserMasterStatus(assignment) === 'Active')

    if (!activeAssignments.length) {
      return res.status(403).json({
        errorCode: 'ACCOUNT_INACTIVE',
        message: 'User is deactivated, or no longer in use.',
      })
    }

    const fieldAssignment = activeAssignments.find((assignment) =>
      normalizeFieldRole(assignment.responsibility) !== null
    )

    if (!fieldAssignment) {
      return res.status(403).json({
        errorCode: 'UNAUTHORIZED_FIELD_ROLE',
        message: 'Access Denied: This application is restricted to field personnel (SIE/SRE) only.',
      })
    }

    const passwordMatches = await verifyFieldPin(password, activeAssignments)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid Employee ID or PIN.' })
    }

    const role = normalizeFieldRole(fieldAssignment.responsibility)
    const payload = {
      user_id: String(fieldAssignment.id),
      userId: String(fieldAssignment.id),
      employeeId: fieldAssignment.employee_id,
      login_name: fieldAssignment.employee_id,
      employeeName: fieldAssignment.employee_name,
      name: fieldAssignment.employee_name,
      role,
      primary_role: role,
      responsibility: fieldAssignment.responsibility,
      isActive: true,
      assigned_projects: [],
      assignedProjects: [],
    }

    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    })

    return res.json({
      token,
      user: payload,
    })
  } catch (error) {
    return next(error)
  }
}

async function verifyFieldPin(password, assignments) {
  for (const assignment of assignments) {
    const storedPassword = String(assignment.password_hash ?? '')

    if (!storedPassword) {
      continue
    }

    if (storedPassword === password) {
      return true
    }

    try {
      if (await bcrypt.compare(password, storedPassword)) {
        return true
      }
    } catch {
      // Non-bcrypt PIN values are supported for User Master administrative lookup.
    }
  }

  return false
}

function computeUserMasterStatus(user) {
  if (String(user.manual_status ?? '').trim().toLowerCase() === 'inactive') {
    return 'Inactive'
  }

  const validFrom = formatDateOnly(user.valid_from)
  const validTo = formatDateOnly(user.valid_to)

  if (!validFrom && !validTo) {
    return 'Active'
  }

  const currentDate = new Date().toISOString().slice(0, 10)
  const startsOnTime = !validFrom || currentDate >= validFrom
  const endsOnTime = !validTo || currentDate <= validTo

  return startsOnTime && endsOnTime ? 'Active' : 'Inactive'
}

function formatDateOnly(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10) || null
}

function normalizeFieldRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()

  if (normalizedRole === 'SIE' || normalizedRole.includes('(SIE)')) {
    return 'SIE'
  }

  if (
    normalizedRole === 'SRE' ||
    normalizedRole === 'SER' ||
    normalizedRole.includes('(SRE)') ||
    normalizedRole.includes('(SER)') ||
    normalizedRole.includes('SITE RECEIVING')
  ) {
    return 'SRE'
  }

  return null
}
