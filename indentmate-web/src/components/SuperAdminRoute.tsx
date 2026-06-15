import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const AUTH_TOKEN_KEY = 'ncc_token'
const AUTH_USER_KEY = 'ncc_user'

type StoredUser = {
  role?: string
  primary_role?: string
  responsibility?: string
  access_scope?: string
  assigned_projects?: Array<{ role_name?: string }>
  assignedProjects?: Array<{ role_name?: string }>
}

function readStoredUser() {
  const storedUser = sessionStorage.getItem(AUTH_USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as StoredUser
  } catch {
    return null
  }
}

export function isAdminUser(user: StoredUser | null) {
  const accessScope = String(user?.access_scope ?? '').trim().toLowerCase()

  if (accessScope === 'field') {
    return false
  }

  if (accessScope === 'admin') {
    return true
  }

  const responsibility = String(user?.responsibility ?? '').trim().toUpperCase()
  const assignedProjects = user?.assigned_projects ?? user?.assignedProjects ?? []

  if (isFieldRole(responsibility) || assignedProjects.some((project) => isFieldRole(project.role_name))) {
    return false
  }

  const role = user?.role ?? user?.primary_role
  return ['SUPER ADMIN', 'ADMINISTRATOR', 'ADMIN'].includes(String(role ?? '').trim().toUpperCase())
}

function isFieldRole(role: unknown) {
  const responsibility = String(role ?? '').trim().toUpperCase()

  return (
    responsibility === 'SIE' ||
    responsibility === 'STE' ||
    responsibility === 'SER' ||
    responsibility === 'SRE' ||
    responsibility.includes('(SIE)') ||
    responsibility.includes('(STE)') ||
    responsibility.includes('(SER)') ||
    responsibility.includes('(SRE)') ||
    responsibility.includes('SITE ENGINEER') ||
    responsibility.includes('STE ENGINEER') ||
    responsibility.includes('SITE INCHARGE ENGINEER') ||
    responsibility.includes('SITE IN-CHARGE ENGINEER') ||
    responsibility.includes('SITE IN CHARGE ENGINEER') ||
    responsibility.includes('SITE RECEIVING')
  )
}

export default function SuperAdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
  const user = readStoredUser()

  if (!token) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    sessionStorage.removeItem(AUTH_USER_KEY)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
