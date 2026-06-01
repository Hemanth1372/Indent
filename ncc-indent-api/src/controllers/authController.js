import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'

const USER_BY_LOGIN_NAME_SQL = `
  SELECT user_id, login_name, employee_name, employee_id_str, primary_role, password_hash, is_active
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

export async function login(req, res, next) {
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
      return res.status(401).json({ message: 'Invalid login name or password' })
    }

    const contextResult = await query(USER_CONTEXT_SQL, [user.user_id])
    const context = contextResult.rows[0]

    const payload = {
      user_id: context.user_id,
      userId: context.user_id,
      login_name: context.login_name,
      name: context.employee_name,
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
