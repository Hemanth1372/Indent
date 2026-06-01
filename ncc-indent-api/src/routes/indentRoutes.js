import { Router } from 'express'
import {
  createIndent,
  deleteIndent,
  listIndents,
  updateIndentStatus,
} from '../controllers/indentController.js'
import { requireAdministrator, verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  createIndentSchema,
  indentIdSchema,
  updateIndentStatusSchema,
} from '../schemas/indentSchemas.js'

export const indentRoutes = Router()

indentRoutes.use(verifyToken)
indentRoutes.get('/', requireAdministrator, listIndents)
indentRoutes.post('/', validate(createIndentSchema), createIndent)
indentRoutes.patch('/:id/status', requireAdministrator, validate(updateIndentStatusSchema), updateIndentStatus)
indentRoutes.delete('/:id', requireAdministrator, validate(indentIdSchema), deleteIndent)
