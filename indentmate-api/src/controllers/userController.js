import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'

const USER_MASTER_SELECT_SQL = `
  SELECT
    rm.id,
    rm.id::text AS user_id,
    rm.employee_id,
    rm.employee_id AS login_name,
    rm.employee_name,
    rm.project_id,
    rm.project_description,
    rm.responsibility,
    rm.responsibility AS primary_role,
    rm.valid_from,
    rm.valid_to,
    rm.manual_status,
    u.current_pin AS password_hash,
    u.current_pin,
    rm.created_at,
    rm.updated_at
  FROM responsibility_master rm
  LEFT JOIN users u ON u.login_name = rm.employee_id
  ORDER BY rm.employee_id ASC, rm.project_id ASC, rm.responsibility ASC
`

const USER_MASTER_RETURNING_SQL = `
  id,
  id::text AS user_id,
  employee_id,
  employee_id AS login_name,
  employee_name,
  project_id,
  project_description,
  responsibility,
  responsibility AS primary_role,
  valid_from,
  valid_to,
  manual_status,
  created_at,
  updated_at
`

const CREATE_USER_MASTER_SQL = `
  INSERT INTO responsibility_master (
    employee_id,
    employee_name,
    project_id,
    project_description,
    responsibility,
    valid_from,
    valid_to,
    manual_status
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING ${USER_MASTER_RETURNING_SQL}
`

const UPDATE_USER_MASTER_STATUS_SQL = `
  UPDATE responsibility_master
  SET manual_status = $1,
      updated_at = CURRENT_TIMESTAMP
  WHERE employee_id = $2
  RETURNING ${USER_MASTER_RETURNING_SQL}
`

const UPDATE_USER_MASTER_ROLE_SQL = `
  UPDATE responsibility_master
  SET responsibility = $1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $2
  RETURNING ${USER_MASTER_RETURNING_SQL}
`

const CHANGE_USER_MASTER_PASSWORD_SQL = `
  SELECT ${USER_MASTER_RETURNING_SQL}
  FROM responsibility_master
  WHERE id = $1
`

const DELETE_USER_MASTER_SQL = `
  DELETE FROM responsibility_master
  WHERE id = $1
  RETURNING id, employee_id, employee_name, responsibility
`

const LOOKUP_USER_SQL = `
  SELECT employee_name
  FROM users
  WHERE login_name = $1 AND is_active = TRUE
  LIMIT 1
`

const USER_MASTER_SEARCH_FIELDS = {
  employee_id: 'employee_id',
  employee_name: 'employee_name',
  project_id: 'project_id',
  project_description: 'project_description',
  responsibility: 'responsibility',
  manual_status: 'manual_status',
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

function computeStatus(user, today = new Date()) {
  if (String(user.manual_status ?? '').toLowerCase() === 'inactive') {
    return 'Inactive'
  }

  const validFrom = formatDateOnly(user.valid_from)
  const validTo = formatDateOnly(user.valid_to)

  if (!validFrom && !validTo) {
    return 'Active'
  }

  const currentDate = today.toISOString().slice(0, 10)
  const startsOnTime = !validFrom || currentDate >= validFrom
  const endsOnTime = !validTo || currentDate <= validTo

  return startsOnTime && endsOnTime ? 'Active' : 'Inactive'
}

function normalizeUser(row) {
  const status = computeStatus(row)

  return {
    ...row,
    valid_from: formatDateOnly(row.valid_from),
    valid_to: formatDateOnly(row.valid_to),
    status,
    is_active: status === 'Active',
  }
}

function currentPinFromPassword(password) {
  const value = String(password ?? '').trim()
  return /^\d{6}$/.test(value) ? value : '123456'
}

async function upsertLoginUser({ employee_id, employee_name, responsibility, password }) {
  const pin = currentPinFromPassword(password)
  const passwordHash = await bcrypt.hash(pin, 12)

  await query(
    `
      INSERT INTO users (login_name, employee_name, primary_role, password_hash, is_active, current_pin)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      ON CONFLICT (login_name)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        primary_role = EXCLUDED.primary_role,
        password_hash = EXCLUDED.password_hash,
        current_pin = EXCLUDED.current_pin
    `,
    [employee_id, employee_name, responsibility, passwordHash, pin],
  )
}

export async function listUsers(req, res, next) {
  try {
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()

    if (!searchField || !searchValue) {
      const result = await query(USER_MASTER_SELECT_SQL)
      return res.json({ data: result.rows.map(normalizeUser) })
    }

    if (searchField === 'status') {
      const result = await query(USER_MASTER_SELECT_SQL)
      const normalizedSearchValue = searchValue.toLowerCase()
      const users = result.rows
        .map(normalizeUser)
        .filter((user) => user.status.toLowerCase() === normalizedSearchValue)

      return res.json({ data: users })
    }

    const columnName = USER_MASTER_SEARCH_FIELDS[searchField]

    if (!columnName) {
      return res.status(400).json({ message: 'Invalid User Master filter field' })
    }

    const result = await query(
      `
        SELECT
          rm.id,
          rm.id::text AS user_id,
          rm.employee_id,
          rm.employee_id AS login_name,
          rm.employee_name,
          rm.project_id,
          rm.project_description,
          rm.responsibility,
          rm.responsibility AS primary_role,
          rm.valid_from,
          rm.valid_to,
          rm.manual_status,
          u.current_pin AS password_hash,
          u.current_pin,
          rm.created_at,
          rm.updated_at
        FROM responsibility_master rm
        LEFT JOIN users u ON u.login_name = rm.employee_id
        WHERE rm.${columnName} ILIKE $1
        ORDER BY rm.employee_id ASC, rm.project_id ASC, rm.responsibility ASC
      `,
      [`%${searchValue}%`],
    )

    return res.json({ data: result.rows.map(normalizeUser) })
  } catch (error) {
    return next(error)
  }
}

export async function createUser(req, res, next) {
  try {
    const {
      employee_id,
      employee_name,
      project_id,
      project_description,
      responsibility,
      valid_from = null,
      valid_to = null,
      manual_status = 'Active',
      password = '123456',
    } = req.validated.body
    const pin = currentPinFromPassword(password)
    const result = await query(CREATE_USER_MASTER_SQL, [
      employee_id,
      employee_name,
      project_id,
      project_description,
      responsibility,
      valid_from,
      valid_to,
      manual_status,
    ])

    await upsertLoginUser({
      employee_id,
      employee_name,
      responsibility,
      password: pin,
    })

    return res.status(201).json({
      message: 'User Master record created successfully',
      data: normalizeUser(result.rows[0]),
      user: normalizeUser(result.rows[0]),
      default_password: pin,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'This employee/project/responsibility already exists' })
    }

    return next(error)
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { employeeId } = req.validated.params
    const { manual_status } = req.validated.body
    const result = await query(UPDATE_USER_MASTER_STATUS_SQL, [manual_status, employeeId])

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const users = result.rows.map(normalizeUser)

    await query(
      'UPDATE users SET is_active = $1 WHERE login_name = $2',
      [manual_status === 'Active', employeeId],
    )

    return res.json({
      message: manual_status === 'Active' ? 'User activated successfully' : 'User deactivated successfully',
      data: users[0],
      users,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.validated.params
    const { responsibility } = req.validated.body
    const result = await query(UPDATE_USER_MASTER_ROLE_SQL, [responsibility, userId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const user = normalizeUser(result.rows[0])
    await query(
      'UPDATE users SET primary_role = $1 WHERE login_name = $2',
      [responsibility, user.employee_id],
    )

    return res.json({
      message: 'Responsibility updated successfully',
      data: user,
      user,
    })
  } catch (error) {
    return next(error)
  }
}

export async function changeUserPassword(req, res, next) {
  try {
    const { userId } = req.validated.params
    const { newPassword } = req.validated.body
    const pin = currentPinFromPassword(newPassword)
    const result = await query(CHANGE_USER_MASTER_PASSWORD_SQL, [userId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const user = normalizeUser(result.rows[0])
    const passwordHash = await bcrypt.hash(pin, 12)
    await query(
      'UPDATE users SET password_hash = $1, current_pin = $2 WHERE login_name = $3',
      [passwordHash, pin, user.employee_id],
    )

    return res.json({
      message: 'PIN updated successfully',
      data: user,
      user,
    })
  } catch (error) {
    return next(error)
  }
}

export async function syncUserPin(req, res, next) {
  try {
    const { login_name, current_pin } = req.validated.body
    const normalizedLoginName = login_name.trim()
    const passwordHash = await bcrypt.hash(current_pin, 12)
    const userResult = await query(
      `
        UPDATE users
        SET password_hash = $2,
            current_pin = $3
        WHERE login_name = $1 AND is_active = TRUE
        RETURNING user_id, login_name, login_name AS employee_id, employee_name, primary_role, is_active, current_pin, current_pin AS password_hash, created_at
      `,
      [normalizedLoginName, passwordHash, current_pin],
    )

    if (!userResult.rows[0]) {
      return res.status(404).json({
        errorCode: 'LOGIN_ID_NOT_FOUND',
        message: 'No login ID found.',
      })
    }

    return res.json({
      message: 'PIN synchronized successfully',
      data: userResult.rows[0],
      user: userResult.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.validated.params
    const result = await query(DELETE_USER_MASTER_SQL, [userId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const remaining = await query(
      'SELECT 1 FROM responsibility_master WHERE employee_id = $1 LIMIT 1',
      [result.rows[0].employee_id],
    )

    if (!remaining.rows[0]) {
      await query('DELETE FROM users WHERE login_name = $1', [result.rows[0].employee_id])
    }

    return res.json({
      message: 'User Master record deleted successfully',
      user: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

export async function lookupUser(req, res, next) {
  try {
    const { loginName } = req.validated.params
    const result = await query(LOOKUP_USER_SQL, [loginName])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({ employeeName: result.rows[0].employee_name })
  } catch (error) {
    return next(error)
  }
}
