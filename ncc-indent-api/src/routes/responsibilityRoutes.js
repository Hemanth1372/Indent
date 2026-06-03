import { Router } from 'express'
import {
  changeResponsibilityPassword,
  changeResponsibilityRole,
  createResponsibility,
  deleteResponsibility,
  listResponsibilities,
  listResponsibilityOptions,
  updateResponsibility,
  updateResponsibilityStatus,
} from '../controllers/responsibilityController.js'
import { checkSuperAdmin, verifySuperAdmin } from '../middleware/authAdmin.js'
import { validate } from '../middleware/validate.js'
import {
  changeResponsibilityPasswordSchema,
  changeResponsibilityRoleSchema,
  createResponsibilitySchema,
  responsibilityIdSchema,
  updateResponsibilityStatusSchema,
  updateResponsibilitySchema,
} from '../schemas/responsibilitySchemas.js'

export const responsibilityRoutes = Router()

responsibilityRoutes.use(verifySuperAdmin)
responsibilityRoutes.get('/options', listResponsibilityOptions)
responsibilityRoutes.get('/', listResponsibilities)
responsibilityRoutes.post('/', checkSuperAdmin, validate(createResponsibilitySchema), createResponsibility)
responsibilityRoutes.put('/:id', checkSuperAdmin, validate(updateResponsibilitySchema), updateResponsibility)
responsibilityRoutes.patch('/:id/change-password', checkSuperAdmin, validate(changeResponsibilityPasswordSchema), changeResponsibilityPassword)
responsibilityRoutes.patch('/:id/change-role', checkSuperAdmin, validate(changeResponsibilityRoleSchema), changeResponsibilityRole)
responsibilityRoutes.patch('/:id/toggle-status', checkSuperAdmin, validate(updateResponsibilityStatusSchema), updateResponsibilityStatus)
responsibilityRoutes.delete('/:id', checkSuperAdmin, validate(responsibilityIdSchema), deleteResponsibility)
