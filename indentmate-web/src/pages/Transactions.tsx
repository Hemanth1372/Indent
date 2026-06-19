import { AlertCircle, ArrowLeft, ArrowUpRight, Building2, CalendarDays, Factory, MapPin, Send, Zap } from 'lucide-react'
  import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'

type IndentLineItem = {
  id?: string
  line_number: number
  item_code: string
  item_name?: string
  uom: string
  required_qty: string | number
  issued_qty: string | number
}

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
  items: IndentLineItem[]
}

type IndentsResponse = {
  data: IndentTransaction[]
}

type ProjectOption = {
  project_code: string
  project_description?: string | null
}

const statusBadgeClasses: Record<string, string> = {
  Created: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  'Pending Sync': 'bg-blue-50 text-blue-700 ring-blue-600/20',
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

type TransactionsProps = {
  allowAllProjects?: boolean
  backLabel?: string
  backPath?: string
  detailPath?: (id: string) => string
  endpoint?: string
  eyebrow?: string
  enabled?: boolean
  emptyMessage?: string
  extraParams?: Record<string, string>
  projectOptions?: ProjectOption[]
  projectOptionsEndpoint?: string
  showProjectFilter?: boolean
  refreshKey?: number
  title?: string
}

export default function Transactions({
  allowAllProjects = true,
  backLabel = 'Back',
  backPath,
  detailPath = (id) => `/transactions/${id}`,
  endpoint = '/api/indents',
  eyebrow = 'Material Ledger',
  enabled = true,
  emptyMessage = 'No transactions created yet.',
  extraParams = {},
  projectOptions: scopedProjectOptions,
  projectOptionsEndpoint = '/api/master-data/project-master',
  showProjectFilter = endpoint === '/api/indents',
  refreshKey = 0,
  title = 'Transactions',
}: TransactionsProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [transactions, setTransactions] = useState<IndentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [dateFrom, setDateFrom] = useState(() => extraParams.date_from ?? searchParams.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(() => extraParams.date_to ?? searchParams.get('date_to') ?? '')
  const [projectFilter, setProjectFilter] = useState(() => extraParams.projectCode ?? searchParams.get('projectCode') ?? '')
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const statusFilter = extraParams.status ?? searchParams.get('status') ?? ''
  const projectSelectOptions = useMemo(
    () => projectOptions
      .map((project) => {
        const code = String(project.project_code ?? '').trim()
        const description = String(project.project_description ?? '').trim()
        return {
          label: description ? `${code} - ${description}` : code,
          value: code,
        }
      })
      .filter((project) => project.value),
    [projectOptions],
  )

  async function fetchTransactions() {
    if (!enabled) {
      setTransactions([])
      setIsLoading(false)
      setErrorMessage('')
      return
    }

    setIsLoading(true)

    try {
      const params = new URLSearchParams()

      Object.entries(extraParams).forEach(([key, value]) => {
        if (showProjectFilter && key === 'projectCode') {
          return
        }
        if (value) {
          params.set(key, value)
        }
      })

      if (dateFrom) {
        params.set('date_from', dateFrom)
      }

      if (dateTo) {
        params.set('date_to', dateTo)
      }

      if (statusFilter) {
        params.set('status', statusFilter)
      }

      if (projectFilter) {
        params.set('projectCode', projectFilter)
      }

      const queryString = params.toString()
      const response = await api.get<IndentsResponse>(`${endpoint}${queryString ? `?${queryString}` : ''}`)
      setTransactions(response.data.data)
      setErrorMessage('')
    } catch (error) {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : ''
      setErrorMessage(message || 'Unable to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }

  function clearDateFilters() {
    setDateFrom('')
    setDateTo('')
    setProjectFilter('')
  }

  async function fetchProjectOptions() {
    if (!showProjectFilter) {
      return
    }

    if (scopedProjectOptions) {
      setProjectOptions(scopedProjectOptions)
      return
    }

    setProjectOptionsLoading(true)

    try {
      const response = await api.get<{ data: ProjectOption[] }>(projectOptionsEndpoint, {
        params: projectOptionsEndpoint.includes('/api/master-data/') ? { limit: 500 } : undefined,
      })
      setProjectOptions(response.data.data)
    } catch {
      setProjectOptions([])
    } finally {
      setProjectOptionsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [enabled, endpoint, refreshKey, statusFilter, projectFilter, JSON.stringify(extraParams)])

  useEffect(() => {
    fetchProjectOptions()
  }, [showProjectFilter, projectOptionsEndpoint, JSON.stringify(scopedProjectOptions ?? [])])

  useEffect(() => {
    const refresh = () => void fetchTransactions()

    window.addEventListener('notifications-refreshed', refresh)
    window.addEventListener('indent-status-updated', refresh)

    return () => {
      window.removeEventListener('notifications-refreshed', refresh)
      window.removeEventListener('indent-status-updated', refresh)
    }
  }, [enabled, endpoint, dateFrom, dateTo, statusFilter, projectFilter, JSON.stringify(extraParams)])

  useEffect(() => {
    if (!dateFrom && !dateTo) {
      fetchTransactions()
    }
  }, [dateFrom, dateTo])

  return (
    <section className="w-full">
      <div className="grid gap-4 border-b border-slate-200 pb-4 xl:grid-cols-[minmax(240px,360px)_1fr] xl:items-end">
        <div className="min-w-0">
          {backPath ? (
            <button
              className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={() => navigate(backPath)}
              type="button"
            >
              <ArrowLeft size={16} />
              {backLabel}
            </button>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className={`grid w-full gap-3 lg:items-end ${
          showProjectFilter
            ? 'lg:grid-cols-[minmax(420px,1fr)_150px_150px_auto]'
            : 'lg:grid-cols-[150px_150px_auto] lg:justify-end'
        }`}>
          {showProjectFilter ? (
            <label className="flex min-w-0 flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              Project
              <select
                className="h-10 w-full min-w-0 truncate rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                disabled={projectOptionsLoading}
                onChange={(event) => setProjectFilter(event.target.value)}
                title={projectSelectOptions.find((project) => project.value === projectFilter)?.label ?? 'All projects'}
                value={projectFilter}
              >
                {allowAllProjects ? <option value="">All projects</option> : null}
                {projectSelectOptions.map((project) => (
                  <option key={project.value} value={project.value}>{project.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            From
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            To
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </label>
          <div className="flex gap-2 lg:justify-end">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={fetchTransactions}
              type="button"
            >
              Apply
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || (!dateFrom && !dateTo && !projectFilter)}
              onClick={clearDateFilters}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-20 px-4 py-3 text-center">Open</th>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Indent</th>
                <th className="px-4 py-3">Date</th>
                <th className="min-w-[250px] px-4 py-3">Project</th>
                <th className="min-w-[240px] px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                    {enabled ? emptyMessage : 'Select a project to load transactions.'}
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr className="transition hover:bg-blue-50/50" key={transaction.id}>
                    <td className="px-4 py-4 text-center">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                        onClick={() => navigate(detailPath(transaction.id))}
                        title={`Open ${transaction.indent_no}`}
                        type="button"
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-emerald-700">{transaction.app_request_id || '-'}</td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-900">{transaction.indent_no}</td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<CalendarDays size={14} />} value={formatShortDate(transaction.created_at)} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<Building2 size={14} />} value={formatWithParentheses(transaction.project_code, transaction.project_name)} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<Factory size={14} />} value={formatWithParentheses(transaction.source_warehouse, transaction.source_warehouse_name)} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<Zap size={14} />} value={transaction.indent_type || '-'} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<MapPin size={14} />} value={transaction.source_location || '-'} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <MetaText icon={<Send size={14} />} value={transaction.to_entity_id || transaction.to_entity_type || '-'} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={transaction.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function MetaText({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={value}>
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const displayStatus = displayIndentStatus(status)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadgeClasses[displayStatus] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {displayStatus}
    </span>
  )
}

function displayIndentStatus(status: string) {
  const normalized = String(status ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (normalized === 'PENDINGSYNC') return 'Pending Sync'
  if (normalized === 'APPROVED') return 'Approved'
  if (normalized === 'REJECTED') return 'Rejected'
  return 'Pending'
}

function formatWithParentheses(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} (${cleanDescription})`
  }

  return cleanCode || cleanDescription || '-'
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
