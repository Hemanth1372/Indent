import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AuthUser = {
  user_id?: string
  userId?: string
  employee_id?: string
  employeeId?: string
  login_name?: string
  name: string
  role?: string
  primary_role?: string
  responsibility?: string
  access_scope?: string
  isActive?: boolean
  assigned_projects?: Array<{
    project_id: string
    project_name: string
    location?: string
    status?: string
    role_name: string
  }>
  assignedProjects?: Array<{
    project_id: string
    project_name: string
    location?: string
    status?: string
    role_name: string
  }>
}

type LoginCredentials = {
  employee_id: string
  password: string
}

type LoginResult = {
  success: boolean
  errorCode?: string
  message?: string
  token?: string
  user?: AuthUser
}

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  user: AuthUser | null
  login: (credentials: LoginCredentials) => Promise<LoginResult>
  logout: () => void
}

const AUTH_TOKEN_KEY = 'ncc_token'
const AUTH_USER_KEY = 'ncc_user'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser() {
  const storedUser = sessionStorage.getItem(AUTH_USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    sessionStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      token,
      user,
      login: async (credentials) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/web-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          })
          const data = await response.json()

          if (!response.ok) {
            return {
              success: false,
              errorCode: data.errorCode,
              message: data.message ?? 'Login failed',
            }
          }

          sessionStorage.setItem(AUTH_TOKEN_KEY, data.token)
          sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
          setToken(data.token)
          setUser(data.user)

          return { success: true, token: data.token, user: data.user }
        } catch (error) {
          console.error('Login error:', error)
          return {
            success: false,
            message: 'Could not connect to the server. Is the backend running?',
          }
        }
      },
      logout: () => {
        sessionStorage.removeItem(AUTH_TOKEN_KEY)
        sessionStorage.removeItem(AUTH_USER_KEY)
        setToken(null)
        setUser(null)
      },
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
