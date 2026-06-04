import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import xlsx from 'xlsx'
import {
  MASTER_IMPORT_CONFIGS,
  normalizeCell,
  normalizeDbValue,
} from '../controllers/masterDataController.js'
import { pool } from './pool.js'

const SPREADSHEETS_DIRECTORY = path.join(process.cwd(), 'data-sheets')
const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

export async function runSpreadsheetDataSeeds(directory = SPREADSHEETS_DIRECTORY) {
  console.log('Starting spreadsheet-driven master data seeding...')

  for (const [masterKey, config] of Object.entries(MASTER_IMPORT_CONFIGS)) {
    const targetFilePath = findSeederFile(directory, masterKey)

    if (!targetFilePath) {
      console.warn(`Skipping ${masterKey}: no spreadsheet found in ${directory}`)
      continue
    }

    const client = await pool.connect()

    try {
      const sheetRows = parseSpreadsheetRows(targetFilePath)

      if (!sheetRows.length) {
        console.warn(`Skipping ${masterKey}: spreadsheet has no data rows`)
        continue
      }

      await client.query('BEGIN')

      let processedCount = 0
      for (const row of sheetRows) {
        const seedRow = buildSeedRow(row, config)

        if (!seedRow) {
          continue
        }

        await upsertSeedRow(client, config, seedRow)
        processedCount += 1
      }

      await client.query('COMMIT')
      console.log(`Seeded ${processedCount} record(s) into ${config.tableName} from ${path.basename(targetFilePath)}`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`Failed spreadsheet seed for ${masterKey}: ${error.message}`)
      throw error
    } finally {
      client.release()
    }
  }

  console.log('Spreadsheet-driven master data seeding completed.')
}

function findSeederFile(directory, masterKey) {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const candidate = path.join(directory, `${masterKey}${extension}`)

    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function parseSpreadsheetRows(filePath) {
  const workbook = xlsx.readFile(filePath, {
    raw: false,
    cellDates: false,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return []
  }

  return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    blankrows: false,
  })
}

function buildSeedRow(row, config) {
  const lookupValue = normalizeCell(row[config.excelLookupKey])

  if (!lookupValue) {
    return null
  }

  const seedRow = new Map([[config.lookupDbColumn, lookupValue]])

  for (const [dbColumn, defaultValue] of Object.entries(config.defaults ?? {})) {
    seedRow.set(dbColumn, defaultValue)
  }

  for (const column of config.columns) {
    if (column.dbColumn === config.lookupDbColumn || row[column.excelHeader] === undefined) {
      continue
    }

    seedRow.set(column.dbColumn, normalizeDbValue(row[column.excelHeader], column))
  }

  return Object.fromEntries(seedRow)
}

async function upsertSeedRow(client, config, seedRow) {
  const fields = Object.keys(seedRow)
  const keyFields = getImportKeyColumns(config)
  const keyFieldSet = new Set(keyFields)
  const values = fields.map((field) => seedRow[field])
  const updateAssignments = fields
    .filter((field) => !keyFieldSet.has(field) && field !== 'created_at')
    .map((field, index) => `${quoteIdentifier(field)} = $${index + 1}`)
  const updateValues = fields
    .filter((field) => !keyFieldSet.has(field) && field !== 'created_at')
    .map((field) => seedRow[field])

  if (updateAssignments.length) {
    const whereClause = keyFields
      .map((field, index) => `${quoteIdentifier(field)} IS NOT DISTINCT FROM $${updateValues.length + index + 1}`)
      .join(' AND ')
    const updateResult = await client.query(
      `
        UPDATE ${quoteIdentifier(config.tableName)}
        SET ${updateAssignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
        WHERE ${whereClause}
        RETURNING ${quoteIdentifier(config.lookupDbColumn)}
      `,
      [...updateValues, ...keyFields.map((field) => seedRow[field])],
    )

    if (updateResult.rowCount > 0) {
      return
    }
  }

  const placeholders = values.map((_, index) => `$${index + 1}`)
  await client.query(
    `
      INSERT INTO ${quoteIdentifier(config.tableName)} (${fields.map(quoteIdentifier).join(', ')})
      VALUES (${placeholders.join(', ')})
    `,
    values,
  )
}

function getImportKeyColumns(config) {
  return config.keyDbColumns?.length ? config.keyDbColumns : [config.lookupDbColumn]
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`)
  }

  return `"${value}"`
}

function isDirectRun() {
  return process.argv[1] === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  runSpreadsheetDataSeeds(process.argv[2] ? path.resolve(process.argv[2]) : SPREADSHEETS_DIRECTORY)
    .then(() => pool.end())
    .catch(async () => {
      await pool.end()
      process.exit(1)
    })
}
