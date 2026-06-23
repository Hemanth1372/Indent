import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import {
  createIndent,
  deleteIndent,
  getIndent,
  getMyIndent,
  getProjectReviewIndent,
  listIndentActivityOptions,
  listIndentContractorOptions,
  listIndentDeliveryPointOptions,
  listIndentItemOptions,
  listIndentOrderOptions,
  listIndentProjectOptions,
  listIndentWarehouseLocationOptions,
  listIndents,
  listMyIndents,
  listProjectReviewIndents,
  listProjectReviewProjects,
  updateIndentStatus,
} from '../controllers/indentController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'
import { verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  createIndentSchema,
  indentIdSchema,
  updateIndentStatusSchema,
} from '../schemas/indentSchemas.js'

export const indentRoutes = Router()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads', 'indent-attachments')
fs.mkdirSync(uploadDir, { recursive: true })

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const safeBaseName = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-z0-9-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'attachment'
      const safeExtension = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, '').slice(0, 12)
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBaseName}${safeExtension}`)
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

indentRoutes.get('/options/projects', verifyToken, listIndentProjectOptions)
indentRoutes.get('/options/orders', verifyToken, listIndentOrderOptions)
indentRoutes.get('/options/warehouse-locations', verifyToken, listIndentWarehouseLocationOptions)
indentRoutes.get('/options/contractors', verifyToken, listIndentContractorOptions)
indentRoutes.get('/options/delivery-points', verifyToken, listIndentDeliveryPointOptions)
indentRoutes.get('/options/items', verifyToken, listIndentItemOptions)
indentRoutes.get('/options/activities', verifyToken, listIndentActivityOptions)
indentRoutes.post('/attachments', verifyToken, attachmentUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Attachment file is required' })
  }

  res.status(201).json({
    data: {
      name: req.file.originalname,
      url: `/uploads/indent-attachments/${req.file.filename}`,
    },
  })
})
indentRoutes.get('/mine', verifyToken, listMyIndents)
indentRoutes.get('/mine/:id', verifyToken, getMyIndent)
indentRoutes.get('/review/projects', verifyToken, listProjectReviewProjects)
indentRoutes.get('/review', verifyToken, listProjectReviewIndents)
indentRoutes.get('/review/:id', verifyToken, getProjectReviewIndent)
indentRoutes.get('/', verifySuperAdmin, listIndents)
indentRoutes.get('/:id', verifySuperAdmin, getIndent)
indentRoutes.post('/', verifyToken, validate(createIndentSchema), createIndent)
indentRoutes.patch('/:id/status', verifyToken, validate(updateIndentStatusSchema), updateIndentStatus)
indentRoutes.delete('/:id', verifySuperAdmin, validate(indentIdSchema), deleteIndent)
