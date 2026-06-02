import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

const AUTH_TOKEN_KEY = 'ncc_token'
const AUTH_USER_KEY = 'ncc_user'

type StoredUser = {
  role?: string
  primary_role?: string
}

function readStoredUser() {
  const storedUser = localStorage.getItem(AUTH_USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as StoredUser
  } catch {
    return null
  }
}

function isSuperAdmin(user: StoredUser | null) {
  const role = user?.role ?? user?.primary_role
  return String(role ?? '').trim().toUpperCase() === 'SUPER ADMIN'
}

export default function SuperAdminRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const user = readStoredUser()

  if (!token || !isSuperAdmin(user)) {
    localStorage.clear()
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
