import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { authRoutes } from './routes/authRoutes.js'
import { dashboardRoutes } from './routes/dashboardRoutes.js'
import { indentRoutes } from './routes/indentRoutes.js'
import { masterDataRoutes } from './routes/masterDataRoutes.js'
import { projectRoutes } from './routes/projectRoutes.js'
import { responsibilityRoutes } from './routes/responsibilityRoutes.js'
import { serviceOrderRoutes } from './routes/serviceOrderRoutes.js'
import { userRoutes } from './routes/userRoutes.js'

export function createApp() {
  const app = express()
  const allowedOrigins = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true)
          return
        }

        const isConfiguredOrigin = allowedOrigins.includes(origin)
        const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)

        callback(null, isConfiguredOrigin || isLocalDevOrigin)
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NCC Indent API' })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/indents', indentRoutes)
  app.use('/api/master-data', masterDataRoutes)
  app.use('/api/projects', projectRoutes)
  app.use('/api/service-orders', serviceOrderRoutes)
  app.use('/api/responsibilities', responsibilityRoutes)

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  })

  return app
}
