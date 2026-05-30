import { Router } from 'express'
import {
  changeUserPassword,
  createUser,
  listUsers,
  lookupUser,
  syncUserPin,
  updateUserStatus,
} from '../controllers/userController.js'
import { requireAdministrator, requirePasswordAdministrator, verifyToken } from '../middleware/verifyToken.js'
import { validate } from '../middleware/validate.js'
import {
  changeUserPasswordSchema,
  createUserSchema,
  lookupUserSchema,
  syncUserPinSchema,
  updateUserStatusSchema,
} from '../schemas/userSchemas.js'

export const userRoutes = Router()

userRoutes.get('/lookup/:loginName', validate(lookupUserSchema), lookupUser)
userRoutes.post('/sync-pin', validate(syncUserPinSchema), syncUserPin)

userRoutes.use(verifyToken)
userRoutes.get('/', listUsers)
userRoutes.post('/', requireAdministrator, validate(createUserSchema), createUser)
userRoutes.patch('/:userId/status', requireAdministrator, validate(updateUserStatusSchema), updateUserStatus)
userRoutes.put('/:userId/password', requirePasswordAdministrator, validate(changeUserPasswordSchema), changeUserPassword)
