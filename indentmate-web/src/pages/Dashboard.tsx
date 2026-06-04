import { useEffect, useState } from 'react'
import { api } from '../services/api'

type DashboardStats = {
  total: number
  approved: number
  pending: number
  issued: number
}

type DashboardProject = {
  id: number
  project_code: string
  project_description: string
}

type ProjectMasterResponse = {
  data: DashboardProject[]
  metadata?: {
    totalRecords: number
  }
}

export default function Dashboard() {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total: 0,
    approved: 0,
    pending: 0,
    issued: 0,
  })
  const [dashboardProjects, setDashboardProjects] = useState<DashboardProject[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      try {
        const [statsResponse, projectsResponse] = await Promise.all([
          api.get<{ data: DashboardStats }>('/api/dashboard/stats'),
          api.get<ProjectMasterResponse>('/api/master-data/project-master', {
            params: {
              page: 1,
              limit: 500,
            },
          }),
        ])

        if (isMounted) {
          setDashboardStats(statsResponse.data.data)
          setDashboardProjects(projectsResponse.data.data)
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

    return () => {
      isMounted = false
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', loadDashboardData)
    }
  }, [])

  const stats = [
    { value: dashboardStats.total, label: 'Total Indents', color: 'text-blue-600' },
    { value: dashboardStats.approved, label: 'Approved Indents', color: 'text-green-600' },
    { value: dashboardStats.pending, label: 'Pending Indents', color: 'text-amber-600' },
    { value: dashboardStats.issued, label: 'Issued Indents', color: 'text-cyan-600' },
  ]

  return (
    <section className="w-full">
      <div className="flex flex-col gap-5 rounded-xl bg-gradient-to-r from-blue-900 to-blue-500 px-8 py-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold">Administrator</h3>
          <p className="mt-1 text-sm text-blue-100">All Projects - All employees</p>
        </div>
        <select
          className="h-12 w-full rounded-xl border border-white/20 bg-white px-5 text-sm text-slate-500 shadow-sm outline-none sm:w-64"
          defaultValue="all"
        >
          <option value="all">All Projects</option>
          {dashboardProjects.map((project) => (
            <option key={project.id} value={project.project_code}>
              {project.project_code} - {project.project_description}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">All Projects Analytics Grid</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {dashboardProjects.map((project) => (
            <div className="rounded-md bg-slate-50 px-3 py-2" key={project.id}>
              <p className="font-mono text-sm font-bold text-slate-800">{project.project_code}</p>
              <p className="mt-1 text-sm text-slate-600">{project.project_description}</p>
            </div>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm"
            key={stat.label}
          >
            <div className={`text-4xl font-extrabold tracking-wider ${stat.color}`}>
              {stat.value}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
