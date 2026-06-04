import { createApp } from './src/app.js'
import { env } from './src/config/env.js'
import { ensureSchema } from './src/db/ensureSchema.js'

await ensureSchema()

const app = createApp()

app.listen(env.port, () => {
  console.log(`NCC Indent API is running on port ${env.port}`)
})
