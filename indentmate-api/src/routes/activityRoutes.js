import { Router } from 'express'
import { listActivityOptions } from '../controllers/activityController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const activityRoutes = Router()

activityRoutes.get('/options', verifyToken, listActivityOptions)
