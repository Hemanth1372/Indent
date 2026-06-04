import { Router } from 'express'
import {
  createMasterData,
  listMasterData,
  updateMasterData,
} from '../controllers/masterDataController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const bpActivityRoutes = Router()

function useBusinessPartnerActivityMaster(req, _res, next) {
  req.params.masterKey = 'business-partner-master'
  next()
}

bpActivityRoutes.use(verifySuperAdmin)
bpActivityRoutes.get('/', useBusinessPartnerActivityMaster, listMasterData)
bpActivityRoutes.post('/', useBusinessPartnerActivityMaster, createMasterData)
bpActivityRoutes.put('/:id', useBusinessPartnerActivityMaster, updateMasterData)
