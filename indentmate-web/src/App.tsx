import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import IndentDetail from './pages/IndentDetail'
import IndentList from './pages/IndentList'
import Login from './pages/Login'

function ProtectedRoute({ children, title = 'Dashboard' }: { children: ReactNode; title?: string }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AdminLayout title={title}>{children}</AdminLayout>
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">This workspace is ready for implementation.</p>
    </div>
  )
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
          path="/masters/:group/:master"
          element={
            <ProtectedRoute title="Masters">
              <PlaceholderPage title="Masters" />
            </ProtectedRoute>
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
