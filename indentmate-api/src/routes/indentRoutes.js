import { Router } from 'express'
import {
  createIndent,
  deleteIndent,
  getIndent,
  listIndents,
  updateIndentStatus,
} from '../controllers/indentController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'
import { verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  createIndentSchema,
  indentIdSchema,
  updateIndentStatusSchema,
} from '../schemas/indentSchemas.js'

export const indentRoutes = Router()

indentRoutes.get('/', verifySuperAdmin, listIndents)
indentRoutes.get('/:id', verifySuperAdmin, getIndent)
indentRoutes.post('/', verifyToken, validate(createIndentSchema), createIndent)
indentRoutes.patch('/:id/status', verifySuperAdmin, validate(updateIndentStatusSchema), updateIndentStatus)
indentRoutes.delete('/:id', verifySuperAdmin, validate(indentIdSchema), deleteIndent)
