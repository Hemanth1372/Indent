import { Ban, Bell, ChevronDown, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type TopNavProps = {
  onMenuClick: () => void
  title: string
}

export default function TopNav({ onMenuClick, title }: TopNavProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

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
        <button
          className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          type="button"
          title="Notifications"
        >
          <Bell size={20} />
        </button>
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
