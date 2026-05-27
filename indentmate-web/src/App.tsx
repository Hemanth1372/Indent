import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import IndentDetail from './pages/IndentDetail'
import IndentList from './pages/IndentList'
import Login from './pages/Login'
import { useAuthStore } from './store/useAuthStore'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="app-shell">
      <NavBar />
      <main>{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/indents"
        element={
          <ProtectedRoute>
            <IndentList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/indents/:indentId"
        element={
          <ProtectedRoute>
            <IndentDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
