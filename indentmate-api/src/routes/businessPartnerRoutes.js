import { Router } from 'express'
import { listBusinessPartnerOptions } from '../controllers/masterOptionsController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const businessPartnerRoutes = Router()

businessPartnerRoutes.get('/options', verifyToken, listBusinessPartnerOptions)
