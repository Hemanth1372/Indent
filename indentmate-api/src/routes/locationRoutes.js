import { Router } from 'express'
import { listLocationOptions } from '../controllers/masterOptionsController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const locationRoutes = Router()

locationRoutes.get('/options', verifyToken, listLocationOptions)
