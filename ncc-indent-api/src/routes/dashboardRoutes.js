import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboardController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const dashboardRoutes = Router()

dashboardRoutes.use(verifySuperAdmin)
dashboardRoutes.get('/stats', getDashboardStats)
