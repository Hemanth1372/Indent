import { Router } from 'express'
import { getDashboardMonthlyStats, getDashboardStats } from '../controllers/dashboardController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const dashboardRoutes = Router()

dashboardRoutes.use(verifySuperAdmin)
dashboardRoutes.get('/monthly-stats', getDashboardMonthlyStats)
dashboardRoutes.get('/stats', getDashboardStats)
