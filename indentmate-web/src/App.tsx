import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import SuperAdminRoute from './components/SuperAdminRoute'
import { AuthProvider } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import GenericMasterPage from './pages/GenericMasterPage'
import IndentDetail from './pages/IndentDetail'
import IndentList from './pages/IndentList'
import Login from './pages/Login'
import ResponsibilityMaster from './pages/ResponsibilityMaster'

function ProtectedRoute({ children, title = 'Dashboard' }: { children: ReactNode; title?: string }) {
  return (
    <SuperAdminRoute>
      <AdminLayout title={title}>{children}</AdminLayout>
    </SuperAdminRoute>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">This workspace is ready for implementation.</p>
    </div>
  )
}

function MasterPlaceholderPage() {
  const { master } = useParams()
  const title = titleFromSlug(master ?? 'masters')

  return <PlaceholderPage title={title} />
}

function MasterRoute() {
  const { master } = useParams()
  const title = titleFromSlug(master ?? 'Masters')

  return (
    <ProtectedRoute title={title}>
      <MasterPlaceholderPage />
    </ProtectedRoute>
  )
}

function MasterDataRoute() {
  const { masterKey } = useParams()
  const title = titleFromSlug(masterKey ?? 'Master Data')

  return (
    <ProtectedRoute title={title}>
      <GenericMasterPage />
    </ProtectedRoute>
  )
}

function titleFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/responsibility-master"
          element={
            <ProtectedRoute title="Responsibility Master">
              <ResponsibilityMaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/:group/:master"
          element={<MasterRoute />}
        />
        <Route
          path="/master-data/:masterKey"
          element={<MasterDataRoute />}
        />
        <Route
          path="/service-orders"
          element={<Navigate to="/master-data/service-order-master" replace />}
        />
        <Route
          path="/responsibility-master"
          element={
            <Navigate to="/admin/responsibility-master" replace />
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute title="Transactions">
              <PlaceholderPage title="Transactions" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute title="Reports">
              <PlaceholderPage title="Reports" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/indents"
          element={
            <ProtectedRoute title="Indents">
              <IndentList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/indents/:indentId"
          element={
            <ProtectedRoute title="Indent Detail">
              <IndentDetail />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
