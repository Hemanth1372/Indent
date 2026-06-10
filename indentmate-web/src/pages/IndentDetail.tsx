import { AlertCircle, ArrowLeft, Building2, CalendarDays, ClipboardList, Factory, FileText, MapPin, Paperclip, RefreshCw, Send, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'

type IndentLineItem = {
  id?: string
  line_number: number
  item_code: string
  item_name?: string | null
  make?: string | null
  uom?: string | null
  required_qty: string | number
  issued_qty: string | number
  work_type?: string | null
  activity_code?: string | null
  location_code?: string | null
  remarks?: string | null
  attachment_url?: string | null
}

type IndentDetailRecord = {
  id: string
  app_request_id?: string | null
  indent_no: string
  created_by?: string | null
  created_by_name?: string | null
  project_code: string
  project_name?: string | null
  source_warehouse?: string | null
  source_warehouse_name?: string | null
  source_location?: string | null
  delivery_location?: string | null
  delivery_location_name?: string | null
  requirement_type?: string | null
  indent_type?: string | null
  to_entity_type?: string | null
  to_entity_id?: string | null
  status: string
  remarks?: string | null
  attachments?: unknown
  created_at: string
  updated_at: string
  items: IndentLineItem[]
}

type IndentDetailResponse = {
  data: IndentDetailRecord
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

export default function IndentDetail() {
  const { indentId = '' } = useParams()
  const navigate = useNavigate()
  const [indent, setIndent] = useState<IndentDetailRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<'Approved' | 'Rejected' | 'Issue' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchIndent() {
    if (!indentId) {
      return
    }

    setIsLoading(true)

    try {
      const response = await api.get<IndentDetailResponse>(`/api/indents/${encodeURIComponent(indentId)}`)
      setIndent(response.data.data)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load transaction detail.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStatusChange(newStatus: 'Approved' | 'Rejected' | 'Issue') {
    if (!indent) {
      return
    }

    const previousIndent = indent
    setIndent({ ...indent, status: newStatus })
    setUpdatingStatus(newStatus)

    try {
      const response = await api.patch<IndentDetailResponse>(`/api/indents/${indent.id}/status`, { status: newStatus })
      setIndent(response.data.data)
      setErrorMessage('')
      window.dispatchEvent(new CustomEvent('indent-status-updated', {
        detail: {
          id: indent.id,
          indent_no: indent.indent_no,
          status: newStatus,
        },
      }))
    } catch {
      setIndent(previousIndent)
      setErrorMessage(`Unable to update status to ${newStatus}.`)
    } finally {
      setUpdatingStatus(null)
    }
  }

  useEffect(() => {
    fetchIndent()
  }, [indentId])

  if (isLoading) {
    return (
      <section className="grid min-h-[320px] place-items-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500">
        Loading transaction detail...
      </section>
    )
  }

  if (!indent) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {errorMessage || 'Transaction not found.'}
      </section>
    )
  }

  return (
    <section className="w-full space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-900"
            onClick={() => navigate('/transactions')}
            type="button"
          >
            <ArrowLeft size={16} />
            Back to Transactions
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Transaction Detail</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{indent.app_request_id || indent.indent_no}</h2>
            <StatusBadge status={indent.status} />
          </div>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={fetchIndent}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Request ID</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900">{indent.app_request_id || '-'}</p>
            <p className="mt-3 text-sm font-bold text-slate-900">Indent : {indent.indent_no}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={Boolean(updatingStatus)} label={updatingStatus === 'Approved' ? 'Approving...' : 'Approve'} onClick={() => handleStatusChange('Approved')} tone="approve" />
            <ActionButton disabled={Boolean(updatingStatus)} label={updatingStatus === 'Rejected' ? 'Rejecting...' : 'Reject'} onClick={() => handleStatusChange('Rejected')} tone="reject" />
            <ActionButton disabled={Boolean(updatingStatus)} label={updatingStatus === 'Issue' ? 'Issuing...' : 'Issue'} onClick={() => handleStatusChange('Issue')} tone="issue" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailField icon={<CalendarDays size={15} />} label="Date" value={formatDate(indent.created_at)} />
          <DetailField icon={<Building2 size={15} />} label="Project" value={formatWithParentheses(indent.project_code, indent.project_name)} />
          <DetailField icon={<Factory size={15} />} label="Warehouse" value={formatWithParentheses(indent.source_warehouse, indent.source_warehouse_name)} />
          <DetailField icon={<MapPin size={15} />} label="From" value={indent.source_location || '-'} />
          <DetailField icon={<Zap size={15} />} label="Type" value={indent.indent_type || indent.requirement_type || '-'} />
          <DetailField icon={<Send size={15} />} label="To" value={indent.to_entity_id || indent.to_entity_type || '-'} />
          <DetailField icon={<ClipboardList size={15} />} label="Created By" value={formatPair(indent.created_by, indent.created_by_name)} />
          <DetailField icon={<MapPin size={15} />} label="Delivery Location" value={formatPair(indent.delivery_location, indent.delivery_location_name)} />
          <DetailField icon={<FileText size={15} />} label="Remarks" value={indent.remarks || '-'} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Item Details</h3>
        </div>

        <div className="overflow-x-auto">
          {indent.items.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No item details found.</div>
          ) : (
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Line</th>
                  <th className="px-4 py-3">Work Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3">Requested Qty</th>
                  <th className="px-4 py-3">Issued Qty</th>
                  <th className="px-4 py-3">To (Business Partner)</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indent.items.map((item) => (
                  <tr className="align-top" key={item.id ?? `${indent.id}-${item.line_number}`}>
                    <td className="px-4 py-4 font-semibold text-slate-700">{item.line_number}</td>
                    <td className="px-4 py-4 text-slate-700">{item.work_type || indent.indent_type || '-'}</td>
                    <td className="px-4 py-4 text-slate-700">{item.location_code || '-'}</td>
                    <td className="px-4 py-4 text-slate-700">{item.activity_code || '-'}</td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-900">{formatWithDash(item.item_code, item.item_name)}</td>
                    <td className="px-4 py-4 text-slate-700">{item.uom || '-'}</td>
                    <td className="px-4 py-4 text-slate-700">{formatQty(item.required_qty)}</td>
                    <td className="px-4 py-4 text-slate-700">{formatQty(item.issued_qty)}</td>
                    <td className="px-4 py-4 text-slate-700">{indent.to_entity_id || '-'}</td>
                    <td className="max-w-[240px] px-4 py-4 text-slate-700">{item.remarks || '-'}</td>
                    <td className="px-4 py-4">
                      {item.attachment_url ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          href={item.attachment_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Paperclip size={15} />
                          Open
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}

function DetailField({ className = '', icon, label, value }: { className?: string; icon?: ReactNode; label: string; value: string }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadgeClasses[status] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {status}
    </span>
  )
}

function ActionButton({ disabled = false, label, onClick, tone }: { disabled?: boolean; label: string; onClick: () => void; tone: 'approve' | 'reject' | 'issue' }) {
  const toneClasses = {
    approve: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    reject: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    issue: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  }

  return (
    <button className={`h-10 rounded-md border px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone]}`} disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function formatPair(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} - ${cleanDescription}`
  }

  return cleanCode || cleanDescription || '-'
}

function formatWithParentheses(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} (${cleanDescription})`
  }

  return cleanCode || cleanDescription || '-'
}

function formatWithDash(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} - ${cleanDescription}`
  }

  return cleanCode || cleanDescription || '-'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatQty(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN') : String(value ?? '-')
}
