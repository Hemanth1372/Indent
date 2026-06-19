import { Router } from 'express'
import { login, portalLogin, resetAdminPassword, webLogin } from '../controllers/authController.js'
import { validate } from '../middleware/validate.js'
import { verifyToken } from '../middleware/verifyToken.js'
import { adminForgotPasswordSchema, loginSchema } from '../schemas/authSchemas.js'

export const authRoutes = Router()

authRoutes.post('/login', validate(loginSchema), login)
authRoutes.post('/portal-login', validate(loginSchema), portalLogin)
authRoutes.post('/web-login', validate(loginSchema), webLogin)
authRoutes.post('/admin-forgot-password', validate(adminForgotPasswordSchema), resetAdminPassword)
authRoutes.get('/session', verifyToken, (req, res) => res.json({ data: { active: true, user: req.user } }))
