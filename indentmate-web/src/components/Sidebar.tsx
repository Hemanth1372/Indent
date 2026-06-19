import {
  ChevronDown,
  ChevronRight,
  Grid2X2,
  Home,
  LayoutDashboard,
  LogOut,
  ReceiptText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import headerLogo from '../assets/header-logo.png'
import { useAuth } from '../context/AuthContext'
import { isAdminUser, isProjectInchargeUser } from './SuperAdminRoute'

const mastersGroups = [
  {
    key: 'admin',
    label: 'Admin',
    items: [
      'User Master',
      'User Project Assignment Master',
      'Role Master',
      'Business Partner Master',
      'Business Partner Activity Master',
      'Engineer by Activity Master',
    ],
  },
  {
    key: 'location',
    label: 'Location',
    items: [
      'Location Master',
      'Delivery Point Master',
    ],
  },
  {
    key: 'project',
    label: 'Project',
    items: [
      'Project Master',
      'Activity Master',
      'Service Orders',
      'Rental Orders',
      'Purchase Order Master',
      'Purchase Office Master',
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      'Item Master',
      'Warehouse Master',
      'Warehouse Location Master',
    ],
  },
]

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getMasterPath(groupKey: string, item: string) {
  if (item === 'User Master') {
    return '/admin/user-master'
  }

  const realMasterItems = new Set([
    'Role Master',
    'User Project Assignment Master',
    'Project Master',
    'Activity Master',
    'Service Orders',
    'Rental Orders',
    'Purchase Order Master',
    'Purchase Office Master',
    'Engineer by Activity Master',
    'Business Partner Master',
    'Business Partner Activity Master',
    'Location Master',
    'Delivery Point Master',
    'Item Master',
    'Warehouse Master',
    'Warehouse Location Master',
  ])

  if (realMasterItems.has(item)) {
    if (item === 'Role Master') {
      return '/master-data/role-master'
    }

    if (item === 'User Project Assignment Master') {
      return '/master-data/responsibility-master'
    }

    if (item === 'Business Partner Activity Master') {
      return '/master-data/business-partner-master'
    }

    if (item === 'Business Partner Master') {
      return '/master-data/business-partner-code-master'
    }

    if (item === 'Warehouse Location Master') {
      return '/master-data/warehouse-bin-master'
    }

    if (item === 'Service Orders') {
      return '/master-data/service-order-master'
    }

    if (item === 'Rental Orders') {
      return '/master-data/rental-order-master'
    }

    if (item === 'Purchase Order Master') {
      return '/master-data/purchase-office-master'
    }

    if (item === 'Purchase Office Master') {
      return '/master-data/purchase-office-code-master'
    }

    if (item === 'Engineer by Activity Master') {
      return '/master-data/engineer-activity-master'
    }

    return `/master-data/${slugify(item)}`
  }

  return `/masters/${groupKey}/${slugify(item)}`
}

type SidebarProps = {
  open: boolean
}

export default function Sidebar({ open }: SidebarProps) {
  const location = useLocation()
  const activeGroup = getActiveGroup(location.pathname)
  const [mastersOpen, setMastersOpen] = useState(Boolean(activeGroup))
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup)
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = isAdminUser(user)
  const isProjectIncharge = isProjectInchargeUser(user)

  useEffect(() => {
    const nextActiveGroup = getActiveGroup(location.pathname)

    if (nextActiveGroup) {
      setMastersOpen(true)
      setOpenGroup(nextActiveGroup)
    }
  }, [location.pathname])

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
      <div className="px-8 pb-7 pt-16">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-5 shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
          <div className="grid justify-items-center gap-3 text-center">
            <img
              alt="NCC Limited"
              className="h-auto w-40 rounded-md bg-white px-3 py-2 shadow-lg shadow-slate-950/20"
              src={headerLogo}
            />
            <div>
              <h1 className="text-2xl font-black leading-none tracking-tight text-white">Indent</h1>
            </div>
          </div>
        </div>
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
        {isAdmin && (
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
        )}

        {isAdmin && (
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
        )}

        {isAdmin && mastersOpen && (
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
                          to={getMasterPath(group.key, item)}
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

        {isAdmin && (
          <NavLink
            className={({ isActive }) =>
              `flex h-12 items-center gap-4 border-l-4 px-5 text-sm font-semibold ${
                isActive
                  ? 'border-amber-400 bg-cyan-900/45 text-white'
                  : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
            to="/transactions"
          >
            <ReceiptText className="text-amber-400" size={19} />
            Transactions
          </NavLink>
        )}

        {isProjectIncharge && (
          <NavLink
            className={({ isActive }) =>
              `flex h-12 items-center gap-4 border-l-4 px-5 text-sm font-semibold ${
                isActive
                  ? 'border-amber-400 bg-cyan-900/45 text-white'
                  : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
            to="/project-review"
          >
            <LayoutDashboard className="text-amber-400" size={19} />
            Indents
          </NavLink>
        )}

        {!isAdmin && !isProjectIncharge && (
          <>
            <NavLink
              className={({ isActive }) =>
                `flex h-12 items-center gap-4 border-l-4 px-5 text-sm font-semibold ${
                  isActive
                    ? 'border-amber-400 bg-cyan-900/45 text-white'
                    : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
              to="/indent-workspace"
            >
              <LayoutDashboard className="text-amber-400" size={19} />
              Indent Home
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `flex h-12 items-center gap-4 border-l-4 px-5 text-sm font-semibold ${
                  isActive
                    ? 'border-amber-400 bg-cyan-900/45 text-white'
                    : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
              to="/indent-transactions"
            >
              <ReceiptText className="text-amber-400" size={19} />
              Transactions
            </NavLink>
          </>
        )}

      </nav>

      <div className="border-t border-white/5 px-24 py-4 text-[11px] text-slate-400">
        v1.0.0 - NCC TEAM
      </div>
    </aside>
  )
}

function getActiveGroup(pathname: string) {
  for (const group of mastersGroups) {
    if (group.items.some((item) => getMasterPath(group.key, item) === pathname)) {
      return group.key
    }
  }

  if (pathname.startsWith('/master-data/')) {
    return 'project'
  }

  return null
}
