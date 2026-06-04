import { Router } from 'express'
import { login, portalLogin, resetAdminPassword, webLogin } from '../controllers/authController.js'
import { validate } from '../middleware/validate.js'
import { adminForgotPasswordSchema, loginSchema } from '../schemas/authSchemas.js'

export const authRoutes = Router()

authRoutes.post('/login', validate(loginSchema), login)
authRoutes.post('/portal-login', validate(loginSchema), portalLogin)
authRoutes.post('/web-login', validate(loginSchema), webLogin)
authRoutes.post('/admin-forgot-password', validate(adminForgotPasswordSchema), resetAdminPassword)
