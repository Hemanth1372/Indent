import { Delete, Plus, Settings, User, X } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type RecentUser = {
  login_name: string
  name: string
}

type StoredRecentUser = {
  login_name?: unknown
  name?: unknown
}

const RECENT_USERS_KEY = 'indentmate_recent_users'
const MAX_PIN_LENGTH = 6
const MAX_RECENT_USERS = 5

function normalizeUserId(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeRecentUser(user: StoredRecentUser): RecentUser | null {
  const loginName = normalizeUserId(user.login_name)

  if (!loginName) {
    return null
  }

  return {
    login_name: loginName,
    name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : loginName,
  }
}

function readRecentUsers() {
  const storedUsers = localStorage.getItem(RECENT_USERS_KEY)

  if (!storedUsers) {
    return []
  }

  try {
    const parsedUsers = JSON.parse(storedUsers)
    if (!Array.isArray(parsedUsers)) {
      localStorage.removeItem(RECENT_USERS_KEY)
      return []
    }

    const uniqueUsers = new Map<string, RecentUser>()
    parsedUsers.forEach((user) => {
      const normalizedUser = normalizeRecentUser(user)
      if (normalizedUser && !uniqueUsers.has(normalizedUser.login_name)) {
        uniqueUsers.set(normalizedUser.login_name, normalizedUser)
      }
    })

    const cleanedUsers = Array.from(uniqueUsers.values()).slice(0, MAX_RECENT_USERS)
    if (cleanedUsers.length !== parsedUsers.length) {
      localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(cleanedUsers))
    }

    return cleanedUsers
  } catch {
    localStorage.removeItem(RECENT_USERS_KEY)
    return []
  }
}

export default function Login() {
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [selectedUser, setSelectedUser] = useState<RecentUser | null>(null)
  const [manualUserId, setManualUserId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const uniqueUsers = readRecentUsers()
    setRecentUsers(uniqueUsers)

    if (uniqueUsers.length > 0) {
      setSelectedUser(uniqueUsers[0])
    }
  }, [])

  function handleUserSelect(user: RecentUser) {
    setSelectedUser(user)
    setManualUserId('')
    setPin('')
    setError('')
  }

  function handleUserCardKeyDown(event: KeyboardEvent<HTMLDivElement>, user: RecentUser) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleUserSelect(user)
    }
  }

  function handleDifferentUser() {
    setSelectedUser(null)
    setManualUserId('')
    setPin('')
    setError('')
  }

  function handleRemoveUser(event: React.MouseEvent<HTMLButtonElement>, userIdToRemove: string) {
    event.stopPropagation()

    const normalizedUserId = normalizeUserId(userIdToRemove)
    const updatedUsers = recentUsers.filter(
      (user) => normalizeUserId(user.login_name) !== normalizedUserId,
    )

    setRecentUsers(updatedUsers)
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updatedUsers))

    if (normalizeUserId(selectedUser?.login_name) === normalizedUserId) {
      setSelectedUser(null)
      setPin('')
      setError('')
    }
  }

  function handlePinInput(digit: string) {
    setPin((currentPin) => {
      if (currentPin.length >= MAX_PIN_LENGTH) {
        return currentPin
      }

      return `${currentPin}${digit}`
    })
    setError('')
  }

  function handleBackspace() {
    setPin((currentPin) => currentPin.slice(0, -1))
  }

  async function handleLogin() {
    const activeUserId = selectedUser
      ? normalizeUserId(selectedUser.login_name)
      : normalizeUserId(manualUserId)

    if (!activeUserId) {
      setError('Please select or enter a User ID.')
      return
    }

    if (!pin) {
      setError(`Please enter PIN for ID: ${activeUserId}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await login({ login_name: activeUserId, password: pin })

      if (result.success) {
        const loginName = normalizeUserId(result.user?.login_name ?? activeUserId)
        const loggedInUser = {
          login_name: loginName,
          name: result.user?.name?.trim() || loginName,
        }

        const freshUsers = readRecentUsers()
        const updatedUsers = [
          loggedInUser,
          ...freshUsers.filter((user) => normalizeUserId(user.login_name) !== loginName),
        ].slice(0, MAX_RECENT_USERS)

        localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updatedUsers))
        setRecentUsers(updatedUsers)
        setSelectedUser(loggedInUser)
        setManualUserId('')
        setPin('')
        navigate('/')
      } else {
        setError(`Incorrect PIN for ID: ${activeUserId}`)
        setPin('')
      }
    } catch {
      setError(`Incorrect PIN for ID: ${activeUserId}`)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const showSidebar = recentUsers.length > 0

  return (
    <div className="kiosk-login">
      {showSidebar && (
        <aside className="kiosk-sidebar">
          <h2>Recent Logins</h2>

          <div className="kiosk-recent-list">
            {recentUsers.map((user) => (
              <div
                className={
                  normalizeUserId(selectedUser?.login_name) === user.login_name
                    ? 'kiosk-user-card selected'
                    : 'kiosk-user-card'
                }
                key={user.login_name}
                onClick={() => handleUserSelect(user)}
                onKeyDown={(event) => handleUserCardKeyDown(event, user)}
                role="button"
                tabIndex={0}
              >
                <span className="kiosk-avatar">
                  <User size={22} />
                </span>
                <span className="kiosk-user-copy">
                  <strong>{user.name}</strong>
                  <span>ID: {user.login_name}</span>
                </span>
                <button
                  aria-label={`Remove ${user.login_name}`}
                  className="kiosk-remove"
                  onClick={(event) => handleRemoveUser(event, user.login_name)}
                  title="Remove User"
                  type="button"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button className="kiosk-different-user" onClick={handleDifferentUser} type="button">
            <Plus size={16} />
            Login as different user
          </button>
        </aside>
      )}

      <main className="kiosk-main">
        <header className="kiosk-topbar">
          <div className="kiosk-brand">
            <span className="brand-mark">IM</span>
            <span>IndentMate</span>
          </div>
          <Settings size={24} />
        </header>

        <section className="kiosk-center">
          {selectedUser ? (
            <>
              <div className="kiosk-large-avatar">
                {selectedUser.name.slice(0, 2).toUpperCase()}
              </div>
              <h1>{selectedUser.name}</h1>
              <p>User ID: {selectedUser.login_name}</p>
            </>
          ) : (
            <div className="kiosk-manual">
              <h1>Welcome to IndentMate</h1>
              <input
                autoComplete="username"
                onChange={(event) => {
                  setManualUserId(event.target.value)
                  setError('')
                }}
                placeholder="Enter User ID"
                value={manualUserId}
              />
            </div>
          )}

          <span className="kiosk-pin-label">Enter PIN</span>
          <div className="kiosk-dots" aria-label={`${pin.length} PIN digits entered`}>
            {Array.from({ length: MAX_PIN_LENGTH }, (_, index) => (
              <span className={index < pin.length ? 'filled' : ''} key={index} />
            ))}
          </div>

          {error && <div className="kiosk-error">{error}</div>}

          <div className="kiosk-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button key={digit} onClick={() => handlePinInput(digit)} type="button">
                {digit}
              </button>
            ))}
            <button onClick={handleBackspace} type="button">
              <Delete size={20} />
            </button>
            <button onClick={() => handlePinInput('0')} type="button">
              0
            </button>
            <span />
          </div>

          <button
            className="kiosk-login-button"
            disabled={loading}
            onClick={handleLogin}
            type="button"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </section>
      </main>
    </div>
  )
}
