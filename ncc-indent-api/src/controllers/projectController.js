import ExcelJS from 'exceljs'
import xlsx from 'xlsx'
import { pool, query } from '../db/pool.js'

const PROJECTS_SELECT_SQL = `
  SELECT project_id, project_name, location, status
  FROM projects
  ORDER BY project_name ASC
`

export async function listProjects(_req, res, next) {
  try {
    const result = await query(PROJECTS_SELECT_SQL)
    return res.json({ data: result.rows })
  } catch (error) {
    return next(error)
  }
}

const PROJECT_MASTER_COLUMNS = [
  'Project',
  'Project Description',
  'DPR Engineer Control',
  'Multi Location Activity',
  'Project Location Linked to Activities',
]

const PROJECT_MASTER_FIELD_MAP = {
  Project: 'project_code',
  'Project Description': 'project_description',
  'DPR Engineer Control': 'dpr_engineer_control',
  'Multi Location Activity': 'multi_location_activity',
  'Project Location Linked to Activities': 'project_location_linked_activities',
}

const PROJECT_MASTER_INSERT_DEFAULTS = {
  project_description: '',
  dpr_engineer_control: 'LOCATION',
  multi_location_activity: 'NO',
  project_location_linked_activities: 'NO',
}

const PROJECT_MASTER_EXPORT_COLUMNS = [
  { header: 'Project', key: 'project_code', width: 24 },
  { header: 'Project Description', key: 'project_description', width: 42 },
  { header: 'DPR Engineer Control', key: 'dpr_engineer_control', width: 24 },
  { header: 'Multi Location Activity', key: 'multi_location_activity', width: 24 },
  { header: 'Project Location Linked to Activities', key: 'project_location_linked_activities', width: 36 },
]

const PROJECT_MASTER_SEARCH_FIELDS = new Set([
  'project_code',
  'project_description',
  'dpr_engineer_control',
  'multi_location_activity',
  'project_location_linked_activities',
])

export async function importProjectMaster(req, res, next) {
  const file = req.file

  if (!file) {
    return res.status(400).json({ message: 'Project Master import file is required' })
  }

  try {
    const fieldsMapping = parseFieldsMapping(req.body?.fieldsMapping)
    const rows = parseProjectMasterWorkbook(file)

    if (!rows.length) {
      return res.status(400).json({ message: 'Import file does not contain any project rows' })
    }

    if (!fieldsMapping.Project) {
      return res.status(400).json({ message: 'Project column must be selected for import' })
    }

    const incomingCodes = [...new Set(rows.map((row) => row.project_code).filter(Boolean))]
    const existingResult = await query(
      `
        SELECT
          project_code,
          project_description,
          dpr_engineer_control,
          multi_location_activity,
          project_location_linked_activities
        FROM project_master
        WHERE project_code = ANY($1)
      `,
      [incomingCodes],
    )
    const existingRecords = new Map(existingResult.rows.map((record) => [record.project_code, record]))
    const inserts = []
    const updates = []
    const summary = {
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      updatedRecordsLog: [],
    }

    for (const row of rows) {
      const existingRecord = existingRecords.get(row.project_code)

      if (!existingRecord) {
        inserts.push(buildProjectInsertRow(row, fieldsMapping))
        continue
      }

      const update = buildProjectUpdate(row, existingRecord, fieldsMapping)
      if (update) {
        updates.push(update)
      } else {
        summary.unchangedCount += 1
      }
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      if (inserts.length) {
        const placeholders = inserts.map((_, index) => {
          const base = (index * 5) + 1
          return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        })
        const values = inserts.flatMap((row) => [
          row.project_code,
          row.project_description,
          row.dpr_engineer_control,
          row.multi_location_activity,
          row.project_location_linked_activities,
        ])

        await client.query(
          `
            INSERT INTO project_master (
              project_code,
              project_description,
              dpr_engineer_control,
              multi_location_activity,
              project_location_linked_activities
            )
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (project_code) DO NOTHING
          `,
          values,
        )
      }

      for (const update of updates) {
        await client.query(
          `
            UPDATE project_master
            SET ${update.assignments.join(', ')},
                updated_at = CURRENT_TIMESTAMP
            WHERE project_code = $${update.values.length + 1}
          `,
          [...update.values, update.project_code],
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    summary.insertedCount = inserts.length
    summary.updatedCount = updates.length
    summary.updatedRecordsLog = updates.map((update) => update.project_code)

    return res.json({
      message: 'File processing tracking evaluations concluded successfully.',
      processedRows: rows.length,
      summary,
    })
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message })
    }

    return next(error)
  }
}

export async function exportProjectMaster(req, res, next) {
  try {
    const searchField = String(req.query?.field ?? '').trim()
    const searchValue = String(req.query?.value ?? '').trim()

    if (searchField || searchValue) {
      if (!searchField || !searchValue) {
        return res.status(400).json({ message: 'Both filter field and value are required' })
      }

      if (!PROJECT_MASTER_SEARCH_FIELDS.has(searchField)) {
        return res.status(400).json({ message: 'Invalid filter field' })
      }
    }

    const whereClause = searchField && searchValue ? `WHERE ${searchField} ILIKE $1` : ''
    const params = searchField && searchValue ? [`%${searchValue}%`] : []
    const result = await query(
      `
        SELECT
          project_code,
          project_description,
          dpr_engineer_control,
          multi_location_activity,
          project_location_linked_activities
        FROM project_master
        ${whereClause}
        ORDER BY project_code ASC
      `,
      params,
    )

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Project Master')
    worksheet.columns = PROJECT_MASTER_EXPORT_COLUMNS
    worksheet.getRow(1).font = { bold: true }
    worksheet.addRows(result.rows)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=Project_Master_Export.xlsx')
    await workbook.xlsx.write(res)
    return res.end()
  } catch (error) {
    return next(error)
  }
}

function parseProjectMasterWorkbook(file) {
  const workbook = xlsx.read(file.buffer, {
    type: 'buffer',
    raw: false,
    cellDates: false,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throwBadRequest('Import file does not contain a worksheet')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const table = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  })

  if (!table.length) {
    throwBadRequest('Import file is empty')
  }

  const headerRow = table[0].map((value) => String(value ?? '').trim())
  const normalizedHeaders = new Set(headerRow)

  if (!normalizedHeaders.has('Project')) {
    throwBadRequest('Invalid template. Required column: Project')
  }

  return table
    .slice(1)
    .map((row) => {
      const record = {}
      headerRow.forEach((header, index) => {
        if (PROJECT_MASTER_FIELD_MAP[header]) {
          record[PROJECT_MASTER_FIELD_MAP[header]] = String(row[index] ?? '').trim()
        }
      })
      return record
    })
    .filter((row) => Object.values(row).some(Boolean))
    .map((row, index) => {
      if (!row.project_code) {
        throwBadRequest(`Row ${index + 2} is missing Project`)
      }

      return {
        project_code: row.project_code,
        project_description: row.project_description ?? '',
        dpr_engineer_control: row.dpr_engineer_control ?? '',
        multi_location_activity: row.multi_location_activity ?? '',
        project_location_linked_activities: row.project_location_linked_activities ?? '',
      }
    })
}

function parseFieldsMapping(value) {
  if (!value) {
    return Object.fromEntries(PROJECT_MASTER_COLUMNS.map((column) => [column, true]))
  }

  try {
    const parsed = JSON.parse(value)
    return Object.fromEntries(
      PROJECT_MASTER_COLUMNS.map((column) => [column, Boolean(parsed[column])]),
    )
  } catch {
    throwBadRequest('Invalid fieldsMapping payload')
  }
}

function buildProjectInsertRow(row, fieldsMapping) {
  return {
    project_code: row.project_code,
    project_description: fieldsMapping['Project Description']
      ? row.project_description
      : PROJECT_MASTER_INSERT_DEFAULTS.project_description,
    dpr_engineer_control: fieldsMapping['DPR Engineer Control']
      ? row.dpr_engineer_control || PROJECT_MASTER_INSERT_DEFAULTS.dpr_engineer_control
      : PROJECT_MASTER_INSERT_DEFAULTS.dpr_engineer_control,
    multi_location_activity: fieldsMapping['Multi Location Activity']
      ? row.multi_location_activity || PROJECT_MASTER_INSERT_DEFAULTS.multi_location_activity
      : PROJECT_MASTER_INSERT_DEFAULTS.multi_location_activity,
    project_location_linked_activities: fieldsMapping['Project Location Linked to Activities']
      ? row.project_location_linked_activities || PROJECT_MASTER_INSERT_DEFAULTS.project_location_linked_activities
      : PROJECT_MASTER_INSERT_DEFAULTS.project_location_linked_activities,
  }
}

function buildProjectUpdate(row, existingRecord, fieldsMapping) {
  const assignments = []
  const values = []

  for (const column of PROJECT_MASTER_COLUMNS.slice(1)) {
    if (!fieldsMapping[column]) {
      continue
    }

    const field = PROJECT_MASTER_FIELD_MAP[column]
    const nextValue = String(row[field] ?? '').trim()
    const currentValue = String(existingRecord[field] ?? '').trim()

    if (nextValue !== currentValue) {
      values.push(nextValue)
      assignments.push(`${field} = $${values.length}`)
    }
  }

  if (!assignments.length) {
    return null
  }

  return {
    project_code: row.project_code,
    assignments,
    values,
  }
}

function throwBadRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  throw error
}
