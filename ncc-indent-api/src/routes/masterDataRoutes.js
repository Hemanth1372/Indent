import { Router } from 'express'
import { createMasterData, listMasterData } from '../controllers/masterDataController.js'
import { requireAdministrator, verifyToken } from '../middleware/verifyToken.js'

export const masterDataRoutes = Router()

masterDataRoutes.use(verifyToken)
masterDataRoutes.get('/:masterKey', listMasterData)
masterDataRoutes.post('/:masterKey', requireAdministrator, createMasterData)
