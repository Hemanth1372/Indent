import { AlertCircle, ArrowLeft, Building2, CalendarDays, ClipboardList, Factory, MapPin, Paperclip, Printer, Send, X, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import headerLogo from '../assets/header-logo.png'
import { api } from '../services/api'

type IndentLineItem = {
  id?: string
  line_number: number
  item_code: string
  item_name?: string | null
  make?: string | null
  uom?: string | null
  required_qty: string | number
  approved_qty?: string | number | null
  in_process_qty?: string | number | null
  issued_qty: string | number
  on_hand_qty?: string | number | null
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
  approved_by?: string | null
  approved_by_name?: string | null
  approved_at?: string | null
  approver_email?: string | null
  approver_name?: string | null
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

type AttachmentRecord = {
  name: string
  url: string
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

type IndentDetailProps = {
  approvalMode?: boolean
  endpoint?: string
}

export default function IndentDetail({ approvalMode = false, endpoint = '/api/indents' }: IndentDetailProps) {
  const { indentId = '' } = useParams()
  const navigate = useNavigate()
  const [indent, setIndent] = useState<IndentDetailRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<'Approved' | 'Rejected' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [approvedQtyByLine, setApprovedQtyByLine] = useState<Record<string, string>>({})
  const [attachmentDialog, setAttachmentDialog] = useState<{
    lineNumber: number
    material: string
    attachments: AttachmentRecord[]
  } | null>(null)

  async function fetchIndent() {
    if (!indentId) {
      return
    }

    setIsLoading(true)

    try {
      const response = await api.get<IndentDetailResponse>(`${endpoint}/${encodeURIComponent(indentId)}`)
      setIndent(response.data.data)
      setApprovedQtyByLine(buildApprovedQtyState(response.data.data))
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load transaction detail.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStatusChange(newStatus: 'Approved' | 'Rejected') {
    if (!indent) {
      return
    }

    if (approvalMode && newStatus === 'Approved') {
      const invalidLine = indent.items.find((item) => {
        const value = approvedQtyByLine[getLineKey(item)] ?? formatQtyInput(item.approved_qty ?? item.required_qty)
        return !Number.isFinite(Number(value)) || Number(value) < 0
      })

      if (invalidLine) {
        setErrorMessage(`Enter a valid approved quantity for line ${invalidLine.line_number}.`)
        return
      }
    }

    const previousIndent = indent
    setIndent({ ...indent, status: newStatus })
    setUpdatingStatus(newStatus)

    try {
      const payload = newStatus === 'Approved' && approvalMode
        ? {
            status: newStatus,
            items: indent.items.map((item) => ({
              id: item.id,
              line_number: item.line_number,
              approved_qty: Number(approvedQtyByLine[getLineKey(item)] ?? item.approved_qty ?? item.required_qty),
            })),
          }
        : { status: newStatus }
      const response = await api.patch<IndentDetailResponse>(`/api/indents/${indent.id}/status`, payload)
      setIndent(response.data.data)
      setApprovedQtyByLine(buildApprovedQtyState(response.data.data))
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
  const isFinalStatus = isFinalIndentStatus(indent.status)

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-slate-600 transition hover:text-slate-900"
            onClick={() => navigate('/transactions')}
            type="button"
          >
            <ArrowLeft size={14} />
            Back to Transactions
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Transaction Detail</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{indent.app_request_id || indent.indent_no}</h2>
            <StatusBadge status={indent.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => printIndentPdf(indent, approvalMode)}
            type="button"
          >
            <Printer size={15} />
            PDF
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Indent : {indent.indent_no}</p>
          </div>
          {approvalMode ? (
            <div className="flex flex-wrap gap-2">
              <ActionButton disabled={Boolean(updatingStatus) || isFinalStatus} label={updatingStatus === 'Approved' ? 'Approving...' : 'Approve'} onClick={() => handleStatusChange('Approved')} tone="approve" />
              <ActionButton disabled={Boolean(updatingStatus) || isFinalStatus} label={updatingStatus === 'Rejected' ? 'Rejecting...' : 'Reject'} onClick={() => handleStatusChange('Rejected')} tone="reject" />
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          <DetailField icon={<CalendarDays size={15} />} label="Date" value={formatDate(indent.created_at)} />
          <DetailField icon={<Building2 size={15} />} label="Project" value={formatWithParentheses(indent.project_code, indent.project_name)} />
          <DetailField icon={<Factory size={15} />} label="Warehouse" value={formatWithParentheses(indent.source_warehouse, indent.source_warehouse_name)} />
          <DetailField icon={<MapPin size={15} />} label="From" value={indent.source_location || '-'} />
          <DetailField icon={<Zap size={15} />} label="Type" value={indent.indent_type || indent.requirement_type || '-'} />
          <DetailField icon={<Send size={15} />} label="To" value={indent.to_entity_id || indent.to_entity_type || '-'} />
          <DetailField icon={<ClipboardList size={15} />} label="Created By" value={formatPair(indent.created_by, indent.created_by_name)} />
          <DetailField icon={<ClipboardList size={15} />} label="Status By" value={formatPair(indent.approved_by, indent.approved_by_name)} />
          <DetailField icon={<MapPin size={15} />} label="Delivery Location" value={formatPair(indent.delivery_location, indent.delivery_location_name)} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">Item Details</h3>
        </div>

        <div className="overflow-x-auto">
          {indent.items.length === 0 ? (
            <div className="px-4 py-7 text-center text-xs text-slate-500">No item details found.</div>
          ) : (
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Line</th>
                  <th className="px-3 py-2.5">Work Type</th>
                  <th className="px-3 py-2.5">Activity</th>
                  <th className="px-3 py-2.5">Material</th>
                  <th className="px-3 py-2.5">UOM</th>
                  <th className="px-3 py-2.5">Requested Qty</th>
                  {approvalMode ? <th className="px-3 py-2.5">Approved Qty</th> : null}
                  {approvalMode ? <th className="px-3 py-2.5">In Process Qty</th> : null}
                  <th className="px-3 py-2.5">On Hand Qty</th>
                  <th className="px-3 py-2.5">Issued Qty</th>
                  <th className="px-3 py-2.5">Remarks</th>
                  <th className="px-3 py-2.5">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indent.items.map((item) => {
                  const lineKey = getLineKey(item)
                  return (
                  <tr className="align-top" key={item.id ?? `${indent.id}-${item.line_number}`}>
                    <td className="px-3 py-3 font-semibold text-slate-700">{item.line_number}</td>
                    <td className="px-3 py-3 text-slate-700">{item.work_type || indent.indent_type || '-'}</td>
                    <td className="px-3 py-3 text-slate-700">{item.activity_code || '-'}</td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-900">{formatWithDash(item.item_code, item.item_name)}</td>
                    <td className="px-3 py-3 text-slate-700">{item.uom || '-'}</td>
                    <td className="px-3 py-3 text-slate-700">{formatQty(item.required_qty)}</td>
                    {approvalMode ? (
                      <td className="px-3 py-3">
                        <input
                          className="h-8 w-24 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                          disabled={isFinalStatus || Boolean(updatingStatus)}
                          min="0"
                          onChange={(event) => setApprovedQtyByLine((current) => ({ ...current, [lineKey]: event.target.value }))}
                          step="0.001"
                          type="number"
                          value={approvedQtyByLine[lineKey] ?? formatQtyInput(item.approved_qty ?? item.required_qty)}
                        />
                      </td>
                    ) : null}
                    {approvalMode ? <td className="px-3 py-3 text-slate-700">{formatQty(item.in_process_qty ?? 0)}</td> : null}
                    <td className="px-3 py-3 text-slate-700">{formatQty(item.on_hand_qty ?? '-')}</td>
                    <td className="px-3 py-3 text-slate-700">{formatQty(item.issued_qty)}</td>
                    <td className="max-w-[220px] px-3 py-3 text-slate-700">{item.remarks || '-'}</td>
                    <td className="px-3 py-3">
                      <AttachmentButton
                        onOpen={(attachments) => setAttachmentDialog({
                          lineNumber: item.line_number,
                          material: formatWithDash(item.item_code, item.item_name),
                          attachments,
                        })}
                        value={item.attachment_url}
                      />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {attachmentDialog ? (
        <AttachmentDialog
          attachments={attachmentDialog.attachments}
          lineNumber={attachmentDialog.lineNumber}
          material={attachmentDialog.material}
          onClose={() => setAttachmentDialog(null)}
        />
      ) : null}
    </section>
  )
}

function DetailField({ className = '', icon, label, value }: { className?: string; icon?: ReactNode; label: string; value: string }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 ${className}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {label}
      </p>
      <p className="mt-1 break-words text-[11px] font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const displayStatus = displayIndentStatus(status)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${statusBadgeClasses[displayStatus] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {displayStatus}
    </span>
  )
}

function ActionButton({ disabled = false, label, onClick, tone }: { disabled?: boolean; label: string; onClick: () => void; tone: 'approve' | 'reject' }) {
  const toneClasses = {
    approve: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    reject: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  }

  return (
    <button className={`h-8 rounded-md border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone]}`} disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  )
}

function AttachmentButton({ onOpen, value }: { onOpen: (attachments: AttachmentRecord[]) => void; value?: string | null }) {
  const attachments = parseAttachmentValue(value)

  if (attachments.length === 0) {
    return <>-</>
  }

  return (
    <button
      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
      onClick={() => onOpen(attachments)}
      type="button"
    >
      <Paperclip size={15} />
      Open
    </button>
  )
}

function AttachmentDialog({ attachments, lineNumber, material, onClose }: { attachments: AttachmentRecord[]; lineNumber: number; material: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">Attachments</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">Line {lineNumber} - {material}</p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            type="button"
            title="Close attachments"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="grid gap-2">
            {attachments.map((attachment, index) => (
              <a
                className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-950"
                href={resolveAttachmentHref(attachment.url)}
                key={`${attachment.url}-${index}`}
                rel="noreferrer"
                target="_blank"
              >
                <Paperclip className="shrink-0 text-slate-500" size={16} />
                <span className="min-w-0 break-all">{attachment.name || `Attachment ${index + 1}`}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function parseAttachmentValue(value?: string | null): AttachmentRecord[] {
  const cleanValue = String(value ?? '').trim()

  if (!cleanValue) {
    return []
  }

  try {
    const parsed = JSON.parse(cleanValue) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') {
            return { name: attachmentNameFromUrl(item), url: item }
          }
          if (item && typeof item === 'object' && 'url' in item) {
            const attachment = item as { name?: unknown; url?: unknown }
            const url = String(attachment.url ?? '').trim()
            return url ? { name: String(attachment.name ?? attachmentNameFromUrl(url)), url } : null
          }
          return null
        })
        .filter((item): item is { name: string; url: string } => Boolean(item))
    }
  } catch {
    // Fall through for older rows that stored a plain URL.
  }

  return [{ name: attachmentNameFromUrl(cleanValue), url: cleanValue }]
}

function resolveAttachmentHref(url: string) {
  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url
  }

  const baseUrl = api.defaults.baseURL ?? window.location.origin
  return new URL(url, baseUrl).toString()
}

function attachmentNameFromUrl(url: string) {
  const cleanUrl = url.split('?')[0].split('#')[0]
  return decodeURIComponent(cleanUrl.split('/').pop() || 'Open')
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

function formatCodeAndDescription(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()

  if (cleanCode && cleanDescription) {
    return `${cleanCode} - ${cleanDescription}`
  }

  if (cleanCode) {
    return `${cleanCode} - Description not available`
  }

  return cleanDescription || '-'
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

function formatQtyInput(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? String(parsed) : ''
}

function getLineKey(item: IndentLineItem) {
  return item.id ?? String(item.line_number)
}

function buildApprovedQtyState(indent: IndentDetailRecord) {
  return Object.fromEntries(indent.items.map((item) => [
    getLineKey(item),
    formatQtyInput(item.approved_qty ?? item.required_qty),
  ]))
}

function isFinalIndentStatus(status: string) {
  return ['APPROVED', 'REJECTED'].includes(String(status ?? '').trim().toUpperCase())
}

function displayIndentStatus(status: string) {
  const normalized = String(status ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (normalized === 'PENDINGSYNC') return 'Pending Sync'
  if (normalized === 'APPROVED') return 'Approved'
  if (normalized === 'REJECTED') return 'Rejected'
  return 'Pending'
}

function printIndentPdf(indent: IndentDetailRecord, includeApprovalFields = false) {
  const printWindow = window.open('about:blank', '_blank', 'width=1100,height=800')

  if (!printWindow) {
    return
  }

  const leftDetailRows = [
    ['Project', formatCodeAndDescription(indent.project_code, indent.project_name)],
    ['Warehouse', formatCodeAndDescription(indent.source_warehouse, indent.source_warehouse_name)],
    ['Indent No', indent.indent_no],
    ['Date', formatDate(indent.created_at)],
    ['Type', indent.indent_type || indent.requirement_type || '-'],
    ['Status', displayIndentStatus(indent.status)],
  ]
  const rightDetailRows = [
    ['From', indent.source_location || '-'],
    ['To', indent.to_entity_id || indent.to_entity_type || '-'],
    ['Created By', formatPair(indent.created_by, indent.created_by_name)],
    ['Status By', formatPair(indent.approved_by, indent.approved_by_name)],
    ['Status At', indent.approved_at ? formatDate(indent.approved_at) : '-'],
    ['Approver', formatPair(indent.approver_email, indent.approver_name)],
    ['Delivery', formatPair(indent.delivery_location, indent.delivery_location_name)],
  ]

  const itemRows = indent.items.map((item) => `
    <tr>
      <td>${escapeHtml(String(item.line_number ?? '-'))}</td>
      <td>${escapeHtml(item.work_type || indent.indent_type || '-')}</td>
      <td>${escapeHtml(item.activity_code || '-')}</td>
      <td>${escapeHtml(formatWithDash(item.item_code, item.item_name))}</td>
      <td>${escapeHtml(item.uom || '-')}</td>
      <td>${escapeHtml(formatQty(item.required_qty))}</td>
      ${includeApprovalFields ? `<td>${escapeHtml(formatQty(item.approved_qty ?? item.required_qty))}</td>` : ''}
      ${includeApprovalFields ? `<td>${escapeHtml(formatQty(item.in_process_qty ?? 0))}</td>` : ''}
      <td>${escapeHtml(formatQty(item.on_hand_qty ?? '-'))}</td>
      <td>${escapeHtml(formatQty(item.issued_qty))}</td>
      <td>${escapeHtml(item.remarks || '-')}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(indent.app_request_id || indent.indent_no)} - Indent Request</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 18px 22px; }
          .header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
          .logo-block { justify-self: start; }
          .logo { display: block; width: 74px; height: auto; }
          .document-title { margin: 0; text-align: center; color: #0f172a; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; }
          .request-no { grid-column: 3; justify-self: end; text-align: right; font-size: 12px; font-weight: 700; }
          .details-title { display: none; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; margin-bottom: 12px; border-bottom: 1px solid #dbe3ef; padding-bottom: 9px; }
          .detail-row { display: grid; grid-template-columns: 92px 8px 1fr; gap: 4px; margin-bottom: 3px; font-size: 10.5px; line-height: 1.25; }
          .label { color: #334155; font-weight: 800; }
          .colon { color: #334155; font-weight: 800; }
          .value { color: #0f172a; font-weight: 600; overflow-wrap: anywhere; }
          .remarks { margin-top: 7px; font-size: 10.5px; line-height: 1.3; }
          h2 { margin: 9px 0 7px; font-size: 14px; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; }
          th { background: #f1f5f9; color: #475569; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; }
          th, td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; word-break: break-word; }
          th:nth-child(1), td:nth-child(1) { width: 6%; }
          th:nth-child(2), td:nth-child(2) { width: 10%; }
          th:nth-child(3), td:nth-child(3) { width: 10%; }
          th:nth-child(4), td:nth-child(4) { width: 31%; }
          th:nth-child(5), td:nth-child(5) { width: 7%; }
          th:nth-child(6), td:nth-child(6) { width: 11%; }
          th:nth-child(7), td:nth-child(7) { width: 9%; }
          th:nth-child(8), td:nth-child(8) { width: 8%; }
          th:nth-child(9), td:nth-child(9) { width: 8%; }
          th:nth-child(10), td:nth-child(10) { width: 8%; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <header class="header">
          <div class="logo-block">
            <img class="logo" src="${headerLogo}" alt="NCC" />
          </div>
          <h1 class="document-title">Indent Request Details</h1>
          <div class="request-no">
            <div>${escapeHtml(indent.app_request_id || '-')}</div>
            <div>${escapeHtml(indent.indent_no || '-')}</div>
          </div>
        </header>
        <section class="details">
          <div>
            ${leftDetailRows.map(([label, value]) => `
              <div class="detail-row">
                <div class="label">${escapeHtml(label)}</div>
                <div class="colon">:</div>
                <div class="value">${escapeHtml(value)}</div>
              </div>
            `).join('')}
          </div>
          <div>
            ${rightDetailRows.map(([label, value]) => `
              <div class="detail-row">
                <div class="label">${escapeHtml(label)}</div>
                <div class="colon">:</div>
                <div class="value">${escapeHtml(value)}</div>
              </div>
            `).join('')}
          </div>
          ${indent.remarks ? `
            <div class="remarks" style="grid-column: 1 / -1;">
              <span class="label">Remarks :</span>
              <span class="value">${escapeHtml(indent.remarks)}</span>
            </div>
          ` : ''}
        </section>
        <h2>Item Details</h2>
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Work Type</th>
              <th>Activity</th>
              <th>Material</th>
              <th>UOM</th>
              <th>Requested Qty</th>
              ${includeApprovalFields ? '<th>Approved Qty</th><th>In Process Qty</th>' : ''}
              <th>On Hand Qty</th>
              <th>Issued Qty</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>${itemRows || `<tr><td colspan="${includeApprovalFields ? 11 : 9}">No item details found.</td></tr>`}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.setTimeout(() => printWindow.print(), 250)
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
