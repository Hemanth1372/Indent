import pg from 'pg'
import { env } from '../config/env.js'

function shouldUseSsl(databaseUrl, databaseSsl) {
  const explicitValue = String(databaseSsl ?? '').trim().toLowerCase()

  if (['true', '1', 'yes', 'require'].includes(explicitValue)) {
    return true
  }

  if (['false', '0', 'no', 'disable'].includes(explicitValue)) {
    return false
  }

  try {
    const host = new URL(databaseUrl).hostname.toLowerCase()
    return !['localhost', '127.0.0.1', '::1'].includes(host)
  } catch {
    return false
  }
}

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: shouldUseSsl(env.databaseUrl, env.databaseSsl) ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export async function query(text, params) {
  return pool.query(text, params)
}
