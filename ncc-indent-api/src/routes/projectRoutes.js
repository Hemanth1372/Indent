import { Router } from 'express'
import { listProjects } from '../controllers/projectController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const projectRoutes = Router()

projectRoutes.use(verifySuperAdmin)
projectRoutes.get('/', listProjects)
