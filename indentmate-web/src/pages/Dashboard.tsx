export default function Dashboard() {
  const stats = [
    { value: '0', label: 'Survey Allocated', color: 'text-blue-600' },
    { value: '0', label: 'Completed', color: 'text-green-600' },
    { value: '0', label: 'In Progress', color: 'text-amber-600' },
    { value: '0', label: 'Yet to Start', color: 'text-red-500' },
  ]

  return (
    <section>
      <div className="flex flex-col gap-5 rounded-xl bg-gradient-to-r from-blue-900 to-blue-500 px-8 py-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold">Administrator</h3>
          <p className="mt-1 text-sm text-blue-100">All Projects • All employees</p>
        </div>
        <select
          className="h-12 w-full rounded-xl border border-white/20 bg-white px-5 text-sm text-slate-500 shadow-sm outline-none sm:w-64"
          defaultValue="all"
        >
          <option value="all">All Projects</option>
          <option value="alpha">Project Alpha - Hyd</option>
          <option value="beta">Project Beta - Blr</option>
          <option value="gamma">Project Gamma - Che</option>
        </select>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm"
            key={stat.label}
          >
            <div className={`text-4xl font-extrabold tracking-wider ${stat.color}`}>{stat.value}</div>
            <p className="mt-1 text-sm font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

    </section>
  )
}
