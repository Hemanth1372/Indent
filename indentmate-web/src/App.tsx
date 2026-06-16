import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import SuperAdminRoute, { isAdminUser } from './components/SuperAdminRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import {
  FieldIndentAddItem,
  FieldIndentDraftDetails,
  FieldIndentHeader,
  FieldIndentHome,
  FieldIndentSubmittedDetails,
} from './pages/FieldIndentWorkspace'
import GenericMasterPage from './pages/GenericMasterPage'
import IndentDetail from './pages/IndentDetail'
import IndentList from './pages/IndentList'
import Login from './pages/Login'
import Transactions from './pages/Transactions'

function ProtectedRoute({ children, title = 'Dashboard' }: { children: ReactNode; title?: string }) {
  return (
    <SuperAdminRoute>
      <AdminLayout title={title}>{children}</AdminLayout>
    </SuperAdminRoute>
  )
}

function AuthenticatedRoute({ children, title = 'Dashboard' }: { children: ReactNode; title?: string }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AdminLayout title={title}>{children}</AdminLayout>
}

function FieldRoute({ children, title = 'Indent Home' }: { children: ReactNode; title?: string }) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isAdminUser(user)) {
    return <Navigate to="/" replace />
  }

  return <AdminLayout title={title}>{children}</AdminLayout>
}

function RoleHome() {
  const { user } = useAuth()

  return isAdminUser(user) ? <Dashboard /> : <FieldIndentHome />
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
  if (value === 'warehouse-bin-master') {
    return 'Warehouse Location Master'
  }

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
            <AuthenticatedRoute>
              <RoleHome />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/admin/user-master"
          element={
            <Navigate to="/master-data/responsibility-master" replace />
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
            <Navigate to="/master-data/responsibility-master" replace />
          }
        />
        <Route
          path="/admin/responsibility-master"
          element={
            <Navigate to="/master-data/responsibility-master" replace />
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute title="Transactions">
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/indent-workspace"
          element={
            <FieldRoute title="Indent Home">
              <FieldIndentHome />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-transactions"
          element={
            <FieldRoute title="Transactions">
              <Transactions
                detailPath={(id) => `/indent-workspace/indents/${id}`}
                endpoint="/api/indents/mine"
                eyebrow="My Material Ledger"
                title="My Transactions"
              />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-create"
          element={
            <FieldRoute title="Indent Creation">
              <FieldIndentHeader />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-drafts/:draftId"
          element={
            <FieldRoute title="Indent Details">
              <FieldIndentDraftDetails />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-drafts/:draftId/items/new"
          element={
            <FieldRoute title="Add New Item">
              <FieldIndentAddItem />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-drafts/:draftId/items/:itemId/edit"
          element={
            <FieldRoute title="Edit Item">
              <FieldIndentAddItem />
            </FieldRoute>
          }
        />
        <Route
          path="/indent-workspace/indents/:indentId"
          element={
            <FieldRoute title="Indent Details">
              <FieldIndentSubmittedDetails />
            </FieldRoute>
          }
        />
        <Route
          path="/transactions/:indentId"
          element={
            <ProtectedRoute title="Transaction Detail">
              <IndentDetail />
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
