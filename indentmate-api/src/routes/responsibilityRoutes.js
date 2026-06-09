import { Router } from 'express'
import multer from 'multer'
import {
  changeResponsibilityPassword,
  changeResponsibilityRole,
  createResponsibility,
  createUserMaster,
  createUserProjectAssignment,
  deleteResponsibility,
  exportResponsibilities,
  importResponsibilities,
  listResponsibilities,
  listResponsibilityOptions,
  listUserProjectAssignments,
  updateResponsibility,
  updateResponsibilityStatus,
  updateUserMaster,
  updateUserMasterStatus,
} from '../controllers/responsibilityController.js'
import { checkSuperAdmin, verifySuperAdmin } from '../middleware/authAdmin.js'
import { validate } from '../middleware/validate.js'
import {
  changeResponsibilityPasswordSchema,
  changeResponsibilityRoleSchema,
  createResponsibilitySchema,
  createUserMasterSchema,
  createUserProjectAssignmentSchema,
  responsibilityIdSchema,
  updateResponsibilityStatusSchema,
  updateResponsibilitySchema,
  updateUserMasterSchema,
  updateUserMasterStatusSchema,
} from '../schemas/responsibilitySchemas.js'

export const responsibilityRoutes = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

responsibilityRoutes.use(verifySuperAdmin)
responsibilityRoutes.get('/export', checkSuperAdmin, exportResponsibilities)
responsibilityRoutes.post('/import', checkSuperAdmin, upload.single('file'), importResponsibilities)
responsibilityRoutes.get('/options', listResponsibilityOptions)
responsibilityRoutes.post('/users', checkSuperAdmin, validate(createUserMasterSchema), createUserMaster)
responsibilityRoutes.put('/users/:employeeId', checkSuperAdmin, validate(updateUserMasterSchema), updateUserMaster)
responsibilityRoutes.patch('/users/:employeeId/toggle-status', checkSuperAdmin, validate(updateUserMasterStatusSchema), updateUserMasterStatus)
responsibilityRoutes.get('/users/:employeeId/projects', listUserProjectAssignments)
responsibilityRoutes.post('/users/:employeeId/projects', checkSuperAdmin, validate(createUserProjectAssignmentSchema), createUserProjectAssignment)
responsibilityRoutes.get('/', listResponsibilities)
responsibilityRoutes.post('/', checkSuperAdmin, validate(createResponsibilitySchema), createResponsibility)
responsibilityRoutes.put('/:id', checkSuperAdmin, validate(updateResponsibilitySchema), updateResponsibility)
responsibilityRoutes.patch('/:id/change-password', checkSuperAdmin, validate(changeResponsibilityPasswordSchema), changeResponsibilityPassword)
responsibilityRoutes.patch('/:id/change-role', checkSuperAdmin, validate(changeResponsibilityRoleSchema), changeResponsibilityRole)
responsibilityRoutes.patch('/:id/toggle-status', checkSuperAdmin, validate(updateResponsibilityStatusSchema), updateResponsibilityStatus)
responsibilityRoutes.delete('/:id', checkSuperAdmin, validate(responsibilityIdSchema), deleteResponsibility)
