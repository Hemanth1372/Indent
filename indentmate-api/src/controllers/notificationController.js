import { query } from '../db/pool.js'

export async function listNotifications(req, res, next) {
  try {
    const recipientLogin = getCurrentLogin(req)

    if (!recipientLogin) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    const result = await query(
      `
        SELECT
          id,
          recipient_login,
          indent_header_id,
          indent_no,
          title,
          message,
          status,
          target_path,
          is_read,
          created_at
        FROM notifications
        WHERE recipient_login = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [recipientLogin],
    )
    const unreadResult = await query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM notifications
        WHERE recipient_login = $1
          AND is_read = FALSE
      `,
      [recipientLogin],
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
    const recipientLogin = getCurrentLogin(req)

    if (!recipientLogin) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    await query(
      `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1
          AND recipient_login = $2
      `,
      [req.params.id, recipientLogin],
    )

    return res.json({ message: 'Notification marked as read' })
  } catch (error) {
    return next(error)
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const recipientLogin = getCurrentLogin(req)

    if (!recipientLogin) {
      return res.status(401).json({ message: 'Authenticated user is required' })
    }

    await query(
      `
        UPDATE notifications
        SET is_read = TRUE
        WHERE recipient_login = $1
      `,
      [recipientLogin],
    )

    return res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    return next(error)
  }
}

function getCurrentLogin(req) {
  return String(req.user?.login_name ?? req.user?.employeeId ?? req.user?.employee_id ?? '').trim()
}
