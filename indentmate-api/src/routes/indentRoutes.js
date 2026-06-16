import { Router } from 'express'
import {
  createIndent,
  deleteIndent,
  getIndent,
  getMyIndent,
  listIndentActivityOptions,
  listIndentContractorOptions,
  listIndentDeliveryPointOptions,
  listIndentItemOptions,
  listIndentOrderOptions,
  listIndentProjectOptions,
  listIndentWarehouseLocationOptions,
  listIndents,
  listMyIndents,
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

indentRoutes.get('/options/projects', verifyToken, listIndentProjectOptions)
indentRoutes.get('/options/orders', verifyToken, listIndentOrderOptions)
indentRoutes.get('/options/warehouse-locations', verifyToken, listIndentWarehouseLocationOptions)
indentRoutes.get('/options/contractors', verifyToken, listIndentContractorOptions)
indentRoutes.get('/options/delivery-points', verifyToken, listIndentDeliveryPointOptions)
indentRoutes.get('/options/items', verifyToken, listIndentItemOptions)
indentRoutes.get('/options/activities', verifyToken, listIndentActivityOptions)
indentRoutes.get('/mine', verifyToken, listMyIndents)
indentRoutes.get('/mine/:id', verifyToken, getMyIndent)
indentRoutes.get('/', verifySuperAdmin, listIndents)
indentRoutes.get('/:id', verifySuperAdmin, getIndent)
indentRoutes.post('/', verifyToken, validate(createIndentSchema), createIndent)
indentRoutes.patch('/:id/status', verifySuperAdmin, validate(updateIndentStatusSchema), updateIndentStatus)
indentRoutes.delete('/:id', verifySuperAdmin, validate(indentIdSchema), deleteIndent)
