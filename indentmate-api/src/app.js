import cors from 'cors'
import express from 'express'
import { activityRoutes } from './routes/activityRoutes.js'
import { env } from './config/env.js'
import { authRoutes } from './routes/authRoutes.js'
import { businessPartnerRoutes } from './routes/businessPartnerRoutes.js'
import { bpActivityRoutes } from './routes/bpActivityRoutes.js'
import { dashboardRoutes } from './routes/dashboardRoutes.js'
import { indentRoutes } from './routes/indentRoutes.js'
import { itemRoutes } from './routes/itemRoutes.js'
import { locationRoutes } from './routes/locationRoutes.js'
import { masterDataRoutes } from './routes/masterDataRoutes.js'
import { orderRoutes } from './routes/orderRoutes.js'
import { projectRoutes } from './routes/projectRoutes.js'
import { responsibilityRoutes } from './routes/responsibilityRoutes.js'
import { userRoutes } from './routes/userRoutes.js'
import { warehouseLocationRoutes } from './routes/warehouseLocationRoutes.js'
import { warehouseRoutes } from './routes/warehouseRoutes.js'

export function createApp() {
  const app = express()
  const normalizeOrigin = (origin) => origin.replace(/\/+$/, '')
  const allowedOrigins = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .map(normalizeOrigin)
    .filter(Boolean)

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true)
          return
        }

        const isConfiguredOrigin = allowedOrigins.includes(normalizeOrigin(origin))
        const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)
        const isVercelOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizeOrigin(origin))

        callback(null, isConfiguredOrigin || isLocalDevOrigin || isVercelOrigin)
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NCC Indent API' })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/activities', activityRoutes)
  app.use('/api/business-partners', businessPartnerRoutes)
  app.use('/api/bp-activities', bpActivityRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/indents', indentRoutes)
  app.use('/api/items', itemRoutes)
  app.use('/api/locations', locationRoutes)
  app.use('/api/master-data', masterDataRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/projects', projectRoutes)
  app.use('/api/responsibilities', responsibilityRoutes)
  app.use('/api/warehouses', warehouseRoutes)
  app.use('/api/warehouse-locations', warehouseLocationRoutes)

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  })

  return app
}
