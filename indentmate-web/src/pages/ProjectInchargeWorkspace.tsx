import { ArrowLeft, CheckCircle2, Clock3, FileText, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { isProjectInchargeRole } from '../utils/roles'
import Transactions from './Transactions'

type AssignedProject = {
  project_id: string
  project_name: string
  location?: string
  status?: string
  role_name: string
}

type IndentTransaction = {
  id: string
  app_request_id?: string | null
  indent_no: string
  project_code: string
  project_name?: string | null
  source_warehouse?: string | null
  source_warehouse_name?: string | null
  status: string
  created_at: string
}

type IndentsResponse = {
  data: IndentTransaction[]
}

const pendingStatuses = new Set(['CREATED', 'PENDING', 'PENDINGAPPROVAL', 'APPROVALPENDING'])

export default function ProjectInchargeWorkspace() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const projects = useMemo(() => getProjectInchargeProjects(user?.assigned_projects ?? user?.assignedProjects ?? []), [user])
  const [selectedProjectCode, setSelectedProjectCode] = useState('')
  const [indents, setIndents] = useState<IndentTransaction[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'Project Incharge'
  const roleLabel = user?.role?.trim() || user?.primary_role?.trim() || user?.responsibility?.trim() || 'PRI'

  useEffect(() => {
    setSelectedProjectCode((current) => projects.some((project) => project.project_id === current) ? current : '')
  }, [projects])

  async function loadIndents() {
    if (projects.length === 0) {
      setIndents([])
      return
    }

    try {
      const query = selectedProjectCode ? `?projectCode=${encodeURIComponent(selectedProjectCode)}` : ''
      const response = await api.get<IndentsResponse>(`/api/indents/review${query}`)
      setIndents(response.data.data)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load project indent dashboard.')
    }
  }

  useEffect(() => {
    void loadIndents()
  }, [selectedProjectCode])

  useEffect(() => {
    const refresh = () => void loadIndents()

    window.addEventListener('notifications-refreshed', refresh)
    window.addEventListener('indent-status-updated', refresh)

    return () => {
      window.removeEventListener('notifications-refreshed', refresh)
      window.removeEventListener('indent-status-updated', refresh)
    }
  }, [selectedProjectCode])

  const sortedIndents = useMemo(() => [...indents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [indents])
  const pendingRows = useMemo(() => sortedIndents.filter((indent) => isPendingStatus(indent.status)), [sortedIndents])
  const approvedRows = useMemo(() => sortedIndents.filter((indent) => normalizeStatus(indent.status) === 'APPROVED'), [sortedIndents])
  const rejectedRows = useMemo(() => sortedIndents.filter((indent) => normalizeStatus(indent.status) === 'REJECTED'), [sortedIndents])

  function openDrilldown(kind: string, title: string, status = '', extraParams: Record<string, string> = {}) {
    const params = new URLSearchParams()
    if (selectedProjectCode) {
      params.set('projectCode', selectedProjectCode)
    }
    params.set('title', title)
    if (status) {
      params.set('status', status)
    }
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      }
    })
    params.set('kind', kind)
    navigate(`/project-review/drilldown?${params.toString()}`)
  }

  return (
    <section className="w-full space-y-4">
      <div className="overflow-hidden rounded-lg border border-blue-950/10 bg-white shadow-sm">
        <div className="flex w-full flex-col gap-3 px-4 py-4 text-left text-white md:flex-row md:items-center md:justify-between" style={{ backgroundColor: '#123468' }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-orange-300 bg-[#253f78] text-lg font-black">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{displayName}</p>
              <p className="mt-1 text-xs text-blue-100">
                ID {user?.login_name || user?.employee_id || user?.employeeId || '-'}
                <span className="ml-2 rounded bg-yellow-400 px-2 py-0.5 font-bold text-slate-900">{roleLabel}</span>
              </p>
            </div>
          </div>
          <select
            className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/60 md:w-[350px]"
            onChange={(event) => setSelectedProjectCode(event.target.value)}
            title={selectedProjectCode ? formatProjectOption(projects.find((project) => project.project_id === selectedProjectCode) ?? { project_id: selectedProjectCode, project_name: '' }) : 'All Projects'}
            value={selectedProjectCode}
          >
            <option className="text-slate-900" value="">All Projects</option>
            {projects.map((project) => (
              <option className="text-slate-900" key={project.project_id} value={project.project_id}>
                {formatProjectOption(project)}
              </option>
            ))}
          </select>
        </div>
        {projects.length === 0 ? (
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
            No active Project Incharge project assignment is available for this login.
          </p>
        ) : null}
      </div>

      {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{errorMessage}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard color="amber" icon={<Clock3 size={16} />} label="Pending" onClick={() => openDrilldown('pending', 'Pending', 'Pending')} value={pendingRows.length} />
        <MetricCard color="blue" icon={<FileText size={16} />} label="Total Indents" onClick={() => openDrilldown('all', 'Total Indents')} value={sortedIndents.length} />
        <MetricCard color="emerald" icon={<CheckCircle2 size={16} />} label="Approved" onClick={() => openDrilldown('approved', 'Approved', 'Approved')} value={approvedRows.length} />
        <MetricCard color="red" icon={<XCircle size={16} />} label="Rejected" onClick={() => openDrilldown('rejected', 'Rejected', 'Rejected')} value={rejectedRows.length} />
      </div>
    </section>
  )
}

export function ProjectInchargeDrilldown() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const projects = useMemo(() => getProjectInchargeProjects(user?.assigned_projects ?? user?.assignedProjects ?? []), [user])
  const projectCode = searchParams.get('projectCode') ?? ''
  const status = searchParams.get('status') ?? ''
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''
  const title = searchParams.get('title') ?? 'Indents'
  const projectOptions = useMemo(() => projects.map((project) => ({
    project_code: project.project_id,
    project_description: project.project_name,
  })), [projects])

  return (
    <section className="space-y-4">
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-950 px-4 text-sm font-black text-white transition hover:bg-blue-900"
        onClick={() => navigate('/project-review')}
        type="button"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      <Transactions
        detailPath={(id) => `/project-review/transactions/${id}`}
        emptyMessage="No matching indents found."
        enabled
        endpoint="/api/indents/review"
        extraParams={{ projectCode, status, date_from: dateFrom, date_to: dateTo }}
        eyebrow="Project Indents"
        projectOptions={projectOptions}
        showProjectFilter
        title={title}
      />
    </section>
  )
}

function MetricCard({ color, icon, label, onClick, value }: { color: 'amber' | 'blue' | 'emerald' | 'red'; icon: ReactNode; label: string; onClick: () => void; value: number }) {
  const colors = {
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <button className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" onClick={onClick} type="button">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${colors[color]}`}>{icon}</span>
      <span className="mt-3 block text-2xl font-black text-slate-900">{value}</span>
      <span className="mt-1 block text-xs font-bold text-slate-500">{label}</span>
    </button>
  )
}

function getProjectInchargeProjects(projects: AssignedProject[]) {
  const seen = new Set<string>()

  return projects
    .filter((project) => isProjectInchargeRole(project.role_name))
    .map((project) => ({
      ...project,
      project_id: String(project.project_id ?? '').trim(),
      project_name: String(project.project_name ?? '').trim(),
    }))
    .filter((project) => project.project_id)
    .filter((project) => {
      const key = project.project_id.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .sort((first, second) => first.project_id.localeCompare(second.project_id))
}

function formatProjectOption(project: Pick<AssignedProject, 'project_id' | 'project_name'>) {
  return project.project_name ? `${project.project_id} - ${project.project_name}` : project.project_id
}

function isPendingStatus(status: string) {
  return pendingStatuses.has(normalizeStatus(status))
}

function normalizeStatus(status: string) {
  return String(status ?? '').replace(/\s+/g, '').trim().toUpperCase()
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}
