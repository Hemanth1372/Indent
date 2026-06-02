import { Router } from 'express'
import {
  changeUserPassword,
  createUser,
  deleteUser,
  listUsers,
  lookupUser,
  syncUserPin,
  updateUserRole,
  updateUserStatus,
} from '../controllers/userController.js'
import { verifySuperAdmin } from '../middleware/authAdmin.js'
import { validate } from '../middleware/validate.js'
import {
  changeUserPasswordSchema,
  createUserSchema,
  deleteUserSchema,
  lookupUserSchema,
  syncUserPinSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../schemas/userSchemas.js'

export const userRoutes = Router()

userRoutes.get('/lookup/:loginName', validate(lookupUserSchema), lookupUser)
userRoutes.post('/sync-pin', validate(syncUserPinSchema), syncUserPin)

userRoutes.use(verifySuperAdmin)
userRoutes.get('/', listUsers)
userRoutes.post('/', validate(createUserSchema), createUser)
userRoutes.patch('/:employeeId/toggle-status', validate(updateUserStatusSchema), updateUserStatus)
userRoutes.patch('/:userId/role', validate(updateUserRoleSchema), updateUserRole)
userRoutes.put('/:userId/password', validate(changeUserPasswordSchema), changeUserPassword)
userRoutes.delete('/:userId', validate(deleteUserSchema), deleteUser)
