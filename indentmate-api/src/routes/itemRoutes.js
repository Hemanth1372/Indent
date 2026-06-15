import { Router } from 'express'
import { listItemOptions } from '../controllers/itemController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const itemRoutes = Router()

itemRoutes.get('/options', verifyToken, listItemOptions)
