import { Router } from 'express'
import multer from 'multer'
import {
  createMasterData,
  deleteMasterData,
  exportMasterData,
  importMasterData,
  listMasterFilterOptions,
  listMasterData,
  updateMasterData,
  updateMasterStatus,
} from '../controllers/masterDataController.js'
import { checkSuperAdmin, verifySuperAdmin } from '../middleware/authAdmin.js'

export const masterDataRoutes = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

masterDataRoutes.use(verifySuperAdmin)
masterDataRoutes.get('/:masterKey/export', checkSuperAdmin, exportMasterData)
masterDataRoutes.get('/:masterKey/filter-options', listMasterFilterOptions)
masterDataRoutes.post('/:masterKey/import', checkSuperAdmin, upload.single('file'), importMasterData)
masterDataRoutes.get('/:masterKey', listMasterData)
masterDataRoutes.post('/:masterKey', createMasterData)
masterDataRoutes.put('/:masterKey/:id', updateMasterData)
masterDataRoutes.patch('/:masterKey/:id/toggle-status', updateMasterStatus)
masterDataRoutes.delete('/:masterKey/:id', deleteMasterData)
