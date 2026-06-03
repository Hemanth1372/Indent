import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'

const SELECT_COLUMNS = `
  id,
  employee_id,
  employee_name,
  project_id,
  project_description,
  responsibility,
  valid_from,
  valid_to,
  manual_status,
  password_hash,
  created_at,
  updated_at
`

const SEARCHABLE_RESPONSIBILITY_FIELDS = {
  project_id: 'project_id',
  project_description: 'project_description',
  responsibility: 'responsibility',
  employee_id: 'employee_id',
  employee_name: 'employee_name',
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

function computeStatus(row) {
  if (String(row.manual_status ?? '').trim().toLowerCase() === 'inactive') {
    return 'Inactive'
  }

  const validTo = formatDateOnly(row.valid_to)

  if (!validTo) {
    return 'Active'
  }

  const currentDate = new Date().toISOString().slice(0, 10)
  return currentDate <= validTo ? 'Active' : 'Inactive'
}

function normalizeRow(row) {
  const status = computeStatus(row)

  return {
    ...row,
    valid_from: formatDateOnly(row.valid_from),
    valid_to: formatDateOnly(row.valid_to),
    status,
    is_active: status === 'Active',
  }
}

function normalizedPin(value) {
  const pin = String(value ?? '').trim()
  return /^\d{6}$/.test(pin) ? pin : '123456'
}

async function syncLoginUser(row) {
  const pin = normalizedPin(row.password_hash)
  const passwordHash = await bcrypt.hash(pin, 12)
  const isActive = computeStatus(row) === 'Active'

  await query(
    `
      INSERT INTO users (login_name, employee_name, primary_role, password_hash, is_active, current_pin)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (login_name)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        primary_role = EXCLUDED.primary_role,
        password_hash = EXCLUDED.password_hash,
        is_active = EXCLUDED.is_active,
        current_pin = EXCLUDED.current_pin
    `,
    [row.employee_id, row.employee_name, row.responsibility, passwordHash, isActive, pin],
  )
}

async function syncUserMaster(row) {
  await query(
    `
      INSERT INTO user_master (
        employee_id,
        employee_name,
        project_id,
        project_description,
        responsibility,
        valid_from,
        valid_to,
        manual_status,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (employee_id, project_id, responsibility)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        project_description = EXCLUDED.project_description,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        manual_status = EXCLUDED.manual_status,
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      row.employee_id,
      row.employee_name,
      row.project_id,
      row.project_description,
      row.responsibility,
      row.valid_from,
      row.valid_to,
      row.manual_status,
      row.password_hash,
    ],
  )

  await syncLoginUser(row)
}

async function deleteUserMasterAssignment(row) {
  await query(
    `
      DELETE FROM user_master
      WHERE employee_id = $1
        AND project_id = $2
        AND responsibility = $3
    `,
    [row.employee_id, row.project_id, row.responsibility],
  )
}

async function fetchResponsibilityById(id) {
  const result = await query(
    `
      SELECT ${SELECT_COLUMNS}
      FROM responsibility_master
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0] ? normalizeRow(result.rows[0]) : null
}

export async function listResponsibilities(req, res, next) {
  try {
    const requestedPage = Number.parseInt(String(req.query?.page ?? ''), 10)
    const requestedLimit = Number.parseInt(String(req.query?.limit ?? ''), 10)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500)
      : 100
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!Object.prototype.hasOwnProperty.call(SEARCHABLE_RESPONSIBILITY_FIELDS, searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const whereClause = searchField && searchValue
      ? `WHERE ${SEARCHABLE_RESPONSIBILITY_FIELDS[searchField]} ILIKE $1`
      : ''
    const filterParams = searchField && searchValue ? [`%${searchValue}%`] : []
    const countResult = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM responsibility_master
        ${whereClause}
      `,
      filterParams,
    )
    const totalRecords = Number(countResult.rows[0]?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit))
    const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1
    const offset = (currentPage - 1) * limit
    const result = await query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM responsibility_master
        ${whereClause}
        ORDER BY employee_id ASC, project_id ASC, responsibility ASC
        LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
      `,
      [...filterParams, limit, offset],
    )

    return res.json({
      metadata: {
        totalRecords,
        totalPages,
        currentPage,
        limit,
      },
      data: result.rows.map(normalizeRow),
    })
  } catch (error) {
    return next(error)
  }
}

export async function listResponsibilityOptions(_req, res, next) {
  try {
    const result = await query(`
      SELECT DISTINCT responsibility
      FROM responsibility_master
      WHERE responsibility IS NOT NULL AND responsibility <> ''
      ORDER BY responsibility ASC
    `)

    return res.json({ responsibilities: result.rows.map((row) => row.responsibility) })
  } catch (error) {
    return next(error)
  }
}

export async function createResponsibility(req, res, next) {
  try {
    const payload = req.validated.body
    const pin = normalizedPin(payload.password_hash ?? payload.password)
    const result = await query(
      `
        INSERT INTO responsibility_master (
          employee_id,
          employee_name,
          project_id,
          project_description,
          responsibility,
          valid_from,
          valid_to,
          manual_status,
          password_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8)
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        payload.employee_id,
        payload.employee_name,
        payload.project_id,
        payload.project_description,
        payload.responsibility,
        payload.valid_from || null,
        payload.valid_to || null,
        pin,
      ],
    )
    const row = normalizeRow(result.rows[0])

    await syncUserMaster(row)

    return res.status(201).json({
      message: 'Responsibility Master record created successfully',
      data: row,
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function updateResponsibility(req, res, next) {
  try {
    const { id } = req.validated.params
    const previousRow = await fetchResponsibilityById(id)

    if (!previousRow) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const payload = req.validated.body
    const fields = [
      'employee_id',
      'employee_name',
      'project_id',
      'project_description',
      'responsibility',
      'valid_from',
      'valid_to',
      'password_hash',
    ].filter((field) => Object.prototype.hasOwnProperty.call(payload, field))

    const assignments = fields.map((field, index) => `${field} = $${index + 2}`)
    const values = fields.map((field) => {
      if (['valid_from', 'valid_to'].includes(field) && payload[field] === '') {
        return null
      }

      if (field === 'password_hash') {
        return normalizedPin(payload[field])
      }

      return payload[field]
    })
    const result = await query(
      `
        UPDATE responsibility_master
        SET ${assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}
      `,
      [id, ...values],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const row = normalizeRow(result.rows[0])

    if (
      previousRow.employee_id !== row.employee_id ||
      previousRow.project_id !== row.project_id ||
      previousRow.responsibility !== row.responsibility
    ) {
      await deleteUserMasterAssignment(previousRow)
    }

    await syncUserMaster(row)

    return res.json({
      message: 'Responsibility Master record updated successfully',
      data: row,
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function changeResponsibilityPassword(req, res, next) {
  try {
    const { id } = req.validated.params
    const pin = normalizedPin(req.validated.body.password_hash)
    const result = await query(
      `
        UPDATE responsibility_master
        SET password_hash = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}
      `,
      [id, pin],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const row = normalizeRow(result.rows[0])
    await syncUserMaster(row)

    return res.json({
      message: 'PIN updated successfully',
      data: row,
    })
  } catch (error) {
    return next(error)
  }
}

export async function changeResponsibilityRole(req, res, next) {
  try {
    const { id } = req.validated.params
    const previousRow = await fetchResponsibilityById(id)

    if (!previousRow) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const result = await query(
      `
        UPDATE responsibility_master
        SET responsibility = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}
      `,
      [id, req.validated.body.responsibility],
    )
    const row = normalizeRow(result.rows[0])

    if (previousRow.responsibility !== row.responsibility) {
      await deleteUserMasterAssignment(previousRow)
    }

    await syncUserMaster(row)

    return res.json({
      message: 'Role updated successfully',
      data: row,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateResponsibilityStatus(req, res, next) {
  try {
    const { id } = req.validated.params
    const { manual_status } = req.validated.body
    const targetResult = await query(
      `
        SELECT employee_id
        FROM responsibility_master
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    )

    if (!targetResult.rows[0]) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const result = await query(
      `
        UPDATE responsibility_master
        SET manual_status = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
        RETURNING ${SELECT_COLUMNS}
      `,
      [targetResult.rows[0].employee_id, manual_status],
    )

    const rows = result.rows.map(normalizeRow)

    for (const row of rows) {
      await syncUserMaster(row)
    }

    return res.json({
      message: manual_status === 'Active' ? 'User activated successfully' : 'User deactivated successfully',
      data: rows[0],
      users: rows,
    })
  } catch (error) {
    return next(error)
  }
}

export async function deleteResponsibility(req, res, next) {
  try {
    const { id } = req.validated.params
    const result = await query(
      `
        DELETE FROM responsibility_master
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}
      `,
      [id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Responsibility Master record not found' })
    }

    const deletedRow = result.rows[0]
    await deleteUserMasterAssignment(deletedRow)

    const remaining = await query(
      'SELECT 1 FROM responsibility_master WHERE employee_id = $1 LIMIT 1',
      [deletedRow.employee_id],
    )

    if (!remaining.rows[0]) {
      await query('DELETE FROM users WHERE login_name = $1', [deletedRow.employee_id])
    }

    return res.json({
      message: 'Responsibility Master record deleted successfully',
      data: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
}

function handleResponsibilityError(error, res, next) {
  if (error.code === '23505') {
    return res.status(409).json({ message: 'This employee/project/responsibility already exists' })
  }

  return next(error)
}
