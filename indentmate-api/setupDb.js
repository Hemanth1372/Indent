import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './src/db/pool.js'
import { runSpreadsheetDataSeeds } from './src/db/spreadsheetSeeder.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(currentDirectory, 'schema.sql')

async function setupDatabase() {
  try {
    console.log('Starting database schema initialization...')

    const schemaSql = await fs.readFile(schemaPath, 'utf8')
    await pool.query(schemaSql)

    console.log('Schema initialization completed.')
    await runSpreadsheetDataSeeds(path.join(currentDirectory, 'data-sheets'))
  } catch (error) {
    console.error('Database setup failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

setupDatabase()
