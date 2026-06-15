import { Router } from 'express'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController.js'
import { verifyToken } from '../middleware/verifyToken.js'

export const notificationRoutes = Router()

notificationRoutes.use(verifyToken)
notificationRoutes.get('/', listNotifications)
notificationRoutes.patch('/read-all', markAllNotificationsRead)
notificationRoutes.patch('/:id/read', markNotificationRead)
