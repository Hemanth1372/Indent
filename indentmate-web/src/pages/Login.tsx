import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'

type LoginFormValues = {
  engineerId: string
  password: string
}

type LoginResponse = {
  token: string
  engineer?: {
    engineerId: string
    name?: string
    role?: string
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  async function handleSubmit(values: LoginFormValues) {
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/api/auth/login', values)
      login(data.token, {
        engineerId: data.engineer?.engineerId ?? values.engineerId,
        name: data.engineer?.name,
        role: data.engineer?.role,
      })
      navigate('/dashboard')
    } catch {
      message.error('Login failed. Check your Engineer ID and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">IM</span>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              IndentMate Admin
            </Typography.Title>
            <Typography.Text type="secondary">Engineer portal</Typography.Text>
          </div>
        </div>

        <Card>
          <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              label="Engineer ID"
              name="engineerId"
              rules={[{ required: true, message: 'Engineer ID is required' }]}
            >
              <Input placeholder="Enter Engineer ID" size="large" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password
                placeholder="Enter password"
                size="large"
              />
            </Form.Item>

            <Button block htmlType="submit" loading={loading} size="large" type="primary">
              Login
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  )
}
