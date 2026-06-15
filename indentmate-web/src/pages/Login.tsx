import { KeyRound, Lock, LogIn, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import headerLogo from '../assets/header-logo.png'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
  const redirectTo = typeof location.state === 'object' && location.state && 'from' in location.state
    ? String(location.state.from || '/')
    : '/'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedLoginName = loginName.trim()

    if (!normalizedLoginName || !password) {
      setError('Enter employee ID and password.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const result = await login({
      employee_id: normalizedLoginName,
      password,
    })

    setLoading(false)

    if (result.success) {
      navigate(redirectTo, { replace: true })
      return
    }

    setError(result.message ?? 'Invalid employee ID or password.')
    setPassword('')
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedLoginName = loginName.trim()

    if (!normalizedLoginName || !password || !confirmPassword) {
      setError('Enter employee ID, new password, and confirmation.')
      return
    }

    if (!/^\d{6}$/.test(password)) {
      setError('Password must be exactly 6 digits.')
      return
    }

    if (password !== confirmPassword) {
      setError('Both password fields must match.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/admin-forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: normalizedLoginName,
          password,
          confirm_password: confirmPassword,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message ?? 'Could not update password.')
        return
      }

      setSuccess(data.message ?? 'Password updated successfully. You can login now.')
      setPassword('')
      setConfirmPassword('')
      setResetMode(false)
    } catch (requestError) {
      console.error('Forgot password error:', requestError)
      setError('Could not connect to the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(nextResetMode: boolean) {
    setResetMode(nextResetMode)
    setPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
  }

  return (
    <main className="login-page">
      <section className={`login-panel ${resetMode ? 'login-panel-reset' : ''}`}>
        <div className="login-brand">
          <img alt="NCC Limited" className="ncc-logo" src={headerLogo} />
          <h1>Indent</h1>
          {resetMode && <p>Change admin password</p>}
        </div>

        <form className="login-form" onSubmit={resetMode ? handleForgotPasswordSubmit : handleSubmit}>
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
                  setSuccess('')
                }}
                placeholder="Enter Employee ID"
                value={loginName}
              />
            </div>
          </label>

          <label>
            <span>{resetMode ? 'New Password' : 'Password'}</span>
            <div className="login-input">
              <Lock size={18} />
              <input
                autoComplete={resetMode ? 'new-password' : 'current-password'}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                  setSuccess('')
                }}
                placeholder={resetMode ? 'Enter 6-digit password' : 'Enter password'}
                type="password"
                value={password}
              />
            </div>
          </label>

          {resetMode && (
            <label>
              <span>Confirm Password</span>
              <div className="login-input">
                <Lock size={18} />
                <input
                  autoComplete="new-password"
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setError('')
                    setSuccess('')
                  }}
                  placeholder="Re-enter 6-digit password"
                  type="password"
                  value={confirmPassword}
                />
              </div>
            </label>
          )}

          <p className={`login-message ${error ? 'login-error' : success ? 'login-success' : ''}`} aria-live="polite">
            {error || success || '\u00A0'}
          </p>

          <button className="login-submit" disabled={loading} type="submit">
            {resetMode ? <KeyRound size={18} /> : <LogIn size={18} />}
            {loading ? (resetMode ? 'Updating...' : 'Signing in...') : (resetMode ? 'Update Password' : 'Login')}
          </button>

          <button
            className="login-link"
            disabled={loading}
            onClick={() => switchMode(!resetMode)}
            type="button"
          >
            {resetMode ? 'Back to login' : 'Forgot password?'}
          </button>
        </form>
      </section>
      <footer className="login-footer">v1.0.0 • NCC Team</footer>
    </main>
  )
}
