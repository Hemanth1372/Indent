import { Router } from 'express'
import {
  createResponsibility,
  deleteResponsibility,
  listResponsibilities,
  listResponsibilityOptions,
  updateResponsibility,
} from '../controllers/responsibilityController.js'
import { requireAdministrator, verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  createResponsibilitySchema,
  responsibilityIdSchema,
  updateResponsibilitySchema,
} from '../schemas/responsibilitySchemas.js'

export const responsibilityRoutes = Router()

responsibilityRoutes.use(verifyToken)
responsibilityRoutes.get('/options', listResponsibilityOptions)
responsibilityRoutes.get('/', listResponsibilities)
responsibilityRoutes.post('/', requireAdministrator, validate(createResponsibilitySchema), createResponsibility)
responsibilityRoutes.put('/:id', requireAdministrator, validate(updateResponsibilitySchema), updateResponsibility)
responsibilityRoutes.delete('/:id', requireAdministrator, validate(responsibilityIdSchema), deleteResponsibility)
