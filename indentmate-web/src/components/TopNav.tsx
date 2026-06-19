import { Ban, Bell, ChevronDown, Menu, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

type TopNavProps = {
  onMenuClick: () => void
  title: string
}

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

export default function TopNav({ onMenuClick, title }: TopNavProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  async function loadNotifications() {
    setNotificationsLoading(true)

    try {
      const { data } = await api.get<{ data: NotificationRow[]; unreadCount: number }>('/api/notifications')
      setNotifications(data.data)
      setUnreadCount(data.unreadCount)
      window.dispatchEvent(new CustomEvent('notifications-refreshed'))
    } catch (error) {
      console.error(error)
    } finally {
      setNotificationsLoading(false)
    }
  }

  async function openNotification(notification: NotificationRow) {
    setNotificationsOpen(false)

    if (!notification.is_read) {
      setUnreadCount((current) => Math.max(0, current - 1))
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item),
      )
      api.patch(`/api/notifications/${notification.id}/read`).catch(() => {
        void loadNotifications()
      })
    }

    navigate(`/notifications/${notification.id}`)
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    setUnreadCount(0)
    await api.patch('/api/notifications/read-all')
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    void loadNotifications()

    const intervalId = window.setInterval(loadNotifications, 30000)
    const refresh = () => void loadNotifications()

    window.addEventListener('focus', refresh)
    window.addEventListener('indent-status-updated', refresh)
    window.addEventListener('indent-created', refresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('indent-status-updated', refresh)
      window.removeEventListener('indent-created', refresh)
    }
  }, [])

  return (
    <header className="flex h-[74px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
      <div className="flex items-center gap-7">
        <button
          className="grid h-10 w-10 place-items-center rounded-md text-slate-700 transition hover:bg-slate-100"
          onClick={onMenuClick}
          type="button"
          title="Toggle sidebar"
        >
          <Menu size={26} />
        </button>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className="relative grid h-12 w-12 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            onClick={() => navigate('/notifications')}
            type="button"
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <>
              <button
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                onClick={() => setNotificationsOpen(false)}
                type="button"
              />
              <div className="absolute right-0 top-14 z-50 w-[340px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-slate-900">Notifications</p>
                  <p className="text-xs font-semibold text-slate-400">{unreadCount} unread</p>
                </div>
                <button className="text-xs font-bold text-blue-700 hover:text-blue-900" onClick={markAllRead} type="button">
                  Mark all read
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notificationsLoading && notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm font-semibold text-slate-400">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm font-semibold text-slate-400">No notifications received.</div>
                ) : notifications.map((notification) => (
                  <button
                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50 ${
                      notification.is_read ? 'bg-white' : 'bg-blue-50/70'
                    }`}
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-slate-900">{notification.title}</p>
                      {!notification.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{notification.message}</p>
                    <p className="mt-2 text-[11px] font-bold uppercase text-slate-400">
                      {notification.indent_no ?? 'Indent'} {notification.status ? `- ${notification.status}` : ''}
                    </p>
                  </button>
                ))}
              </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="relative">
          <button
            className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 pr-5 text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => setProfileOpen((value) => !value)}
            type="button"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-700 text-white">
              <UserRound size={20} />
            </span>
            <span className="hidden font-medium sm:inline">{user?.name ?? 'Administrator'}</span>
            <ChevronDown className="hidden text-slate-400 sm:block" size={14} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-16 z-40 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="px-4 py-3">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="mt-1 font-bold text-slate-800">{user?.name ?? 'Administrator'}</p>
              </div>
              <button
                className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-semibold text-red-600 transition hover:bg-red-50"
                onClick={handleLogout}
                type="button"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-red-100 text-red-600">
                  <Ban size={17} />
                </span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
