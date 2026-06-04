import { Router } from 'express'
import { listWarehouseOptions } from '../controllers/warehouseController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const warehouseRoutes = Router()

warehouseRoutes.get('/options', verifyToken, listWarehouseOptions)
