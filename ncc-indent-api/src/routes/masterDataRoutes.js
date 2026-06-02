import { Router } from 'express'
import {
  createMasterData,
  listMasterData,
  updateMasterData,
  updateMasterStatus,
} from '../controllers/masterDataController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const masterDataRoutes = Router()

masterDataRoutes.use(verifySuperAdmin)
masterDataRoutes.get('/:masterKey', listMasterData)
masterDataRoutes.post('/:masterKey', createMasterData)
masterDataRoutes.put('/:masterKey/:id', updateMasterData)
masterDataRoutes.patch('/:masterKey/:id/toggle-status', updateMasterStatus)
