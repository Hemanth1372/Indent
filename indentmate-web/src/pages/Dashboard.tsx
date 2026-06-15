import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, Factory, FileText, PackageCheck, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

type IndentTransaction = {
  id: string
  app_request_id?: string | null
  indent_no: string
  project_code: string
  project_name?: string | null
  source_warehouse?: string | null
  source_warehouse_name?: string | null
  source_location?: string | null
  delivery_location?: string | null
  delivery_location_name?: string | null
  indent_type?: string | null
  to_entity_type?: string | null
  to_entity_id?: string | null
  status: string
  created_at: string
}

type IndentsResponse = {
  data: IndentTransaction[]
}

type DrillDown = {
  title: string
  subtitle: string
  rows: IndentTransaction[]
}

const pendingStatuses = new Set(['CREATED', 'PENDING', 'PENDINGAPPROVAL', 'APPROVALPENDING'])
const issuedStatuses = new Set(['ISSUE', 'ISSUED', 'PARTIALLYISSUED', 'COMPLETED'])

const statusStyles: Record<string, string> = {
  Created: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PendingApproval: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ApprovalPending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Issue: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  Issued: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  PartiallyIssued: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  Completed: 'bg-green-50 text-green-700 ring-green-600/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<IndentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      try {
        const response = await api.get<IndentsResponse>('/api/indents')

        if (isMounted) {
          setTransactions(response.data.data)
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load dashboard data.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
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

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [transactions],
  )

  const pendingRows = useMemo(() => sortedTransactions.filter((indent) => isPendingStatus(indent.status)), [sortedTransactions])
  const approvedRows = useMemo(() => sortedTransactions.filter((indent) => normalizeStatus(indent.status) === 'APPROVED'), [sortedTransactions])
  const issuedRows = useMemo(() => sortedTransactions.filter((indent) => issuedStatuses.has(normalizeStatus(indent.status))), [sortedTransactions])
  const rejectedRows = useMemo(() => sortedTransactions.filter((indent) => normalizeStatus(indent.status) === 'REJECTED'), [sortedTransactions])
  const recentRows = sortedTransactions.slice(0, 6)
  const projectBreakdown = useMemo(() => buildProjectBreakdown(sortedTransactions), [sortedTransactions])
  const monthlyBreakdown = useMemo(() => buildMonthlyBreakdown(sortedTransactions), [sortedTransactions])
  const visibleDrillDown = drillDown ?? {
    title: 'Requests Needing Action',
    subtitle: 'Created and pending indents waiting for admin review',
    rows: pendingRows,
  }
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'User'

  function setStatusDrill(title: string, subtitle: string, rows: IndentTransaction[]) {
    setDrillDown({ title, subtitle, rows })
  }

  return (
    <section className="w-full space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Admin Control</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Welcome, {displayName}</h2>
          <p className="mt-1 text-sm text-slate-500">Monitor indent volume, approvals, issue progress, and project workload.</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => navigate('/transactions')}
          type="button"
        >
          All Transactions
          <ArrowUpRight size={16} />
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          color="amber"
          icon={<Clock3 size={18} />}
          label="Needs Action"
          onClick={() => setStatusDrill('Requests Needing Action', 'Created and pending indents waiting for admin review', pendingRows)}
          value={pendingRows.length}
        />
        <MetricCard
          color="blue"
          icon={<FileText size={18} />}
          label="Total Indents"
          onClick={() => setStatusDrill('All Indents', 'Every indent request available in the system', sortedTransactions)}
          value={sortedTransactions.length}
        />
        <MetricCard
          color="emerald"
          icon={<CheckCircle2 size={18} />}
          label="Approved"
          onClick={() => setStatusDrill('Approved Indents', 'Requests approved and ready for issue workflow', approvedRows)}
          value={approvedRows.length}
        />
        <MetricCard
          color="cyan"
          icon={<PackageCheck size={18} />}
          label="Issued"
          onClick={() => setStatusDrill('Issued Indents', 'Requests already issued or completed', issuedRows)}
          value={issuedRows.length}
        />
        <MetricCard
          color="red"
          icon={<XCircle size={18} />}
          label="Rejected"
          onClick={() => setStatusDrill('Rejected Indents', 'Requests rejected by approvers', rejectedRows)}
          value={rejectedRows.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Project Workload</h3>
              <p className="mt-1 text-sm text-slate-500">Click a project to drill into its indents.</p>
            </div>
            <Factory className="text-slate-400" size={20} />
          </div>
          <div className="mt-4 space-y-3">
            {projectBreakdown.length === 0 ? (
              <EmptyState label={isLoading ? 'Loading project workload...' : 'No project workload yet.'} />
            ) : projectBreakdown.map((project) => (
              <button
                className="grid w-full grid-cols-[minmax(150px,260px)_1fr_72px] items-center gap-4 rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                key={project.key}
                onClick={() => setDrillDown({
                  title: `Project ${project.code}`,
                  subtitle: project.description || 'Project indent requests',
                  rows: project.rows,
                })}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-bold text-slate-900">{project.code}</span>
                  <span className="block truncate text-xs text-slate-500">{project.description || '-'}</span>
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-blue-600" style={{ width: `${project.width}%` }} />
                </span>
                <span className="text-right text-sm font-bold text-slate-800">{project.total}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly Intake</h3>
            <p className="mt-1 text-sm text-slate-500">Recent request volume by month.</p>
          </div>
          <div className="mt-4 space-y-3">
            {monthlyBreakdown.length === 0 ? (
              <EmptyState label={isLoading ? 'Loading monthly intake...' : 'No monthly intake yet.'} />
            ) : monthlyBreakdown.map((month, index) => (
              <button
                className="grid w-full grid-cols-[92px_1fr_64px] items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
                key={month.key}
                onClick={() => setDrillDown({
                  title: `${month.label} Indents`,
                  subtitle: 'Requests created in this month',
                  rows: month.rows,
                })}
                type="button"
              >
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">{month.label}</span>
                <span className="h-8 overflow-hidden rounded-full bg-slate-100">
                  <span className="flex h-full items-center justify-end rounded-full px-3 text-xs font-bold text-white" style={{ backgroundColor: monthFill(index), width: `${month.width}%` }}>
                    {month.total > 0 ? month.total : ''}
                  </span>
                </span>
                <span className="text-right text-sm font-bold text-slate-800">{month.total}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <SimpleList
          rows={pendingRows.slice(0, 5)}
          title="Approval Queue"
          emptyLabel={isLoading ? 'Loading approval queue...' : 'No indents currently need action.'}
          onOpen={(indent) => navigate(`/transactions/${indent.id}`)}
        />
        <SimpleList
          rows={recentRows}
          title="Recent Activity"
          emptyLabel={isLoading ? 'Loading recent activity...' : 'No recent indents yet.'}
          onOpen={(indent) => navigate(`/transactions/${indent.id}`)}
        />
      </div>

      <DrillDownPanel
        drillDown={visibleDrillDown}
        onClear={() => setDrillDown(null)}
        onOpen={(indent) => navigate(`/transactions/${indent.id}`)}
        showClear={Boolean(drillDown)}
      />
    </section>
  )
}

function MetricCard({ color, icon, label, onClick, value }: { color: 'amber' | 'blue' | 'cyan' | 'emerald' | 'red'; icon: React.ReactNode; label: string; onClick: () => void; value: number }) {
  const colors = {
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <button className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" onClick={onClick} type="button">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${colors[color]}`}>{icon}</span>
      <span className="mt-4 block text-3xl font-black text-slate-900">{value}</span>
      <span className="mt-1 block text-sm font-bold text-slate-500">{label}</span>
    </button>
  )
}

function SimpleList({ emptyLabel, onOpen, rows, title }: { emptyLabel: string; onOpen: (indent: IndentTransaction) => void; rows: IndentTransaction[]; title: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <div className="mt-4 divide-y divide-slate-100">
        {rows.length === 0 ? (
          <EmptyState label={emptyLabel} />
        ) : rows.map((indent) => (
          <button className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-50" key={indent.id} onClick={() => onOpen(indent)} type="button">
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm font-bold text-slate-900">{indent.app_request_id || indent.indent_no}</span>
              <span className="block truncate text-xs text-slate-500">{formatPair(indent.project_code, indent.project_name)} • {formatDate(indent.created_at)}</span>
            </span>
            <StatusBadge status={indent.status} />
          </button>
        ))}
      </div>
    </div>
  )
}

function DrillDownPanel({ drillDown, onClear, onOpen, showClear }: { drillDown: DrillDown; onClear: () => void; onOpen: (indent: IndentTransaction) => void; showClear: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">{drillDown.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{drillDown.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{drillDown.rows.length} Records</span>
          {showClear ? (
            <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50" onClick={onClear} type="button">
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-20 px-4 py-3">Open</th>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Indent</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drillDown.rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No matching indents found.</td>
              </tr>
            ) : drillDown.rows.map((indent) => (
              <tr className="transition hover:bg-blue-50/40" key={indent.id}>
                <td className="px-4 py-4">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={() => onOpen(indent)} type="button">
                    <ArrowUpRight size={15} />
                  </button>
                </td>
                <td className="px-4 py-4 font-mono font-bold text-emerald-700">{indent.app_request_id || '-'}</td>
                <td className="px-4 py-4 font-mono font-bold text-slate-900">{indent.indent_no}</td>
                <td className="px-4 py-4 text-slate-700">{formatDate(indent.created_at)}</td>
                <td className="px-4 py-4 text-slate-700">{formatPair(indent.project_code, indent.project_name)}</td>
                <td className="px-4 py-4 text-slate-700">{formatPair(indent.source_warehouse, indent.source_warehouse_name)}</td>
                <td className="px-4 py-4"><StatusBadge status={indent.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusStyles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {status}
    </span>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{label}</div>
}

function buildProjectBreakdown(rows: IndentTransaction[]) {
  const grouped = new Map<string, { code: string; description: string; rows: IndentTransaction[] }>()

  for (const row of rows) {
    const code = row.project_code || '-'
    const key = code.toLowerCase()
    const current = grouped.get(key) ?? { code, description: row.project_name || '', rows: [] }
    current.rows.push(row)

    if (!current.description && row.project_name) {
      current.description = row.project_name
    }

    grouped.set(key, current)
  }

  const projects = [...grouped.values()].sort((a, b) => b.rows.length - a.rows.length).slice(0, 6)
  const max = Math.max(1, ...projects.map((project) => project.rows.length))

  return projects.map((project) => ({
    ...project,
    key: project.code,
    total: project.rows.length,
    width: Math.max(8, Math.round((project.rows.length / max) * 100)),
  }))
}

function buildMonthlyBreakdown(rows: IndentTransaction[]) {
  const grouped = new Map<string, IndentTransaction[]>()

  for (const row of rows) {
    const key = new Date(row.created_at).toISOString().slice(0, 7)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const months = [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .map(([key, monthRows]) => ({
      key,
      label: formatMonthLabel(key),
      rows: monthRows,
      total: monthRows.length,
    }))
  const max = Math.max(1, ...months.map((month) => month.total))

  return months.map((month) => ({
    ...month,
    width: Math.max(8, Math.round((month.total / max) * 100)),
  }))
}

function monthFill(index: number) {
  return ['#2563eb', '#0f766e', '#9333ea', '#d97706'][index % 4]
}

function isPendingStatus(status: string) {
  return pendingStatuses.has(normalizeStatus(status))
}

function normalizeStatus(status: string) {
  return String(status ?? '').trim().toUpperCase()
}

function formatPair(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} (${cleanDescription})`
  }

  return cleanCode || cleanDescription || '-'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map((part) => Number.parseInt(part, 10))

  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}
