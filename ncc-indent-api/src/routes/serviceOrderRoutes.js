import { Router } from 'express'
import {
  createServiceOrder,
  deleteServiceOrder,
  listServiceOrderOptions,
  listServiceOrders,
  updateServiceOrder,
} from '../controllers/serviceOrderController.js'
import { requireAdministrator, verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  createServiceOrderSchema,
  serviceOrderIdSchema,
  updateServiceOrderSchema,
} from '../schemas/serviceOrderSchemas.js'

export const serviceOrderRoutes = Router()

serviceOrderRoutes.use(verifyToken)
serviceOrderRoutes.get('/options', listServiceOrderOptions)
serviceOrderRoutes.get('/', listServiceOrders)
serviceOrderRoutes.post('/', requireAdministrator, validate(createServiceOrderSchema), createServiceOrder)
serviceOrderRoutes.put('/:id', requireAdministrator, validate(updateServiceOrderSchema), updateServiceOrder)
serviceOrderRoutes.delete('/:id', requireAdministrator, validate(serviceOrderIdSchema), deleteServiceOrder)
