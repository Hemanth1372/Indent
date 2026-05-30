import {
  ChevronDown,
  ChevronRight,
  Grid2X2,
  Home,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const mastersGroups = [
  {
    key: 'admin',
    label: 'Admin',
    items: [
      'User Master',
      'Role Master',
      'Project Master',
    ],
  },
  {
    key: 'location',
    label: 'Location',
    items: [
      'State Master',
      'Circle Master',
    ],
  },
  {
    key: 'project',
    label: 'Project',
    items: [
      'Employee Master',
      'Project BOQ Supply',
      'Project BOQ Erection',
      'Project Hindrance Master',
      'Location Master',
    ],
  },
]

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

type SidebarProps = {
  open: boolean
}

export default function Sidebar({ open }: SidebarProps) {
  const [mastersOpen, setMastersOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-[325px] flex-col bg-sidebar text-slate-300 shadow-xl transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="px-8 pb-7 pt-20">
        <h1 className="text-lg font-bold tracking-tight text-white">NCC Indent</h1>
        <div className="mt-5 flex gap-3">
          <Link
            className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/15"
            title="Home"
            to="/"
          >
            <Home size={18} />
          </Link>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/15"
            onClick={handleLogout}
            type="button"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-6">
        <NavLink
          className={({ isActive }) =>
            `flex h-12 items-center gap-4 border-l-4 px-5 text-sm font-semibold ${
              isActive
                ? 'border-amber-400 bg-cyan-900/45 text-white'
                : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
          to="/"
        >
          <LayoutDashboard className="text-amber-400" size={19} />
          Dashboard
        </NavLink>

        <button
          className={`flex h-12 w-full items-center gap-4 px-6 text-left text-sm font-semibold transition ${
            mastersOpen ? 'bg-cyan-900/35 text-white' : 'hover:bg-white/5 hover:text-white'
          }`}
          onClick={() => setMastersOpen((value) => !value)}
          type="button"
        >
          <Grid2X2 className={mastersOpen ? 'text-amber-400' : 'text-slate-300'} size={19} />
          <span className="flex-1">Masters</span>
          {mastersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {mastersOpen && (
          <div className="bg-[#102239]">
            {mastersGroups.map((group) => {
              const isOpen = openGroup === group.key

              return (
                <div key={group.key}>
                  <button
                    className={`flex w-full items-center px-11 py-3 text-left text-xs font-bold tracking-[0.3em] transition ${
                      isOpen ? 'bg-white/5 text-amber-400' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setOpenGroup(isOpen ? null : group.key)}
                    type="button"
                  >
                    <span className="flex-1">{group.label}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {isOpen && (
                    <div className="pb-2">
                      {group.items.map((item) => (
                        <NavLink
                          className={({ isActive }) =>
                            `flex min-h-10 items-center gap-3 px-16 py-2 text-sm transition ${
                              isActive
                                ? 'bg-white/[0.08] text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`
                          }
                          key={item}
                          to={`/masters/${group.key}/${slugify(item)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                          {item}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </nav>

      <div className="border-t border-white/5 px-24 py-4 text-[11px] text-slate-400">
        v1.0.0 - NCC IT TEAM
      </div>
    </aside>
  )
}
