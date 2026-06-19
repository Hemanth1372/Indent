import { ArrowRight, Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'

type NotificationRow = {
  id: string
  indent_no?: string | null
  title: string
  message: string
  status?: string | null
  target_path: string
  is_read: boolean
  created_at: string
}

type NotificationsResponse = {
  data: NotificationRow[]
  unreadCount: number
}

export default function NotificationsPage() {
  const { notificationId = '' } = useParams()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  const selectedNotification = useMemo(() => {
    return notifications.find((notification) => notification.id === notificationId) ?? null
  }, [notificationId, notifications])

  async function loadNotifications() {
    setIsLoading(true)
    try {
      const response = await api.get<NotificationsResponse>('/api/notifications')
      setNotifications(response.data.data)
      setUnreadCount(response.data.unreadCount)
      setMessage('')
    } catch {
      setMessage('Unable to load notifications.')
    } finally {
      setIsLoading(false)
    }
  }

  async function selectNotification(notification: NotificationRow) {
    navigate(`/notifications/${notification.id}`, { replace: notificationId === notification.id })

    if (!notification.is_read) {
      setUnreadCount((current) => Math.max(0, current - 1))
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      try {
        await api.patch(`/api/notifications/${notification.id}/read`)
        window.dispatchEvent(new CustomEvent('notifications-refreshed'))
      } catch {
        void loadNotifications()
      }
    }
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    setUnreadCount(0)
    await api.patch('/api/notifications/read-all')
    window.dispatchEvent(new CustomEvent('notifications-refreshed'))
  }

  async function clearNotifications() {
    await api.delete('/api/notifications')
    setNotifications([])
    setUnreadCount(0)
    setMessage('')
    navigate('/notifications', { replace: true })
    window.dispatchEvent(new CustomEvent('notifications-refreshed'))
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useEffect(() => {
    if (!selectedNotification || selectedNotification.is_read) {
      return
    }

    setUnreadCount((current) => Math.max(0, current - 1))
    setNotifications((current) => current.map((item) => item.id === selectedNotification.id ? { ...item, is_read: true } : item))
    api.patch(`/api/notifications/${selectedNotification.id}/read`)
      .then(() => window.dispatchEvent(new CustomEvent('notifications-refreshed')))
      .catch(() => void loadNotifications())
  }, [selectedNotification?.id])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Alerts</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{unreadCount} unread</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={notifications.length === 0 || unreadCount === 0}
            onClick={markAllRead}
            type="button"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={notifications.length === 0}
            onClick={clearNotifications}
            type="button"
          >
            <Trash2 size={16} />
            Clear notifications
          </button>
        </div>
      </div>

      {message ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black text-slate-900">All Notifications</p>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-slate-400">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-slate-400">No notifications received.</p>
            ) : notifications.map((notification) => (
              <button
                className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-blue-50 ${
                  selectedNotification?.id === notification.id ? 'bg-blue-50' : notification.is_read ? 'bg-white' : 'bg-amber-50/50'
                }`}
                key={notification.id}
                onClick={() => selectNotification(notification)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">{notification.title}</p>
                  {!notification.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">{notification.message}</p>
                <p className="mt-2 text-[11px] font-bold uppercase text-slate-400">
                  {notification.indent_no ?? 'Indent'} {notification.status ? `- ${notification.status}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[360px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedNotification ? (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <div>
                <Bell className="mx-auto" size={32} />
                <p className="mt-3 text-sm font-bold">Select a notification to view details.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{formatDateTime(selectedNotification.created_at)}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900">{selectedNotification.title}</h3>
                  <p className="mt-2 text-sm font-bold uppercase text-slate-400">
                    {selectedNotification.indent_no ?? 'Indent'} {selectedNotification.status ? `- ${selectedNotification.status}` : ''}
                  </p>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-950 px-4 text-sm font-black text-white transition hover:bg-blue-900"
                  onClick={() => navigate(selectedNotification.target_path)}
                  type="button"
                >
                  Open related indent
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-700">{selectedNotification.message}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
