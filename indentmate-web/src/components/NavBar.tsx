import { Button, Menu } from 'antd'
import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith('/indents')) {
      return ['indents']
    }

    return ['dashboard']
  }, [location.pathname])

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 24px',
        borderBottom: '1px solid #e5eaf2',
        background: '#fff',
      }}
    >
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="brand-mark">IM</span>
        <strong>IndentMate</strong>
      </Link>
      <Menu
        mode="horizontal"
        selectedKeys={selectedKeys}
        style={{ flex: 1, minWidth: 0 }}
        items={[
          { key: 'dashboard', label: <Link to="/dashboard">Dashboard</Link> },
          { key: 'indents', label: <Link to="/indents">Indents</Link> },
        ]}
      />
      <Button
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        Logout
      </Button>
    </header>
  )
}
