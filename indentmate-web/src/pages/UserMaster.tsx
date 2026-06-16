import { Alert, Button, Form, Input, Modal, Select, Spin, message } from 'antd'
import { Eye, EyeOff, Lock, MoreVertical, Plus, ShieldCheck, ToggleLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { isPortalAdminRole } from '../utils/roles'

type UserRow = {
  id: number
  user_id: string
  employee_id: string
  login_name?: string
  employee_name: string
  project_id: string
  project_description: string | null
  responsibility: string
  primary_role?: string | null
  valid_from: string | null
  valid_to: string | null
  manual_status: 'Active' | 'Inactive'
  status: 'Active' | 'Inactive'
  is_active: boolean
  password_hash: string | null
  current_pin?: string | null
}

const TABLE_HEADER_CELL_CLASS = 'bg-[#1b2e4b] px-4 py-[14px] text-[13px] font-semibold text-white tracking-[0.5px] normal-case border-b-2 border-[#0f1c30]'
const TABLE_HEADER_ACTIONS_CLASS = `${TABLE_HEADER_CELL_CLASS} text-center w-20`

type CreateUserValues = {
  employee_id: string
  employee_name: string
  project_id: string
  project_description: string
  responsibility: string
  valid_from?: string
  valid_to?: string
  manual_status?: 'Active' | 'Inactive'
  password?: string
}

type PasswordFormValues = {
  newPassword: string
  confirmPassword: string
}

type RoleFormValues = {
  responsibility: string
}

type ProjectOption = {
  code: string
  description: string
}

const SYSTEM_ROLES = [
  'HO Purchase Head (HOP)',
  'Accounts Incharge (ACI)',
  'AMD 2nd Level (AM2)',
  'AMD Head (AMD)',
  'AMD PR Assigner (APA)',
  'AMD Project Co-ordinator (APC)',
  'AMD procurement lead (APL)',
  'HO procurement (HOL)',
  'Human Resource Incharge (HRI)',
  'Project Coordinator (PRC)',
  'Project Incharge (PRI)',
  'Division / Region Commercial Head (RCH)',
  'RO Incharge (ROI)',
  'RO procurement (ROL)',
  'RO Purchase Head (ROP)',
  'Division / Region Technical Head (RTH)',
  'RWS In-charge (RWI)',
  'Site procurement (SPL)',
  'Director (DIR)',
  'EXECUTIVE DIRECTOR (EXD)',
  'PR Assigner (PUA)',
  'QS Engineer (QSE)',
  'Site Engineer (SIE)',
  'Service Engineer (SER)',
  'F&A Head (AFH)',
  'Department Head (DPH)',
  'Procurement Incharge (PUI)',
  'Director Projects (DP)',
  'Division Accounts Coordinator (DAC)',
]

const ROLE_OPTIONS = SYSTEM_ROLES.map((role) => ({
  label: role,
  value: role,
  title: role,
}))

const SEARCH_FIELD_OPTIONS = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Employee Name', value: 'employee_name' },
  { label: 'Project ID', value: 'project_id' },
  { label: 'Project Description', value: 'project_description' },
  { label: 'Responsibility / Role', value: 'responsibility' },
  { label: 'Status', value: 'status' },
]

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  employee_id: 'Enter Employee ID...',
  employee_name: 'Enter Employee Name...',
  project_id: 'Enter Project ID (e.g. EODBHS001)...',
  project_description: 'Enter Project Description...',
  responsibility: 'Enter Responsibility / Role...',
  status: 'Enter Status (Active or Inactive)...',
}

export default function UserMaster() {
  const [form] = Form.useForm<CreateUserValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [roleForm] = Form.useForm<RoleFormValues>()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [visiblePins, setVisiblePins] = useState<Set<string>>(() => new Set())
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchField, setSearchField] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const currentUserRoles = [
    currentUser?.role,
    currentUser?.primary_role,
    ...(currentUser?.assigned_projects?.map((project) => project.role_name) ?? []),
    ...(currentUser?.assignedProjects?.map((project) => project.role_name) ?? []),
  ]
  const isAdministrator = currentUserRoles.some(isPortalAdminRole)

  function togglePinVisibility(employeeId: string) {
    setVisiblePins((currentVisiblePins) => {
      const nextVisiblePins = new Set(currentVisiblePins)

      if (nextVisiblePins.has(employeeId)) {
        nextVisiblePins.delete(employeeId)
      } else {
        nextVisiblePins.add(employeeId)
      }

      return nextVisiblePins
    })
  }

  async function loadUsers(params?: { field: string; value: string }) {
    setLoading(true)
    setError(null)

    try {
      const { data } = await api.get<{ data: UserRow[] }>('/api/users', {
        params,
      })
      setUsers(data.data)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load User Master data. Check that the backend is running and you are logged in.')
    } finally {
      setLoading(false)
    }
  }

  async function loadProjectOptions() {
    setProjectOptionsLoading(true)

    try {
      const { data } = await api.get<{ data: Array<Record<string, unknown>> }>('/api/master-data/project-master', {
        params: { limit: 500 },
      })
      const options = data.data
        .map((project) => ({
          code: String(project.project_code ?? '').trim(),
          description: String(project.project_description ?? '').trim(),
        }))
        .filter((project) => project.code || project.description)

      setProjectOptions(options)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load project options')
    } finally {
      setProjectOptionsLoading(false)
    }
  }

  function handleProjectIdChange(value?: string) {
    form.setFieldValue('project_id', value)

    if (!value) {
      form.setFieldValue('project_description', undefined)
      return
    }

    const selectedProject = projectOptions.find((project) => project.code === value)
    if (selectedProject?.description) {
      form.setFieldValue('project_description', selectedProject.description)
    }
  }

  function handleProjectDescriptionChange(value?: string) {
    form.setFieldValue('project_description', value)

    if (!value) {
      form.setFieldValue('project_id', undefined)
      return
    }

    const selectedProject = projectOptions.find((project) => project.description === value)
    if (selectedProject?.code) {
      form.setFieldValue('project_id', selectedProject.code)
    }
  }

  useEffect(() => {
    loadUsers()
    loadProjectOptions()
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
      await api.post('/api/users', {
        ...values,
        valid_from: values.valid_from || null,
        valid_to: values.valid_to || null,
        manual_status: values.manual_status ?? 'Active',
        password: values.password || '123456',
      })
      message.success('User Master record created. Default PIN is 123456.')
      form.resetFields()
      setModalOpen(false)
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create User Master record')
    } finally {
      setCreating(false)
    }
  }

  function openCreateModal() {
    form.setFieldsValue({ manual_status: 'Active', password: '123456' })
    setModalOpen(true)

    if (!projectOptions.length) {
      loadProjectOptions()
    }
  }

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim()

    if (!searchField || !trimmedQuery) {
      message.warning('Select a filter field and enter a search value.')
      return
    }

    await loadUsers({ field: searchField, value: trimmedQuery })
    setIsFilterActive(true)
  }

  async function handleClearSearch() {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    await loadUsers()
  }

  function openPasswordModal(user: UserRow) {
    setSelectedUser(user)
    passwordForm.resetFields()
    setOpenDropdownId(null)
    setMenuPosition(null)
    setPasswordModalOpen(true)
  }

  function openRoleModal(user: UserRow) {
    setSelectedUser(user)
    roleForm.setFieldsValue({ responsibility: user.responsibility })
    setOpenDropdownId(null)
    setMenuPosition(null)
    setRoleModalOpen(true)
  }

  function toggleActionMenu(userId: number, button: HTMLButtonElement) {
    if (openDropdownId === userId) {
      setOpenDropdownId(null)
      setMenuPosition(null)
      return
    }

    const rect = button.getBoundingClientRect()
    const menuWidth = 288
    const viewportPadding = 12
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - menuWidth),
    )
    const top = Math.min(window.innerHeight - viewportPadding, rect.bottom + 8)

    setOpenDropdownId(userId)
    setMenuPosition({ top, left })
  }

  async function handleToggleStatus(user: UserRow) {
    const nextManualStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    setUpdatingStatusId(user.id)
    setOpenDropdownId(null)
    setMenuPosition(null)

    try {
      await api.patch(`/api/users/${encodeURIComponent(user.employee_id)}/toggle-status`, {
        manual_status: nextManualStatus,
      })
      message.success(nextManualStatus === 'Active' ? 'User activated' : 'User deactivated')
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update status')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  async function handlePasswordSubmit(values: PasswordFormValues) {
    if (!selectedUser) {
      return
    }

    setUpdatingPassword(true)

    try {
      await api.put(`/api/users/${selectedUser.id}/password`, {
        newPassword: values.newPassword,
      })
      message.success(`PIN for ${selectedUser.employee_name} updated successfully`)
      setPasswordModalOpen(false)
      setSelectedUser(null)
      passwordForm.resetFields()
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update PIN')
    } finally {
      setUpdatingPassword(false)
    }
  }

  async function handleRoleSubmit(values: RoleFormValues) {
    if (!selectedUser) {
      return
    }

    setUpdatingRole(true)

    try {
      await api.patch(`/api/users/${selectedUser.id}/role`, {
        responsibility: values.responsibility,
      })
      message.success(`Responsibility for ${selectedUser.employee_name} updated successfully`)
      setRoleModalOpen(false)
      setSelectedUser(null)
      roleForm.resetFields()
      await loadUsers()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update responsibility')
    } finally {
      setUpdatingRole(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">User Master</h3>
          <p className="mt-1 text-sm text-slate-500">Enterprise personnel, projects, responsibilities, and access status</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-[15px]">
          <Select
            allowClear
            className="min-w-[220px]"
            onChange={(value) => {
              setSearchField(value ?? '')
              setSearchQuery('')
            }}
            options={SEARCH_FIELD_OPTIONS}
            placeholder="Select Filter Field"
            value={searchField || undefined}
          />
          <Input
            className="max-w-[360px]"
            disabled={!searchField}
            onChange={(event) => setSearchQuery(event.target.value)}
            onPressEnter={handleSearch}
            placeholder={searchField ? SEARCH_PLACEHOLDERS[searchField] : 'Select a field first...'}
            value={searchQuery}
          />
          <Button onClick={handleSearch} type="primary">
            Search
          </Button>
          {isFilterActive && (
            <Button onClick={handleClearSearch} type="text">
              Clear
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {users.length} Records
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
          <table className="min-w-[1240px] divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr>
                <th className={TABLE_HEADER_CELL_CLASS}>Employee Id</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Employee Name</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Project Id</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Project Description</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Responsibility</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Pin</th>
                <th className={TABLE_HEADER_CELL_CLASS}>Status</th>
                <th className={TABLE_HEADER_ACTIONS_CLASS}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => {
                const isPinVisible = visiblePins.has(user.employee_id)

                return (
                  <tr className="hover:bg-slate-50" key={user.id}>
                    <td className="px-4 py-4 font-mono font-semibold text-slate-800">{user.employee_id}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{user.employee_name}</td>
                    <td className="px-4 py-4 font-mono text-slate-700">{user.project_id}</td>
                    <td className="max-w-[220px] px-4 py-4 text-slate-600" title={user.project_description ?? '-'}>
                      <span className="block truncate">{user.project_description ?? '-'}</span>
                    </td>
                    <td className="max-w-[260px] px-4 py-4 text-slate-700" title={user.responsibility}>
                      <span className="block truncate">{user.responsibility}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-[104px] font-mono text-base tracking-[2px] text-slate-700">
                          {isPinVisible ? user.password_hash ?? '------' : '\u2022\u2022\u2022\u2022\u2022\u2022'}
                        </span>
                        <button
                          className="grid h-8 w-8 place-items-center rounded-full bg-transparent text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => togglePinVisibility(user.employee_id)}
                          type="button"
                          title={isPinVisible ? 'Hide PIN' : 'Show PIN'}
                        >
                          {isPinVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                          user.status === 'Active' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          onClick={(event) => toggleActionMenu(user.id, event.currentTarget)}
                          type="button"
                          title="User tools"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!users.length && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No users found. Import Responsibility.xlsx to seed User Master data.
            </div>
          )}
        </div>
      )}

      {openDropdownId && menuPosition && (
        <div
          className="fixed z-[1000] w-72 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 text-sm shadow-xl"
          ref={menuRef}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          {(() => {
            const user = users.find((currentUser) => currentUser.id === openDropdownId)

            if (!user) {
              return null
            }

            return (
              <>
                {isAdministrator && (
                  <button
                    className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      user.status === 'Active' ? 'text-red-600' : 'text-blue-600'
                    }`}
                    disabled={updatingStatusId === user.id}
                    onClick={() => handleToggleStatus(user)}
                    type="button"
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-lg ${
                        user.status === 'Active'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-blue-50 text-blue-500'
                      }`}
                    >
                      <ToggleLeft size={18} />
                    </span>
                    {user.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                  </button>
                )}
                {isAdministrator && (
                  <button
                    className="flex w-full items-center gap-4 px-4 py-3 text-left text-slate-700 transition hover:bg-slate-50"
                    onClick={() => openPasswordModal(user)}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-500">
                      <Lock size={18} />
                    </span>
                    Change PIN
                  </button>
                )}
                {isAdministrator && (
                  <button
                    className="flex w-full items-center gap-4 px-4 py-3 text-left text-slate-700 transition hover:bg-slate-50"
                    onClick={() => openRoleModal(user)}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-500">
                      <ShieldCheck size={18} />
                    </span>
                    Change Responsibility
                  </button>
                )}
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
        title="Add User Master Record"
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              label="Employee ID"
              name="employee_id"
              rules={[{ required: true, message: 'Employee ID is required' }]}
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

            <Form.Item
              label="Project ID"
              name="project_id"
              rules={[{ required: true, message: 'Project ID is required' }]}
            >
              <Select
                allowClear
                loading={projectOptionsLoading}
                onChange={handleProjectIdChange}
                optionFilterProp="label"
                options={projectOptions.map((project) => ({
                  label: project.description ? `${project.code} - ${project.description}` : project.code,
                  value: project.code,
                }))}
                placeholder="Select Project ID"
                showSearch
              />
            </Form.Item>

            <Form.Item
              label="Project Description"
              name="project_description"
              rules={[{ required: true, message: 'Project description is required' }]}
            >
              <Select
                allowClear
                loading={projectOptionsLoading}
                onChange={handleProjectDescriptionChange}
                optionFilterProp="label"
                options={projectOptions.map((project) => ({
                  label: project.code ? `${project.description} - ${project.code}` : project.description,
                  value: project.description,
                }))}
                placeholder="Select Project Description"
                showSearch
              />
            </Form.Item>

            <Form.Item
              className="md:col-span-2"
              label="Responsibility"
              name="responsibility"
              rules={[{ required: true, message: 'Responsibility is required' }]}
            >
              <Select
                optionFilterProp="label"
                options={ROLE_OPTIONS}
                placeholder="Select responsibility"
                showSearch
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Valid From" name="valid_from">
              <Input type="date" />
            </Form.Item>

            <Form.Item label="Valid To" name="valid_to">
              <Input type="date" />
            </Form.Item>

            <Form.Item label="Manual Status" name="manual_status">
              <Select
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="6-Digit PIN"
              name="password"
              rules={[{ pattern: /^\d{6}$/, message: 'PIN must be exactly 6 digits' }]}
            >
              <Input maxLength={6} placeholder="123456" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        confirmLoading={updatingPassword}
        okText="Update PIN"
        onCancel={() => {
          setPasswordModalOpen(false)
          setSelectedUser(null)
          passwordForm.resetFields()
        }}
        onOk={() => passwordForm.submit()}
        open={passwordModalOpen}
        title={`Change PIN${selectedUser ? ` - ${selectedUser.employee_name}` : ''}`}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordSubmit} requiredMark={false}>
          <Form.Item
            label="New 6-Digit PIN"
            name="newPassword"
            rules={[
              { required: true, message: 'New PIN is required' },
              { pattern: /^\d{6}$/, message: 'PIN must be exactly 6 digits' },
            ]}
          >
            <Input.Password maxLength={6} placeholder="Enter new PIN" />
          </Form.Item>

          <Form.Item
            dependencies={['newPassword']}
            label="Confirm PIN"
            name="confirmPassword"
            rules={[
              { required: true, message: 'Confirm PIN is required' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }

                  return Promise.reject(new Error('PINs do not match. Please try again.'))
                },
              }),
            ]}
          >
            <Input.Password maxLength={6} placeholder="Re-enter new PIN" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        confirmLoading={updatingRole}
        okText="Update Responsibility"
        onCancel={() => {
          setRoleModalOpen(false)
          setSelectedUser(null)
          roleForm.resetFields()
        }}
        onOk={() => roleForm.submit()}
        open={roleModalOpen}
        title={`Change Responsibility${selectedUser ? ` - ${selectedUser.employee_name}` : ''}`}
        width={560}
      >
        <Form form={roleForm} layout="vertical" onFinish={handleRoleSubmit} requiredMark={false}>
          <Form.Item
            label="Responsibility"
            name="responsibility"
            rules={[{ required: true, message: 'Responsibility is required' }]}
          >
            <Select
              optionFilterProp="label"
              options={ROLE_OPTIONS}
              placeholder="Select responsibility"
              showSearch
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
