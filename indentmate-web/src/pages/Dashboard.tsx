import { ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'Admin'

  return (
    <section className="w-full">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Admin Control</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Welcome, {displayName}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Use the sidebar to manage masters, users, reports, and transactions.
        </p>
        <button
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => navigate('/transactions')}
          type="button"
        >
          Open Transactions
          <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  )
}
