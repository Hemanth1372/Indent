import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'

const USERS_SELECT_SQL = `
  SELECT user_id, login_name, employee_name, employee_id_str, primary_role, is_active, current_pin, created_at
  FROM users
  ORDER BY created_at DESC
`

const CREATE_USER_SQL = `
  INSERT INTO users (login_name, employee_name, employee_id_str, primary_role, password_hash, is_active, current_pin)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING user_id, login_name, employee_name, employee_id_str, primary_role, is_active, current_pin, created_at
`

const UPDATE_USER_STATUS_SQL = `
  UPDATE users
  SET is_active = $1
  WHERE user_id = $2
  RETURNING user_id, login_name, employee_name, employee_id_str, primary_role, is_active, current_pin, created_at
`

const CHANGE_USER_PASSWORD_SQL = `
  UPDATE users
  SET password_hash = $1,
      current_pin = $2
  WHERE user_id = $3
  RETURNING user_id, login_name, employee_name
`

const SYNC_USER_PIN_SQL = `
  UPDATE users
  SET password_hash = $2,
      current_pin = $3
  WHERE login_name = $1 AND is_active = TRUE
  RETURNING user_id, login_name, employee_name, employee_id_str, primary_role, is_active, current_pin, created_at
`

const DELETE_USER_SQL = `
  DELETE FROM users
  WHERE user_id = $1
  RETURNING user_id, login_name, employee_name, primary_role
`

const LOOKUP_USER_SQL = `
  SELECT employee_name
  FROM users
  WHERE login_name = $1 AND is_active = TRUE
  LIMIT 1
`

function currentPinFromPassword(password) {
  const value = String(password ?? '').trim()
  return /^\d{6}$/.test(value) ? value : null
}

export async function listUsers(_req, res, next) {
  try {
    const result = await query(USERS_SELECT_SQL)
    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

export async function createUser(req, res, next) {
  try {
    const {
      login_name,
      employee_name,
      employee_id_str = null,
      primary_role = null,
      password = 'ncc1234',
      is_active = true,
    } = req.validated.body
    const passwordHash = await bcrypt.hash(password, 12)
    const currentPin = currentPinFromPassword(password)
    const result = await query(CREATE_USER_SQL, [
      login_name,
      employee_name,
      employee_id_str,
      primary_role,
      passwordHash,
      is_active,
      currentPin,
    ])

    return res.status(201).json({
      message: 'User created successfully',
      data: result.rows[0],
      user: result.rows[0],
      default_password: password === 'ncc1234' ? 'ncc1234' : undefined,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with this login name already exists' })
    }

    return next(error)
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.validated.params
    const { is_active } = req.validated.body
    const userToUpdate = await query('SELECT primary_role FROM users WHERE user_id = $1', [userId])

    if (!userToUpdate.rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!is_active && isProtectedAdminRole(userToUpdate.rows[0].primary_role)) {
      return res.status(403).json({ message: 'Super Admin and Administrator users cannot be deactivated' })
    }

    const result = await query(UPDATE_USER_STATUS_SQL, [is_active, userId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      message: is_active ? 'User activated successfully' : 'User deactivated successfully',
      data: result.rows[0],
      user: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

export async function changeUserPassword(req, res, next) {
  try {
    const { userId } = req.validated.params
    const { newPassword } = req.validated.body
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const result = await query(CHANGE_USER_PASSWORD_SQL, [
      passwordHash,
      currentPinFromPassword(newPassword),
      userId,
    ])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      message: 'Password updated successfully',
      user: result.rows[0],
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
    const result = await query(SYNC_USER_PIN_SQL, [
      normalizedLoginName,
      passwordHash,
      current_pin,
    ])

    if (!result.rows[0]) {
      return res.status(404).json({
        errorCode: 'LOGIN_ID_NOT_FOUND',
        message: 'No login ID found.',
      })
    }

    return res.json({
      message: 'PIN synchronized successfully',
      data: result.rows[0],
      user: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.validated.params
    const result = await query(DELETE_USER_SQL, [userId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      message: 'User deleted successfully',
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

function isProtectedAdminRole(role) {
  return ['super admin', 'administrator'].includes(String(role ?? '').toLowerCase())
}
