import { Router } from 'express'
import { login, portalLogin } from '../controllers/authController.js'
import { validate } from '../middleware/validate.js'
import { loginSchema } from '../schemas/authSchemas.js'

export const authRoutes = Router()

authRoutes.post('/login', validate(loginSchema), login)
authRoutes.post('/portal-login', validate(loginSchema), portalLogin)
