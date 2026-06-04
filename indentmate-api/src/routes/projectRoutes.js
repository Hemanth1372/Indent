import { Router } from 'express'
import multer from 'multer'
import { exportProjectMaster, importProjectMaster, listProjectOptions, listProjects } from '../controllers/projectController.js'
import { checkSuperAdmin, verifySuperAdmin } from '../middleware/authAdmin.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const projectRoutes = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

projectRoutes.get('/options', verifyToken, listProjectOptions)
projectRoutes.use(verifySuperAdmin)
projectRoutes.post('/import', checkSuperAdmin, upload.single('file'), importProjectMaster)
projectRoutes.get('/export', checkSuperAdmin, exportProjectMaster)
projectRoutes.get('/', listProjects)
