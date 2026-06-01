import { Alert, Button, Form, Input, Modal, Select, Spin, Switch, message } from 'antd'
import {
  Eye,
  EyeOff,
  Lock,
  MoreVertical,
  Plus,
  Trash2,
  ToggleLeft,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

type UserRow = {
  user_id: string
  login_name: string
  employee_name: string
  employee_id_str: string | null
  primary_role: string | null
  is_active: boolean
  current_pin: string | null
  created_at: string
}

type CreateUserValues = {
  login_name: string
  employee_name: string
  employee_id_str?: string
  primary_role?: string
  is_active?: boolean
}

type PasswordFormValues = {
  newPassword: string
  confirmPassword: string
}

export default function UserMaster() {
  const [form] = Form.useForm<CreateUserValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [visiblePins, setVisiblePins] = useState<Set<string>>(() => new Set())
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const currentUserRoles = [
    currentUser?.primary_role,
    ...(currentUser?.assigned_projects?.map((project) => project.role_name) ?? []),
    ...(currentUser?.assignedProjects?.map((project) => project.role_name) ?? []),
  ].map((role) => String(role ?? '').toLowerCase())
  const canChangePassword = currentUserRoles.some((role) =>
    ['super admin', 'administrator'].includes(role),
  )

  function isProtectedAdminRole(role: string | null) {
    return ['super admin', 'administrator'].includes(String(role ?? '').toLowerCase())
  }

  function handleTogglePin(userId: string) {
    setVisiblePins((currentVisiblePins) => {
      const nextVisiblePins = new Set(currentVisiblePins)

      if (nextVisiblePins.has(userId)) {
        nextVisiblePins.delete(userId)
      } else {
        nextVisiblePins.add(userId)
      }

      return nextVisiblePins
    })
  }

  async function loadUsers() {
    setLoading(true)
    setError(null)

    try {
      const { data } = await api.get<{ data: UserRow[] }>('/api/users')
      setUsers(data.data)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load User Master data. Check that the backend is running and you are logged in.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
        setMenuPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleCreate(values: CreateUserValues) {
    setCreating(true)

    try {
      const payload = {
        ...values,
        is_active: values.is_active ?? true,
      }

      await api.post('/api/users', payload)
      message.success('User created. Default password is ncc1234.')
      form.resetFields()
      setModalOpen(false)
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  function openCreateModal() {
    form.setFieldsValue({ is_active: true })
    setModalOpen(true)
  }

  function openPasswordModal(user: UserRow) {
    setSelectedUser(user)
    passwordForm.resetFields()
    setOpenDropdownId(null)
    setMenuPosition(null)
    setPasswordModalOpen(true)
  }

  function toggleActionMenu(userId: string, button: HTMLButtonElement) {
    if (openDropdownId === userId) {
      setOpenDropdownId(null)
      setMenuPosition(null)
      return
    }

    const rect = button.getBoundingClientRect()
    const menuWidth = 256
    const viewportPadding = 12
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - menuWidth),
    )
    const top = Math.min(window.innerHeight - viewportPadding, rect.bottom + 8)

    setOpenDropdownId(userId)
    setMenuPosition({ top, left })
  }

  async function handleToggleActive(user: UserRow) {
    if (isProtectedAdminRole(user.primary_role)) {
      message.warning('Super Admin and Administrator users cannot be deactivated.')
      return
    }

    const nextStatus = !user.is_active
    const previousUsers = users

    setOpenDropdownId(null)
    setMenuPosition(null)
    setUsers((currentUsers) =>
      currentUsers.map((currentUser) =>
        currentUser.user_id === user.user_id
          ? { ...currentUser, is_active: nextStatus }
          : currentUser,
      ),
    )

    try {
      const { data } = await api.patch<{ data: UserRow }>(`/api/users/${user.user_id}/status`, {
        is_active: nextStatus,
      })

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.user_id === user.user_id ? data.data : currentUser,
        ),
      )
      message.success(nextStatus ? 'User activated' : 'User deactivated')
    } catch (requestError: any) {
      console.error(requestError)
      setUsers(previousUsers)
      message.error(requestError.response?.data?.message ?? 'Failed to update user status')
    }
  }

  function handleDeleteUser(user: UserRow) {
    setOpenDropdownId(null)
    setMenuPosition(null)

    Modal.confirm({
      title: `Delete ${user.employee_name}?`,
      content: 'This will remove the user from User Master and the database. They will not be able to log in again.',
      okText: 'Delete User',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      async onOk() {
        try {
          await api.delete(`/api/users/${user.user_id}`)
          setUsers((currentUsers) =>
            currentUsers.filter((currentUser) => currentUser.user_id !== user.user_id),
          )
          setVisiblePins((currentVisiblePins) => {
            const nextVisiblePins = new Set(currentVisiblePins)
            nextVisiblePins.delete(user.user_id)
            return nextVisiblePins
          })
          message.success('User deleted successfully')
        } catch (requestError: any) {
          console.error(requestError)
          message.error(requestError.response?.data?.message ?? 'Failed to delete user')
        }
      },
    })
  }

  async function handlePasswordSubmit(values: PasswordFormValues) {
    if (!selectedUser) {
      return
    }

    setUpdatingPassword(true)

    try {
      await api.put(`/api/users/${selectedUser.user_id}/password`, {
        newPassword: values.newPassword,
      })
      message.success(`Password for ${selectedUser.employee_name} updated successfully`)
      setPasswordModalOpen(false)
      setSelectedUser(null)
      passwordForm.resetFields()
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update password')
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">User Master</h3>
          <p className="mt-1 text-sm text-slate-500">Enterprise users and login access status</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {users.length} Users
          </span>
          <Button icon={<Plus size={16} />} onClick={openCreateModal} type="primary">
            Add User
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-5">
          <Alert message={error} type="error" showIcon />
        </div>
      )}

      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <Spin />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Login Name</th>
                <th className="px-5 py-3 font-semibold">Employee Name</th>
                <th className="px-5 py-3 font-semibold">Employee ID</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">PIN</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr className="hover:bg-slate-50" key={user.user_id}>
                  <td className="px-5 py-4 font-semibold text-slate-800">{user.login_name}</td>
                  <td className="px-5 py-4 text-slate-700">{user.employee_name}</td>
                  <td className="px-5 py-4 text-slate-600">{user.employee_id_str ?? '-'}</td>
                  <td className="px-5 py-4 text-slate-600">{user.primary_role ?? '-'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="min-w-[84px] font-mono text-base tracking-[0.2em] text-slate-700">
                        {visiblePins.has(user.user_id) ? user.current_pin ?? '------' : '\u2022'.repeat(6)}
                      </span>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => handleTogglePin(user.user_id)}
                        type="button"
                        title={visiblePins.has(user.user_id) ? 'PIN visible' : 'PIN hidden'}
                      >
                        {visiblePins.has(user.user_id) ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        user.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        onClick={(event) => toggleActionMenu(user.user_id, event.currentTarget)}
                        type="button"
                        title="User actions"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!users.length && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No users found. Run the database setup script to seed User Master data.
            </div>
          )}
        </div>
      )}

      {openDropdownId && menuPosition && (
        <div
          className="fixed z-[1000] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 text-sm shadow-xl"
          ref={menuRef}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          {(() => {
            const user = users.find((currentUser) => currentUser.user_id === openDropdownId)

            if (!user) {
              return null
            }

            return (
              <>
                {canChangePassword && (
                  <button
                    className="flex w-full items-center gap-4 px-4 py-3 text-left text-slate-700 transition hover:bg-slate-50"
                    onClick={() => openPasswordModal(user)}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-500">
                      <Lock size={18} />
                    </span>
                    Change Password
                  </button>
                )}
                {!isProtectedAdminRole(user.primary_role) && (
                  <button
                    className="flex w-full items-center gap-4 px-4 py-3 text-left text-slate-700 transition hover:bg-slate-50"
                    onClick={() => handleToggleActive(user)}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-500">
                      <ToggleLeft size={18} />
                    </span>
                    {user.is_active ? 'Deactivate User' : 'Activate User'}
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-4 px-4 py-3 text-left text-red-600 transition hover:bg-red-50"
                  onClick={() => handleDeleteUser(user)}
                  type="button"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-500">
                    <Trash2 size={18} />
                  </span>
                  Delete User
                </button>
              </>
            )
          })()}
        </div>
      )}

      <Modal
        confirmLoading={creating}
        okText="Create User"
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        open={modalOpen}
        title="Add User"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
        >
          <Form.Item
            label="Login Name"
            name="login_name"
            rules={[{ required: true, message: 'Login Name is required' }]}
          >
            <Input placeholder="Example: 10075" />
          </Form.Item>

          <Form.Item
            label="Employee Name"
            name="employee_name"
            rules={[{ required: true, message: 'Employee Name is required' }]}
          >
            <Input placeholder="Enter employee name" />
          </Form.Item>

          <Form.Item label="Employee ID" name="employee_id_str">
            <Input placeholder="Example: EMP-001" />
          </Form.Item>

          <Form.Item label="Role" name="primary_role">
            <Select
              allowClear
              placeholder="Select role"
              options={[
                { label: 'Administrator', value: 'Administrator' },
                { label: 'Super Admin', value: 'Super Admin' },
                { label: 'PRI', value: 'PRI' },
                { label: 'Engineer', value: 'Engineer' },
                { label: 'Viewer', value: 'Viewer' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        confirmLoading={updatingPassword}
        okText="Update Password"
        onCancel={() => {
          setPasswordModalOpen(false)
          setSelectedUser(null)
          passwordForm.resetFields()
        }}
        onOk={() => passwordForm.submit()}
        open={passwordModalOpen}
        title={`Change Password${selectedUser ? ` - ${selectedUser.employee_name}` : ''}`}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
          requiredMark={false}
        >
          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: 'New password is required' },
              { min: 6, message: 'Password must be at least 6 characters long' },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>

          <Form.Item
            dependencies={['newPassword']}
            label="Confirm Password"
            name="confirmPassword"
            rules={[
              { required: true, message: 'Confirm password is required' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }

                  return Promise.reject(new Error('Passwords do not match. Please try again.'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Re-enter new password" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
