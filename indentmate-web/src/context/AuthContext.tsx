import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AuthUser = {
  name: string
  role: string
}

type LoginCredentials = {
  engineerId?: string
  password?: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  user: AuthUser | null
  login: (credentials?: LoginCredentials) => void
  logout: () => void
}

const AUTH_TOKEN_KEY = 'indentmate-auth-token'
const AUTH_USER_KEY = 'indentmate-auth-user'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser() {
  const storedUser = localStorage.getItem(AUTH_USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      token,
      user,
      login: () => {
        const dummyToken = `dummy-token-${Date.now()}`
        const dummyUser = {
          name: 'Administrator',
          role: 'Administrator',
        }

        localStorage.setItem(AUTH_TOKEN_KEY, dummyToken)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(dummyUser))
        setToken(dummyToken)
        setUser(dummyUser)
      },
      logout: () => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        localStorage.removeItem(AUTH_USER_KEY)
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
