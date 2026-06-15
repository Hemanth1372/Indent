import { Router } from 'express'
import { listOrderOptions } from '../controllers/orderController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const orderRoutes = Router()

orderRoutes.get('/options', verifyToken, listOrderOptions)
