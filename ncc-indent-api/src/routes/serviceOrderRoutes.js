import { Router } from 'express'
import {
  createServiceOrder,
  deleteServiceOrder,
  listServiceOrderOptions,
  listServiceOrders,
  updateServiceOrder,
} from '../controllers/serviceOrderController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'
import { validate } from '../middleware/validate.js'
import {
  createServiceOrderSchema,
  serviceOrderIdSchema,
  updateServiceOrderSchema,
} from '../schemas/serviceOrderSchemas.js'

export const serviceOrderRoutes = Router()

serviceOrderRoutes.use(verifySuperAdmin)
serviceOrderRoutes.get('/options', listServiceOrderOptions)
serviceOrderRoutes.get('/', listServiceOrders)
serviceOrderRoutes.post('/', validate(createServiceOrderSchema), createServiceOrder)
serviceOrderRoutes.put('/:id', validate(updateServiceOrderSchema), updateServiceOrder)
serviceOrderRoutes.delete('/:id', validate(serviceOrderIdSchema), deleteServiceOrder)
