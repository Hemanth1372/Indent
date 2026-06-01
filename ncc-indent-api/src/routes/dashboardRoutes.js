import { Router } from 'express'
import { getDashboardStats } from '../controllers/dashboardController.js'
import { requireAdministrator, verifyToken } from '../middleware/verifyToken.js'

export const dashboardRoutes = Router()

dashboardRoutes.use(verifyToken)
dashboardRoutes.get('/stats', requireAdministrator, getDashboardStats)
