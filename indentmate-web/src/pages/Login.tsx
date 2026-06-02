import { Lock, LogIn, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedLoginName = loginName.trim()

    if (!normalizedLoginName || !password) {
      setError('Enter employee ID and password.')
      return
    }

    setLoading(true)
    setError('')

    const result = await login({
      employee_id: normalizedLoginName,
      password,
    })

    setLoading(false)

    if (result.success) {
      navigate('/')
      return
    }

    setError(result.message ?? 'Invalid employee ID or password.')
    setPassword('')
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">IM</span>
          <div>
            <h1>IndentMate Admin</h1>
            <p>Sign in to continue</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Employee ID</span>
            <div className="login-input">
              <User size={18} />
              <input
                autoComplete="username"
                autoFocus
                onChange={(event) => {
                  setLoginName(event.target.value)
                  setError('')
                }}
                placeholder="Enter Employee ID"
                value={loginName}
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="login-input">
              <Lock size={18} />
              <input
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                placeholder="Enter password"
                type="password"
                value={password}
              />
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-submit" disabled={loading} type="submit">
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  )
}
