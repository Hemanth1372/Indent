import { Router } from 'express'
import { listProjects } from '../controllers/projectController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const projectRoutes = Router()

projectRoutes.use(verifyToken)
projectRoutes.get('/', listProjects)
