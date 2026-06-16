import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'

const USER_BY_LOGIN_NAME_SQL = `
  SELECT user_id, login_name, employee_name, primary_role, password_hash, current_pin, is_active
  FROM users
  WHERE login_name = $1
    AND COALESCE(is_deleted, FALSE) = FALSE
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
          'project_id', pm.id,
          'project_name', COALESCE(pm.project_description, rm.project_description),
          'location', rm.project_id,
          'status', COALESCE(rm.manual_status, 'Active'),
          'role_name', rm.responsibility
        )
        ORDER BY COALESCE(pm.project_description, rm.project_description)
      ) FILTER (WHERE rm.id IS NOT NULL),
      '[]'::json
    ) AS assigned_projects
  FROM users u
  LEFT JOIN responsibility_master rm ON rm.employee_id = u.login_name
  LEFT JOIN project_master pm ON pm.project_code = rm.project_id
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
    created_at
  FROM responsibility_master
  WHERE employee_id = $1
  ORDER BY created_at DESC NULLS LAST, project_id ASC, responsibility ASC
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
    const userResult = await query(USER_BY_LOGIN_NAME_SQL, [login_name])
    const loginUser = userResult.rows[0]

    if (!loginUser) {
      return res.status(401).json({ message: 'Invalid employee ID or password' })
    }

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
          valid_to
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

    const passwordMatches = await verifyUserPin(password, loginUser)

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

    const adminAssignment = activeAssignments.find((assignment) => normalizePortalRole(assignment.responsibility))
    const fieldAssignments = activeAssignments.filter((assignment) => normalizeFieldRole(assignment.responsibility))
    const fieldAssignment = fieldAssignments.find((assignment) =>
      normalizeFieldRole(assignment.responsibility) === normalizeFieldRole(loginUser.primary_role)
    ) ?? fieldAssignments[0]

    if (!adminAssignment && !fieldAssignment) {
      return res.status(403).json({
        errorCode: 'WEB_ACCESS_DENIED',
        message: 'Unauthorized Access: Web access is restricted to Admin, Site Engineer, and Service Engineer accounts.',
      })
    }

    const isAdminSession = Boolean(adminAssignment)
    const selectedAssignment = adminAssignment ?? fieldAssignment
    const role = isAdminSession
      ? normalizePortalRole(selectedAssignment.responsibility)
      : normalizeFieldRole(selectedAssignment.responsibility)
    const assignedProjects = (isAdminSession ? activeAssignments : fieldAssignments).map((assignment) => ({
      project_id: assignment.project_id,
      project_name: assignment.project_description,
      location: assignment.project_id,
      status: computeUserMasterStatus(assignment),
      role_name: assignment.responsibility,
    }))

    if (role && role !== loginUser.primary_role) {
      await query(
        'UPDATE users SET primary_role = $2 WHERE login_name = $1',
        [login_name, role],
      )
    }

    const payload = {
      user_id: String(loginUser.user_id),
      userId: String(loginUser.user_id),
      employeeId: selectedAssignment.employee_id,
      employee_id: selectedAssignment.employee_id,
      login_name: selectedAssignment.employee_id,
      employeeName: selectedAssignment.employee_name,
      name: selectedAssignment.employee_name,
      role,
      primary_role: role,
      responsibility: selectedAssignment.responsibility,
      access_scope: isAdminSession ? 'admin' : 'field',
      isActive: true,
      assigned_projects: assignedProjects,
      assignedProjects: assignedProjects,
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

    const passwordMatches = await verifyUserPin(password, user)

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
  return Boolean(normalizePortalRole(role))
}

function normalizePortalRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase()

  if (normalizedRole === 'SUPER ADMIN' || normalizedRole.includes('SUPER ADMIN')) {
    return 'Super Admin'
  }

  if (normalizedRole === 'ADMINISTRATOR' || normalizedRole.includes('ADMINISTRATOR')) {
    return 'Administrator'
  }

  if (normalizedRole === 'ADMIN' || normalizedRole.startsWith('ADMIN ') || normalizedRole.includes('(ADMIN)')) {
    return 'Admin'
  }

  return null
}

async function handleFieldLogin(req, res, next) {
  try {
    const { login_name, password } = req.validated.body
    const loginUserResult = await query(USER_BY_LOGIN_NAME_SQL, [login_name])
    const loginUser = loginUserResult.rows[0]

    if (!loginUser) {
      return res.status(401).json({ message: 'Invalid Employee ID or PIN.' })
    }

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

    const hasFieldRole = activeAssignments.some((assignment) =>
      normalizeFieldRole(assignment.responsibility) !== null
    )

    if (!hasFieldRole) {
      return res.status(403).json({
        errorCode: 'UNAUTHORIZED_FIELD_ROLE',
        message: 'Access Denied: This application is restricted to field personnel (SIE/SER) only.',
      })
    }

    const passwordMatches = await verifyUserPin(password, loginUser)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid Employee ID or PIN.' })
    }

    // Use primary_role from users table as the authoritative role (set by explicit admin actions).
    // Verify it's backed by an active assignment to guard against stale data.
    // Fall back to most-recently-created field assignment (created_at DESC ordering).
    const primaryRole = normalizeFieldRole(loginUser.primary_role)
    const activeFieldAssignments = activeAssignments.filter((a) => normalizeFieldRole(a.responsibility) !== null)
    const hasPrimaryRoleAssignment = primaryRole
      ? activeFieldAssignments.some((a) => normalizeFieldRole(a.responsibility) === primaryRole)
      : false
    const fieldAssignment = hasPrimaryRoleAssignment
      ? (activeFieldAssignments.find((a) => normalizeFieldRole(a.responsibility) === primaryRole) ?? activeFieldAssignments[0])
      : activeFieldAssignments[0]
    const role = normalizeFieldRole(fieldAssignment.responsibility)

    if (role && role !== primaryRole) {
      await query(
        'UPDATE users SET primary_role = $2 WHERE login_name = $1',
        [login_name, role],
      )
    }

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

async function verifyUserPin(password, user) {
  const plainPin = String(user.current_pin ?? '').trim()

  if (plainPin && plainPin === password) {
    return true
  }

  const storedPassword = String(user.password_hash ?? '')

  if (!storedPassword) {
    return false
  }

  if (/^\d{6}$/.test(storedPassword.trim())) {
    return storedPassword.trim() === password
  }

  try {
    return bcrypt.compare(password, storedPassword)
  } catch {
    return false
  }
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

  if (
    normalizedRole === 'SIE' ||
    normalizedRole === 'STE' ||
    normalizedRole.includes('(SIE)') ||
    normalizedRole.includes('(STE)') ||
    normalizedRole.includes('SITE ENGINEER') ||
    normalizedRole.includes('STE ENGINEER') ||
    normalizedRole.includes('SITE INCHARGE ENGINEER') ||
    normalizedRole.includes('SITE IN-CHARGE ENGINEER') ||
    normalizedRole.includes('SITE IN CHARGE ENGINEER')
  ) {
    return 'SIE'
  }

  if (
    normalizedRole === 'SRE' ||
    normalizedRole === 'SER' ||
    normalizedRole.includes('(SRE)') ||
    normalizedRole.includes('(SER)') ||
    normalizedRole.includes('SITE RECEIVING') ||
    normalizedRole.includes('SERVICE ENGINEER')
  ) {
    return 'SER'
  }

  return null
}
