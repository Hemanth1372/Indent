import { AlertCircle, ArrowUpRight, Building2, CalendarDays, Factory, MapPin, RefreshCw, Send, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const statusBadgeClasses: Record<string, string> = {
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

type TransactionsProps = {
  detailPath?: (id: string) => string
  endpoint?: string
  eyebrow?: string
  title?: string
}

export default function Transactions({
  detailPath = (id) => `/transactions/${id}`,
  endpoint = '/api/indents',
  eyebrow = 'Material Ledger',
  title = 'Transactions',
}: TransactionsProps) {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<IndentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function fetchTransactions() {
    setIsLoading(true)

    try {
      const params = new URLSearchParams()

      if (dateFrom) {
        params.set('date_from', dateFrom)
      }

      if (dateTo) {
        params.set('date_to', dateTo)
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
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    if (!dateFrom && !dateTo) {
      fetchTransactions()
    }
  }, [dateFrom, dateTo])

  return (
    <section className="w-full">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
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
          <div className="flex gap-2">
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
              disabled={isLoading || (!dateFrom && !dateTo)}
              onClick={clearDateFilters}
              type="button"
            >
              Clear
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={fetchTransactions}
              type="button"
            >
              <RefreshCw size={16} />
              Refresh
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
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-20 px-4 py-3 text-center">Open</th>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">Indent</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Warehouse</th>
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
                    No transactions created yet.
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
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadgeClasses[status] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {status}
    </span>
  )
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
