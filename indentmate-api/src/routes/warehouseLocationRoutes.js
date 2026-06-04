import { Router } from 'express'
import {
  createMasterData,
  listMasterData,
  updateMasterData,
} from '../controllers/masterDataController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'

export const warehouseLocationRoutes = Router()

function useWarehouseLocationMaster(req, _res, next) {
  req.params.masterKey = 'warehouse-bin-master'
  next()
}

warehouseLocationRoutes.use(verifySuperAdmin)
warehouseLocationRoutes.get('/', useWarehouseLocationMaster, listMasterData)
warehouseLocationRoutes.post('/', useWarehouseLocationMaster, createMasterData)
warehouseLocationRoutes.put('/:id', useWarehouseLocationMaster, updateMasterData)
