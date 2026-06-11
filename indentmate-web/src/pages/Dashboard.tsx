import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

type DashboardStats = {
  total: number
  approved: number
  pending: number
  issued: number
  rejected: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total: 0,
    approved: 0,
    pending: 0,
    issued: 0,
    rejected: 0,
  })
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      try {
        const statsResponse = await api.get<{ data: DashboardStats }>('/api/dashboard/stats')

        if (isMounted) {
          setDashboardStats(statsResponse.data.data)
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load dashboard data.')
        }
      }
    }

    loadDashboardData()
    const refreshInterval = window.setInterval(loadDashboardData, 15000)
    window.addEventListener('focus', loadDashboardData)
    window.addEventListener('indent-status-updated', loadDashboardData)

    return () => {
      isMounted = false
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', loadDashboardData)
      window.removeEventListener('indent-status-updated', loadDashboardData)
    }
  }, [])

  const stats = [
    { value: dashboardStats.total, label: 'Total', fill: '#2563eb' },
    { value: dashboardStats.approved, label: 'Approved', fill: '#16a34a' },
    { value: dashboardStats.pending, label: 'Pending', fill: '#d97706' },
    { value: dashboardStats.issued, label: 'Issued', fill: '#0891b2' },
    { value: dashboardStats.rejected, label: 'Rejected', fill: '#dc2626' },
  ]
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'User'

  return (
    <section className="w-full">
      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5">
        <h2 className="text-2xl font-bold text-slate-800">Welcome, {displayName}</h2>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Indent Status Overview</h3>
              <p className="mt-1 text-sm text-slate-500">Current indent volume by workflow state</p>
            </div>
            <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {dashboardStats.total} Total
            </span>
          </div>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.slice(1)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stats.slice(1).map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800">Status Mix</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.slice(1)} dataKey="value" nameKey="label" innerRadius={54} outerRadius={86} paddingAngle={3}>
                  {stats.slice(1).map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {stats.slice(1).map((stat) => (
              <div className="flex items-center justify-between text-sm" key={stat.label}>
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stat.fill }} />
                  {stat.label}
                </span>
                <span className="font-bold text-slate-800">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
