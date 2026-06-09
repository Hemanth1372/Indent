import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

type IndentLineItem = {
  id?: string
  line_number: number
  item_code: string
  uom: string
  required_qty: string | number
  issued_qty: string | number
}

type IndentTransaction = {
  id: string
  indent_no: string
  project_code: string
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

export default function Transactions() {
  const [transactions, setTransactions] = useState<IndentTransaction[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchTransactions() {
    setIsLoading(true)

    try {
      const response = await api.get<IndentsResponse>('/api/indents')
      setTransactions(response.data.data)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: 'Approved' | 'Rejected' | 'Issued') {
    const previousTransactions = transactions
    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === id ? { ...transaction, status: newStatus } : transaction,
      ),
    )

    try {
      await api.patch(`/api/indents/${id}/status`, { status: newStatus })
      setErrorMessage('')
    } catch {
      setTransactions(previousTransactions)
      setErrorMessage(`Unable to update status to ${newStatus}.`)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  return (
    <section className="w-full">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Material Ledger</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Transactions</h2>
        </div>
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

      {errorMessage ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3" />
                <th className="px-4 py-3">Indent No</th>
                <th className="px-4 py-3">Project Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    No transactions created yet.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const isExpanded = expandedId === transaction.id

                  return (
                    <FragmentRow
                      isExpanded={isExpanded}
                      key={transaction.id}
                      onStatusChange={handleStatusChange}
                      onToggle={() => setExpandedId(isExpanded ? null : transaction.id)}
                      transaction={transaction}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function FragmentRow({
  isExpanded,
  onStatusChange,
  onToggle,
  transaction,
}: {
  isExpanded: boolean
  onStatusChange: (id: string, newStatus: 'Approved' | 'Rejected' | 'Issued') => void
  onToggle: () => void
  transaction: IndentTransaction
}) {
  return (
    <>
      <tr className="cursor-pointer transition hover:bg-blue-50/60" onClick={onToggle}>
        <td className="px-4 py-3 text-slate-500">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </td>
        <td className="px-4 py-3 font-mono font-bold text-slate-900">{transaction.indent_no}</td>
        <td className="px-4 py-3 font-semibold text-slate-800">{transaction.project_code}</td>
        <td className="px-4 py-3">
          <StatusBadge status={transaction.status} />
        </td>
        <td className="px-4 py-3 text-slate-600">{formatDate(transaction.created_at)}</td>
      </tr>

      {isExpanded ? (
        <tr>
          <td className="bg-slate-50 px-4 py-4" colSpan={5}>
            <div className="rounded-md border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-slate-800">Line Items</p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton label="Approve" onClick={() => onStatusChange(transaction.id, 'Approved')} tone="approve" />
                  <ActionButton label="Reject" onClick={() => onStatusChange(transaction.id, 'Rejected')} tone="reject" />
                  <ActionButton label="Issue" onClick={() => onStatusChange(transaction.id, 'Issued')} tone="issue" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Line</th>
                      <th className="px-4 py-3">Item Code</th>
                      <th className="px-4 py-3">UOM</th>
                      <th className="px-4 py-3">Required Qty</th>
                      <th className="px-4 py-3">Issued Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transaction.items.length === 0 ? (
                      <tr>
                        <td className="px-4 py-5 text-center text-slate-500" colSpan={5}>
                          No line items found.
                        </td>
                      </tr>
                    ) : (
                      transaction.items.map((item) => (
                        <tr key={item.id ?? `${transaction.id}-${item.line_number}`}>
                          <td className="px-4 py-3 font-semibold text-slate-700">{item.line_number}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.item_code}</td>
                          <td className="px-4 py-3 text-slate-700">{item.uom}</td>
                          <td className="px-4 py-3 text-slate-700">{formatQty(item.required_qty)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatQty(item.issued_qty)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadgeClasses[status] ?? 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}>
      {status}
    </span>
  )
}

function ActionButton({
  label,
  onClick,
  tone,
}: {
  label: string
  onClick: () => void
  tone: 'approve' | 'reject' | 'issue'
}) {
  const toneClasses = {
    approve: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    reject: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    issue: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  }

  return (
    <button
      className={`h-9 rounded-md border px-3 text-sm font-bold transition ${toneClasses[tone]}`}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      type="button"
    >
      {label}
    </button>
  )
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
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN') : value
}
