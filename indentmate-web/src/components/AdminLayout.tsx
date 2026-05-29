import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

type AdminLayoutProps = {
  children: ReactNode
  title?: string
}

export default function AdminLayout({ children, title = 'Dashboard' }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-appbg text-slate-900">
      <Sidebar open={sidebarOpen} />
      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarOpen ? 'lg:pl-[325px]' : 'lg:pl-0'
        }`}
      >
        <TopNav onMenuClick={() => setSidebarOpen((value) => !value)} title={title} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
