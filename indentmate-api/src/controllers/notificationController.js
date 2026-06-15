import { query } from '../db/pool.js'

export async function listNotifications(req, res, next) {
  try {
    const loginName = req.user?.login_name

    if (!loginName) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const result = await query(
      `
        SELECT
          id,
          indent_header_id,
          indent_no,
          title,
          message,
          status,
          target_path,
          is_read,
          created_at,
          read_at
        FROM notifications
        WHERE recipient_login = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [loginName],
    )
    const unreadResult = await query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM notifications
        WHERE recipient_login = $1
          AND is_read = FALSE
      `,
      [loginName],
    )

    return res.json({
      data: result.rows,
      unreadCount: unreadResult.rows[0]?.unread_count ?? 0,
    })
  } catch (error) {
    return next(error)
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const loginName = req.user?.login_name
    const id = String(req.params.id ?? '').trim()

    if (!loginName) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const result = await query(
      `
        UPDATE notifications
        SET is_read = TRUE,
            read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = $1
          AND recipient_login = $2
        RETURNING id
      `,
      [id, loginName],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    return res.json({ message: 'Notification marked as read' })
  } catch (error) {
    return next(error)
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const loginName = req.user?.login_name

    if (!loginName) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    await query(
      `
        UPDATE notifications
        SET is_read = TRUE,
            read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE recipient_login = $1
          AND is_read = FALSE
      `,
      [loginName],
    )

    return res.json({ message: 'Notifications marked as read' })
  } catch (error) {
    return next(error)
  }
}
