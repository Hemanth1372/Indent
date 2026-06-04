import { useEffect, useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

type AdminLayoutProps = {
  children: ReactNode
  title?: string
}

export default function AdminLayout({ children, title = 'Dashboard' }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  ))

  useEffect(() => {
    function handleViewportResize() {
      setSidebarOpen(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleViewportResize)
    return () => window.removeEventListener('resize', handleViewportResize)
  }, [])

  return (
    <div className="min-h-screen bg-appbg text-slate-900">
      <Sidebar open={sidebarOpen} />
      {sidebarOpen && (
        <button
          aria-label="Close navigation side menu"
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}
      <div
        className={`min-h-screen w-full transition-all duration-300 ${
          sidebarOpen ? 'lg:pl-[325px]' : 'lg:pl-0'
        }`}
      >
        <TopNav onMenuClick={() => setSidebarOpen((value) => !value)} title={title} />
        <main className="w-full min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
