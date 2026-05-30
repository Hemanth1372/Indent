import { createApp } from './src/app.js'
import { env } from './src/config/env.js'
import { query } from './src/db/pool.js'

await query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_pin VARCHAR(6)')

const app = createApp()

app.listen(env.port, () => {
  console.log(`NCC Indent API is running on port ${env.port}`)
})
