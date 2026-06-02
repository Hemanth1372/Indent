import { Router } from 'express'
import {
  createResponsibility,
  deleteResponsibility,
  listResponsibilities,
  listResponsibilityOptions,
  updateResponsibility,
} from '../controllers/responsibilityController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'
import { validate } from '../middleware/validate.js'
import {
  createResponsibilitySchema,
  responsibilityIdSchema,
  updateResponsibilitySchema,
} from '../schemas/responsibilitySchemas.js'

export const responsibilityRoutes = Router()

responsibilityRoutes.use(verifySuperAdmin)
responsibilityRoutes.get('/options', listResponsibilityOptions)
responsibilityRoutes.get('/', listResponsibilities)
responsibilityRoutes.post('/', validate(createResponsibilitySchema), createResponsibility)
responsibilityRoutes.put('/:id', validate(updateResponsibilitySchema), updateResponsibility)
responsibilityRoutes.delete('/:id', validate(responsibilityIdSchema), deleteResponsibility)
