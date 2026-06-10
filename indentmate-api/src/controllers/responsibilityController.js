import bcrypt from 'bcryptjs'
import ExcelJS from 'exceljs'
import xlsx from 'xlsx'
import { pool, query } from '../db/pool.js'

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
  created_at,
  updated_at
`

const SEARCHABLE_RESPONSIBILITY_FIELDS = {
  employee_id: 'u.login_name',
  employee_name: 'u.employee_name',
}

function parseFilterQuery(rawFilters) {
  if (!rawFilters) {
    return []
  }

  try {
    const parsedFilters = typeof rawFilters === 'string' ? JSON.parse(rawFilters) : rawFilters

    if (!Array.isArray(parsedFilters)) {
      return []
    }

    return parsedFilters
      .map((filter) => ({
        field: String(filter?.field ?? '').trim(),
        value: String(filter?.value ?? '').trim(),
      }))
      .filter((filter) => filter.field && filter.value)
  } catch {
    return null
  }
}

function buildResponsibilityFilters(filters) {
  const whereConditions = ['COALESCE(u.is_deleted, FALSE) = FALSE']
  const params = []

  for (const filter of filters) {
    const columnName = SEARCHABLE_RESPONSIBILITY_FIELDS[filter.field]

    if (!columnName) {
      const error = new Error('Invalid filter field')
      error.statusCode = 400
      throw error
    }

    params.push(`%${filter.value}%`)
    whereConditions.push(`${columnName} ILIKE $${params.length}`)
  }

  return { whereConditions, params }
}

const RESPONSIBILITY_IMPORT_COLUMNS = [
  { label: 'Employee Id', excelHeader: 'Employee ID', dbColumn: 'employee_id', type: 'string', isReadOnly: true },
  { label: 'Employee Name', excelHeader: 'Employee Name', dbColumn: 'employee_name', type: 'string' },
  { label: 'Project Id', excelHeader: 'Project ID', dbColumn: 'project_id', type: 'string' },
  { label: 'Project Desc', excelHeader: 'Project Description', dbColumn: 'project_description', type: 'text' },
  { label: 'Responsibility', excelHeader: 'Responsibility', dbColumn: 'responsibility', type: 'string' },
  { label: 'Valid From', excelHeader: 'Valid From', dbColumn: 'valid_from', type: 'date' },
  { label: 'Valid To', excelHeader: 'Valid To', dbColumn: 'valid_to', type: 'date' },
]

const RESPONSIBILITY_REQUIRED_HEADERS = ['Employee ID', 'Employee Name', 'Project ID', 'Project Description', 'Responsibility']

function formatDateOnly(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10) ||   null
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

function responsibilityCompositeKey(row) {
  return [
    String(row.employee_id ?? '').trim(),
    String(row.project_id ?? '').trim(),
    String(row.responsibility ?? '').trim(),
  ].join('|')
}

function parseResponsibilityFieldsMapping(value) {
  if (!value) {
    return Object.fromEntries(RESPONSIBILITY_IMPORT_COLUMNS.map((column) => [column.excelHeader, true]))
  }

  try {
    const parsed = JSON.parse(value)
    return Object.fromEntries(
      RESPONSIBILITY_IMPORT_COLUMNS.map((column) => [
        column.excelHeader,
        column.excelHeader === 'Employee ID' || Boolean(parsed[column.excelHeader]),
      ]),
    )
  } catch {
    throwBadRequest('Invalid fieldsMapping payload')
  }
}

function parseResponsibilityWorkbook(file) {
  const workbook = xlsx.read(file.buffer, {
    type: 'buffer',
    raw: true,
    cellDates: true,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throwBadRequest('Import file does not contain a worksheet')
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    blankrows: false,
  })

  if (!rows.length) {
    throwBadRequest('Spreadsheet contains no data')
  }

  const headers = new Set(Object.keys(rows[0] ?? {}).map((header) => String(header).trim()))
  const missingHeader = RESPONSIBILITY_REQUIRED_HEADERS.find((header) => !headers.has(header))

  if (missingHeader) {
    throwBadRequest(`Invalid template. Required column: ${missingHeader}`)
  }

  return rows
    .map((row) => ({
      employee_id: cleanString(row['Employee ID']),
      employee_name: cleanString(row['Employee Name']),
      project_id: cleanString(row['Project ID']),
      project_description: cleanString(row['Project Description']),
      responsibility: cleanString(row.Responsibility),
      valid_from: cleanDate(row['Valid From']),
      valid_to: cleanDate(row['Valid To']),
    }))
    .filter((row) => Object.values(row).some((value) => value !== null && value !== ''))
}

function buildResponsibilityInsertRow(row, fieldsMapping) {
  return {
    employee_id: row.employee_id,
    employee_name: fieldsMapping['Employee Name'] ? row.employee_name : '',
    project_id: fieldsMapping['Project ID'] ? row.project_id : '',
    project_description: fieldsMapping['Project Description'] ? row.project_description : '',
    responsibility: fieldsMapping.Responsibility ? row.responsibility : '',
    valid_from: fieldsMapping['Valid From'] ? row.valid_from : null,
    valid_to: fieldsMapping['Valid To'] ? row.valid_to : null,
    manual_status: 'Active',
  }
}

function buildResponsibilityUpdate(row, existingRow, fieldsMapping) {
  const fields = [
    ['Employee Name', 'employee_name'],
    ['Project Description', 'project_description'],
    ['Valid From', 'valid_from'],
    ['Valid To', 'valid_to'],
  ]
  const assignments = []
  const values = []
  const nextRow = {
    employee_name: existingRow.employee_name,
    project_description: existingRow.project_description,
    valid_from: formatDateOnly(existingRow.valid_from),
    valid_to: formatDateOnly(existingRow.valid_to),
  }

  for (const [excelHeader, dbColumn] of fields) {
    if (!fieldsMapping[excelHeader]) {
      continue
    }

    const nextValue = row[dbColumn]
    nextRow[dbColumn] = nextValue
    const currentValue = ['valid_from', 'valid_to'].includes(dbColumn)
      ? formatDateOnly(existingRow[dbColumn])
      : cleanString(existingRow[dbColumn])
    const nextComparable = nextValue === null ? '' : String(nextValue).trim()
    const currentComparable = currentValue === null ? '' : String(currentValue).trim()

    if (nextComparable !== currentComparable) {
      values.push(nextValue)
      assignments.push(`${dbColumn} = $${values.length}`)
    }
  }

  if (!assignments.length) {
    return null
  }

  return {
    id: existingRow.id,
    employee_id: existingRow.employee_id,
    assignments,
    nextRow,
    values,
  }
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function cleanDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsedDate = xlsx.SSF.parse_date_code(value)
    if (parsedDate) {
      return `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`
    }
  }

  const textValue = String(value).trim()
  const isoMatch = textValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const slashMatch = textValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashMatch) {
    const first = Number(slashMatch[1])
    const second = Number(slashMatch[2])
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    const day = first > 12 ? first : second
    const month = first > 12 ? second : first
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const parsed = new Date(textValue)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function throwBadRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  throw error
}

async function syncLoginUser(row) {
  const rawPin = String(row.password_hash ?? '').trim()
  const hasProvidedPin = /^\d{6}$/.test(rawPin)
  const pin = hasProvidedPin ? rawPin : '123456'
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
        is_active = EXCLUDED.is_active
        ${hasProvidedPin ? ', password_hash = EXCLUDED.password_hash, current_pin = EXCLUDED.current_pin' : ''}
    `,
    [row.employee_id, row.employee_name, row.responsibility, passwordHash, isActive, pin],
  )
}

async function syncUserMaster(row) {
  await syncLoginUser(row)
}

async function bulkInsertResponsibilities(client, rows) {
  await client.query(
    `
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
      SELECT *
      FROM UNNEST(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::text[],
        $6::date[],
        $7::date[],
        $8::text[]
      )
    `,
    [
      rows.map((row) => row.employee_id),
      rows.map((row) => row.employee_name),
      rows.map((row) => row.project_id),
      rows.map((row) => row.project_description),
      rows.map((row) => row.responsibility),
      rows.map((row) => row.valid_from),
      rows.map((row) => row.valid_to),
      rows.map((row) => row.manual_status),
    ],
  )
}

async function bulkUpdateResponsibilities(client, updates) {
  await client.query(
    `
      UPDATE responsibility_master AS rm
      SET employee_name = incoming.employee_name,
          project_description = incoming.project_description,
          valid_from = incoming.valid_from,
          valid_to = incoming.valid_to,
          updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT *
        FROM UNNEST(
          $1::int[],
          $2::text[],
          $3::text[],
          $4::date[],
          $5::date[]
        ) AS data(id, employee_name, project_description, valid_from, valid_to)
      ) AS incoming
      WHERE rm.id = incoming.id
    `,
    [
      updates.map((update) => update.id),
      updates.map((update) => update.nextRow.employee_name),
      updates.map((update) => update.nextRow.project_description),
      updates.map((update) => update.nextRow.valid_from),
      updates.map((update) => update.nextRow.valid_to),
    ],
  )
}

async function syncUserMasters(rows) {
  if (!rows.length) {
    return
  }

  const uniqueRows = [
    ...new Map(rows.map((row) => [responsibilityCompositeKey(row), row])).values(),
  ]
  await syncLoginUsers(uniqueRows)
}

async function syncLoginUsers(rows) {
  if (!rows.length) {
    return
  }

  const latestRowsByEmployee = new Map()
  for (const row of rows) {
    latestRowsByEmployee.set(row.employee_id, row)
  }

  const loginRows = [...latestRowsByEmployee.values()]
  const hashByPin = new Map()

  for (const row of loginRows) {
    const pin = normalizedPin(row.password_hash)
    if (!hashByPin.has(pin)) {
      hashByPin.set(pin, await bcrypt.hash(pin, 12))
    }
  }

  await query(
    `
      INSERT INTO users (login_name, employee_name, primary_role, password_hash, is_active, current_pin)
      SELECT *
      FROM UNNEST(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::boolean[],
        $6::text[]
      )
      ON CONFLICT (login_name)
      DO UPDATE SET
        employee_name = EXCLUDED.employee_name,
        primary_role = EXCLUDED.primary_role,
        is_active = EXCLUDED.is_active
    `,
    [
      loginRows.map((row) => row.employee_id),
      loginRows.map((row) => row.employee_name),
      loginRows.map((row) => row.responsibility),
      loginRows.map((row) => hashByPin.get(normalizedPin(row.password_hash))),
      loginRows.map((row) => computeStatus(row) === 'Active'),
      loginRows.map((row) => normalizedPin(row.password_hash)),
    ],
  )
}

async function deleteUserMasterAssignment(row) {
  return row
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
    const parsedFilters = parseFilterQuery(req.query?.filters)

    if (parsedFilters === null) {
      return res.status(400).json({ message: 'Invalid filter payload' })
    }

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!Object.prototype.hasOwnProperty.call(SEARCHABLE_RESPONSIBILITY_FIELDS, searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const activeFilters = parsedFilters.length > 0
      ? parsedFilters
      : searchField && searchValue
        ? [{ field: searchField, value: searchValue }]
        : []
    const { whereConditions, params: filterParams } = buildResponsibilityFilters(activeFilters)
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`
    const countResult = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM users u
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
        SELECT
          COALESCE(MIN(rm.id), 0) AS id,
          u.login_name AS employee_id,
          u.employee_name,
          NULL::text AS project_id,
          NULL::text AS project_description,
          u.primary_role AS responsibility,
          NULL::date AS valid_from,
          NULL::date AS valid_to,
          CASE WHEN u.is_active THEN 'Active' ELSE 'Inactive' END AS manual_status,
          COALESCE(u.current_pin, '123456') AS password_hash,
          CASE WHEN u.is_active THEN 'Active' ELSE 'Inactive' END AS status,
          COUNT(rm.id)::int AS assignment_count
        FROM users u
        LEFT JOIN responsibility_master rm ON rm.employee_id = u.login_name
        ${whereClause}
        GROUP BY u.login_name, u.employee_name, u.primary_role, u.is_active, u.current_pin
        ORDER BY u.login_name ASC
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
      data: result.rows.map((row) => ({
        ...row,
        id: row.id === 0 ? row.employee_id : row.id,
        is_active: row.status === 'Active',
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function listResponsibilityFilterOptions(req, res, next) {
  try {
    const field = String(req.query?.field ?? '').trim()
    const columnName = SEARCHABLE_RESPONSIBILITY_FIELDS[field]

    if (!columnName) {
      return res.status(400).json({ message: 'Invalid filter field' })
    }

    const result = await query(
      `
        SELECT DISTINCT
          ${columnName}::TEXT AS value,
          CASE
            WHEN $1 = 'employee_id' THEN u.employee_name::TEXT
            ELSE u.login_name::TEXT
          END AS description
        FROM users u
        WHERE COALESCE(u.is_deleted, FALSE) = FALSE
          AND ${columnName} IS NOT NULL
          AND TRIM(${columnName}::TEXT) <> ''
        ORDER BY value ASC
        LIMIT 500
      `,
      [field],
    )

    return res.json({
      data: result.rows.map((row) => ({
        value: row.value,
        label: row.description && row.description !== row.value ? `${row.value} (${row.description})` : row.value,
      })),
    })
  } catch (error) {
    return next(error)
  }
}

export async function listUserProjectAssignments(req, res, next) {
  try {
    const employeeId = String(req.params.employeeId ?? '').trim()
    const result = await query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM responsibility_master
        WHERE employee_id = $1
        ORDER BY project_id ASC, responsibility ASC
      `,
      [employeeId],
    )

    return res.json({ data: result.rows.map(normalizeRow) })
  } catch (error) {
    return next(error)
  }
}

export async function createUserMaster(req, res, next) {
  try {
    const payload = req.validated.body
    const pin = normalizedPin(payload.password_hash ?? payload.password)
    const passwordHash = await bcrypt.hash(pin, 12)
    const result = await query(
      `
        INSERT INTO users (login_name, employee_name, primary_role, password_hash, is_active, current_pin)
        VALUES ($1, $2, NULL, $3, TRUE, $4)
        ON CONFLICT (login_name)
        DO UPDATE SET
          employee_name = EXCLUDED.employee_name,
          password_hash = EXCLUDED.password_hash,
          current_pin = EXCLUDED.current_pin,
          is_active = TRUE,
          is_deleted = FALSE
        RETURNING login_name AS employee_id, employee_name, current_pin AS password_hash, is_active
      `,
      [payload.employee_id, payload.employee_name, passwordHash, pin],
    )

    return res.status(201).json({
      message: 'User Master record created successfully',
      data: {
        ...result.rows[0],
        id: result.rows[0].employee_id,
        status: result.rows[0].is_active ? 'Active' : 'Inactive',
        manual_status: result.rows[0].is_active ? 'Active' : 'Inactive',
        assignment_count: 0,
      },
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function updateUserMaster(req, res, next) {
  try {
    const employeeId = req.validated.params.employeeId
    const payload = req.validated.body
    const fields = []
    const values = []

    if (payload.employee_name !== undefined) {
      values.push(payload.employee_name)
      fields.push(`employee_name = $${values.length}`)
    }

    if (payload.password_hash !== undefined || payload.password !== undefined) {
      const pin = normalizedPin(payload.password_hash ?? payload.password)
      values.push(await bcrypt.hash(pin, 12))
      fields.push(`password_hash = $${values.length}`)
      values.push(pin)
      fields.push(`current_pin = $${values.length}`)
    }

    if (!fields.length) {
      return res.status(400).json({ message: 'No editable fields were provided' })
    }

    const result = await query(
      `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE login_name = $${values.length + 1}
        RETURNING login_name AS employee_id, employee_name, current_pin AS password_hash, is_active
      `,
      [...values, employeeId],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    await query(
      `
        UPDATE responsibility_master
        SET employee_name = $2,
            password_hash = COALESCE($3, password_hash),
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
      `,
      [employeeId, result.rows[0].employee_name, result.rows[0].password_hash],
    )

    return res.json({
      message: 'User Master record updated successfully',
      data: {
        ...result.rows[0],
        id: result.rows[0].employee_id,
        status: result.rows[0].is_active ? 'Active' : 'Inactive',
        manual_status: result.rows[0].is_active ? 'Active' : 'Inactive',
      },
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function updateUserMasterStatus(req, res, next) {
  try {
    const employeeId = req.validated.params.employeeId
    const { manual_status } = req.validated.body
    const isActive = manual_status === 'Active'
    const result = await query(
      `
        UPDATE users
        SET is_active = $2
        WHERE login_name = $1
        RETURNING login_name AS employee_id, employee_name, current_pin AS password_hash, is_active
      `,
      [employeeId, isActive],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    await query(
      `
        UPDATE responsibility_master
        SET manual_status = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
      `,
      [employeeId, manual_status],
    )

    return res.json({
      message: isActive ? 'User activated successfully' : 'User deactivated successfully',
      data: {
        ...result.rows[0],
        id: result.rows[0].employee_id,
        status: manual_status,
        manual_status,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function createUserProjectAssignment(req, res, next) {
  try {
    const employeeId = req.validated.params.employeeId
    const payload = req.validated.body
    const userResult = await query(
      `
        SELECT login_name, employee_name, current_pin
        FROM users
        WHERE login_name = $1
        LIMIT 1
      `,
      [employeeId],
    )

    if (!userResult.rows[0]) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const user = userResult.rows[0]
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
          manual_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
        RETURNING ${SELECT_COLUMNS}
      `,
      [
        user.login_name,
        user.employee_name,
        payload.project_id,
        payload.project_description,
        payload.responsibility,
        payload.valid_from || null,
        payload.valid_to || null,
      ],
    )
    const row = normalizeRow(result.rows[0])

    await syncUserMaster(row)

    return res.status(201).json({
      message: 'Project assignment created successfully',
      data: row,
    })
  } catch (error) {
    return handleResponsibilityError(error, res, next)
  }
}

export async function listResponsibilityOptions(_req, res, next) {
  try {
    const result = await query(`
      SELECT
        role_name,
        COALESCE(NULLIF(description, ''), role_name) AS responsibility
      FROM role_master
      ORDER BY COALESCE(NULLIF(description, ''), role_name) ASC
    `)

    return res.json({
      responsibilities: result.rows.map((row) => row.responsibility),
      roles: result.rows,
    })
  } catch (error) {
    return next(error)
  }
}

export async function importResponsibilities(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: 'Responsibility import file is required' })
  }

  try {
    const fieldsMapping = parseResponsibilityFieldsMapping(req.body?.fieldsMapping)
    const sheetRows = parseResponsibilityWorkbook(req.file)
    const employeeIds = [...new Set(sheetRows.map((row) => row.employee_id).filter(Boolean))]

    if (!employeeIds.length) {
      return res.status(400).json({ message: 'Uploaded sheet contains no Employee ID values' })
    }

    const existingResult = await query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM responsibility_master
        WHERE employee_id = ANY($1)
      `,
      [employeeIds],
    )
    const existingRows = new Map(existingResult.rows.map((row) => [responsibilityCompositeKey(row), normalizeRow(row)]))
    const processedKeys = new Set()
    const inserts = []
    const updates = []
    const unchangedRows = []
    const changedRowsForSync = []

    for (const row of sheetRows) {
      const key = responsibilityCompositeKey(row)

      if (!row.employee_id || !row.project_id || !row.responsibility || processedKeys.has(key)) {
        continue
      }

      processedKeys.add(key)
      const existingRow = existingRows.get(key)

      if (!existingRow) {
        const insertRow = buildResponsibilityInsertRow(row, fieldsMapping)
        inserts.push(insertRow)
        changedRowsForSync.push(normalizeRow(insertRow))
        continue
      }

      const update = buildResponsibilityUpdate(row, existingRow, fieldsMapping)
      if (update) {
        updates.push(update)
        changedRowsForSync.push(normalizeRow({
          ...existingRow,
          employee_name: fieldsMapping['Employee Name'] ? row.employee_name : existingRow.employee_name,
          project_description: fieldsMapping['Project Description'] ? row.project_description : existingRow.project_description,
          valid_from: fieldsMapping['Valid From'] ? row.valid_from : existingRow.valid_from,
          valid_to: fieldsMapping['Valid To'] ? row.valid_to : existingRow.valid_to,
        }))
      } else {
        unchangedRows.push(row)
      }
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      if (inserts.length) {
        await bulkInsertResponsibilities(client, inserts)
      }

      if (updates.length) {
        await bulkUpdateResponsibilities(client, updates)
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    await syncUserMasters(changedRowsForSync)

    return res.json({
      message: 'Responsibility spreadsheet sync completed successfully.',
      processedRows: sheetRows.length,
      summary: {
        insertedCount: inserts.length,
        updatedCount: updates.length,
        unchangedCount: unchangedRows.length,
        updatedRecordsLog: updates.map((update) => update.employee_id),
      },
    })
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message })
    }

    return handleResponsibilityError(error, res, next)
  }
}

export async function exportResponsibilities(req, res, next) {
  try {
    const exportSearchFields = {
      employee_id: 'employee_id',
      employee_name: 'employee_name',
    }
    const parsedFilters = parseFilterQuery(req.query?.filters)
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()
    const selectedKeys = String(req.query?.selectedKeys ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)

    if (parsedFilters === null) {
      return res.status(400).json({ message: 'Invalid filter payload' })
    }

    if (selectedKeys.length === 0 && (searchField || searchValue)) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!Object.prototype.hasOwnProperty.call(exportSearchFields, searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    let whereClause = ''
    let filterParams = []

    if (selectedKeys.length > 0) {
      whereClause = 'WHERE employee_id = ANY($1::text[]) OR id::TEXT = ANY($1::text[])'
      filterParams = [selectedKeys]
    } else {
      const activeFilters = parsedFilters.length > 0
        ? parsedFilters
        : searchField && searchValue
          ? [{ field: searchField, value: searchValue }]
          : []
      const whereConditions = []

      for (const filter of activeFilters) {
        const columnName = exportSearchFields[filter.field]

        if (!columnName) {
          return res.status(400).json({ message: 'Invalid filter field' })
        }

        filterParams.push(`%${filter.value}%`)
        whereConditions.push(`${columnName} ILIKE $${filterParams.length}`)
      }

      whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    }

    const result = await query(
      `
        SELECT
          employee_id,
          employee_name,
          project_id,
          project_description,
          responsibility,
          valid_from,
          valid_to
        FROM responsibility_master
        ${whereClause}
        ORDER BY employee_id ASC, project_id ASC, responsibility ASC
      `,
      filterParams,
    )

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('User Master')
    worksheet.columns = RESPONSIBILITY_IMPORT_COLUMNS.map((column) => ({
      header: column.excelHeader,
      key: column.dbColumn,
      width: Math.max(18, Math.min(44, column.excelHeader.length + 8)),
    }))
    worksheet.getRow(1).font = { bold: true }
    worksheet.addRows(result.rows.map((row) => ({
      ...row,
      valid_from: formatDateOnly(row.valid_from),
      valid_to: formatDateOnly(row.valid_to),
    })))

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=User_Master_Export.xlsx')
    await workbook.xlsx.write(res)
    return res.end()
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
          manual_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
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
      ],
    )
    const row = normalizeRow(result.rows[0])

    await syncUserMaster({ ...row, password_hash: pin })

    return res.status(201).json({
      message: 'User Master record created successfully',
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
      return res.status(404).json({ message: 'User Master record not found' })
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
    ].filter((field) => Object.prototype.hasOwnProperty.call(payload, field))

    const assignments = fields.map((field, index) => `${field} = $${index + 2}`)
    const values = fields.map((field) => {
      if (['valid_from', 'valid_to'].includes(field) && payload[field] === '') {
        return null
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
      return res.status(404).json({ message: 'User Master record not found' })
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
      message: 'User Master record updated successfully',
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
    const row = await fetchResponsibilityById(id)

    if (!row) {
      return res.status(404).json({ message: 'User Master record not found' })
    }

    const passwordHash = await bcrypt.hash(pin, 12)
    await query(
      `
        UPDATE users
        SET password_hash = $2,
            current_pin = $3
        WHERE login_name = $1
      `,
      [row.employee_id, passwordHash, pin],
    )

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
      return res.status(404).json({ message: 'User Master record not found' })
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
      return res.status(404).json({ message: 'User Master record not found' })
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
      return res.status(404).json({ message: 'User Master record not found' })
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
      message: 'User Master record deleted successfully',
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
