import { createApp } from './app.js'
import { env } from './config/env.js'
import { query } from './db/pool.js'

await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6)')

const app = createApp()

app.listen(env.port, () => {
  console.log(`NCC Indent API listening on port ${env.port}`)
})
