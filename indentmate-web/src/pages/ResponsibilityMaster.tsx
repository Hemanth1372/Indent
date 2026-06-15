import { Alert, Button, Checkbox, Dropdown, Form, Input, Modal, Select, Spin, message } from 'antd'
import { Download, Eye, EyeOff, Filter, KeyRound, MoreVertical, Pencil, Plus, ShieldCheck, ToggleLeft, ToggleRight, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { NumberedPagination } from '../components/NumberedPagination'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const PAGE_SIZE = 100
const TABLE_HEADER_CELL_CLASS = 'bg-[#1b2e4b] px-5 py-[14px] text-[13px] font-semibold text-white tracking-[0.5px] normal-case border-b-2 border-[#0f1c30]'
const TABLE_HEADER_SELECTION_CLASS = 'bg-[#1b2e4b] px-4 py-[14px] text-center align-middle border-b-2 border-[#0f1c30] w-[52px]'
const TABLE_HEADER_ACTIONS_CLASS = `${TABLE_HEADER_CELL_CLASS} text-center w-20`

type UserRow = {
  id: number | string
  employee_id: string
  employee_name: string
  email_id: string
  password_hash: string
  status: 'Active' | 'Inactive'
  manual_status: 'Active' | 'Inactive'
}

type AssignmentRow = {
  id: number
  employee_id: string
  employee_name: string
  project_id: string
  project_description: string
  responsibility: string
  valid_from: string | null
  valid_to: string | null
  status: 'Active' | 'Inactive'
}

type UserFormValues = {
  employee_id: string
  employee_name: string
  email_id?: string
  password_hash?: string
}

type AssignmentFormValues = {
  project_id: string
  project_description: string
  responsibility: string
  valid_from?: string
  valid_to?: string
}

type RoleOption = {
  role_name: string
  responsibility: string
}

type RoleOptions = {
  responsibilities: string[]
  roles?: RoleOption[]
}

type SelectOption = {
  label: string
  value: string
}

type ProjectOption = {
  code: string
  description: string
}

type UserListResponse = {
  data: UserRow[]
  metadata: {
    totalRecords: number
    totalPages: number
    currentPage: number
    limit: number
  }
}

type UserFilter = {
  id: string
  field: string
  value: string
}

type FilterValueOptionsResponse = {
  data: Array<string | { label: string; value: string }>
}

const searchFields = [
  { label: 'Employee ID', value: 'employee_id', placeholder: 'Enter Employee ID...' },
  { label: 'Employee Name', value: 'employee_name', placeholder: 'Enter Employee Name...' },
  { label: 'Email ID', value: 'email_id', placeholder: 'Enter Email ID...' },
]

const ASSIGNMENT_IMPORT_COLUMNS = [
  'Employee ID',
  'Employee Name',
  'Project ID',
  'Project Description',
  'Responsibility',
  'Valid From',
  'Valid To',
]

const REQUIRED_IMPORT_HEADERS = new Set(['Employee ID', 'Employee Name', 'Project ID', 'Project Description', 'Responsibility'])
const DEFAULT_FIELDS_MAPPING = Object.fromEntries(ASSIGNMENT_IMPORT_COLUMNS.map((column) => [column, true]))

type SyncSummary = {
  insertedCount: number
  updatedCount: number
  unchangedCount: number
  updatedRecordsLog: string[]
}

function maskedPinText(value: string, visible: boolean) {
  return visible ? value : '\u2022\u2022\u2022\u2022\u2022\u2022'
}

export default function ResponsibilityMaster() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form] = Form.useForm<UserFormValues>()
  const [editForm] = Form.useForm<UserFormValues>()
  const [passwordForm] = Form.useForm<{ new_pin: string; confirm_pin: string }>()
  const [assignmentForm] = Form.useForm<AssignmentFormValues>()
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<UserRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [roles, setRoles] = useState<RoleOptions>({ responsibilities: [] })
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null)
  const [visiblePins, setVisiblePins] = useState<Set<string>>(new Set())
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set())
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [passwordValidationError, setPasswordValidationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<UserFilter[]>([])
  const [activeFilters, setActiveFilters] = useState<UserFilter[]>([])
  const [filterValueOptions, setFilterValueOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({})
  const [filterValueOptionsLoading, setFilterValueOptionsLoading] = useState<Record<string, boolean>>({})
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [fieldsMapping, setFieldsMapping] = useState<Record<string, boolean>>(DEFAULT_FIELDS_MAPPING)
  const [syncResults, setSyncResults] = useState<SyncSummary | null>(null)

  const visibleRowKeys = useMemo(() => users.map((user) => user.employee_id), [users])
  const selectedVisibleCount = useMemo(
    () => visibleRowKeys.filter((rowKey) => selectedRowKeys.has(rowKey)).length,
    [selectedRowKeys, visibleRowKeys],
  )
  const allVisibleRowsSelected = visibleRowKeys.length > 0 && selectedVisibleCount === visibleRowKeys.length
  const someVisibleRowsSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleRowKeys.length
  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.primary_role === 'Super Admin'
  const roleSelectOptions = useMemo(() => buildRoleSelectOptions(roles), [roles])

  useEffect(() => {
    loadUsers(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
  }, [currentPage])

  function normalizedFilters(filters = activeFilters) {
    return filters
      .map((filter) => ({
        ...filter,
        field: filter.field.trim(),
        value: filter.value.trim(),
      }))
      .filter((filter) => filter.field && filter.value)
  }

  function filterRequestParams(page?: number) {
    const filters = normalizedFilters()
    return filters.length > 0 ? { filters, page } : { page }
  }

  async function loadUsers(params?: { page?: number; field?: string; value?: string; filters?: UserFilter[] }) {
    setLoading(true)
    setError(null)

    try {
      const filters = normalizedFilters(params?.filters)
      const { data } = await api.get<UserListResponse>('/api/responsibilities', {
        params: {
          page: params?.page ?? currentPage,
          limit: PAGE_SIZE,
          ...(filters.length > 0
            ? { filters: JSON.stringify(filters.map(({ field, value }) => ({ field, value }))) }
            : params?.field && params?.value
              ? { field: params.field, value: params.value }
              : {}),
        },
      })
      setUsers(data.data)
      setCurrentPage(data.metadata.currentPage)
      setTotalPages(data.metadata.totalPages)
      setTotalRecords(data.metadata.totalRecords)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load User Master data. Check that the backend is running and you are logged in.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRoleOptions() {
    setOptionsLoading(true)

    try {
      const { data } = await api.get<RoleOptions>('/api/responsibilities/options')
      setRoles(data)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load role options')
    } finally {
      setOptionsLoading(false)
    }
  }

  async function loadProjectOptions() {
    setProjectOptionsLoading(true)

    try {
      const { data } = await api.get<{ data: Array<Record<string, unknown>> }>('/api/master-data/project-master', {
        params: { limit: 500 },
      })
      setProjectOptions(data.data
        .map((project) => ({
          code: String(project.project_code ?? '').trim(),
          description: String(project.project_description ?? '').trim(),
        }))
        .filter((project) => project.code || project.description))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load project options')
    } finally {
      setProjectOptionsLoading(false)
    }
  }

  async function loadAssignments(employeeId: string) {
    setAssignmentLoading(true)

    try {
      const { data } = await api.get<{ data: AssignmentRow[] }>(`/api/responsibilities/users/${encodeURIComponent(employeeId)}/projects`)
      setAssignments(data.data)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load project assignments')
    } finally {
      setAssignmentLoading(false)
    }
  }

  function clearSelectionBuffer() {
    setSelectedRowKeys(new Set())
  }

  function handleSelectRowToggle(rowKey: string) {
    setSelectedRowKeys((currentSelection) => {
      const updatedSelection = new Set(currentSelection)
      updatedSelection.has(rowKey) ? updatedSelection.delete(rowKey) : updatedSelection.add(rowKey)
      return updatedSelection
    })
  }

  function handleSelectAllVisibleToggle() {
    setSelectedRowKeys((currentSelection) => {
      const updatedSelection = new Set(currentSelection)
      const everyVisibleRowIsSelected = visibleRowKeys.every((rowKey) => updatedSelection.has(rowKey))

      if (everyVisibleRowIsSelected) {
        visibleRowKeys.forEach((rowKey) => updatedSelection.delete(rowKey))
      } else {
        visibleRowKeys.forEach((rowKey) => updatedSelection.add(rowKey))
      }

      return updatedSelection
    })
  }

  function availableFilterOptions(currentFilterId?: string) {
    const selectedFields = new Set(
      draftFilters
        .filter((filter) => filter.id !== currentFilterId)
        .map((filter) => filter.field)
        .filter(Boolean),
    )

    return searchFields
      .filter((field) => !selectedFields.has(field.value))
      .map((field) => ({ label: field.label, value: field.value }))
  }

  async function loadFilterValueOptions(field: string) {
    if (!field || filterValueOptions[field] || filterValueOptionsLoading[field]) {
      return
    }

    setFilterValueOptionsLoading((currentLoading) => ({ ...currentLoading, [field]: true }))

    try {
      const { data } = await api.get<FilterValueOptionsResponse>('/api/responsibilities/filter-options', {
        params: { field },
      })
      setFilterValueOptions((currentOptions) => ({
        ...currentOptions,
        [field]: data.data.map((option) => typeof option === 'string' ? { label: option, value: option } : option),
      }))
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load filter values.')
    } finally {
      setFilterValueOptionsLoading((currentLoading) => ({ ...currentLoading, [field]: false }))
    }
  }

  function handleOpenFilterModal() {
    const filters = normalizedFilters().map((filter) => ({ ...filter }))
    setDraftFilters(filters)
    filters.forEach((filter) => {
      void loadFilterValueOptions(filter.field)
    })
    setFilterModalOpen(true)
  }

  function handleAppendDraftFilter(field?: string) {
    if (!field) {
      return
    }

    void loadFilterValueOptions(field)
    setDraftFilters((currentFilters) => [
      ...currentFilters,
      { id: `${field}-${Date.now()}-${currentFilters.length}`, field, value: '' },
    ])
  }

  function updateDraftFilter(id: string, patch: Partial<UserFilter>) {
    if (patch.field) {
      void loadFilterValueOptions(patch.field)
    }

    setDraftFilters((currentFilters) =>
      currentFilters.map((filter) => filter.id === id ? { ...filter, ...patch } : filter),
    )
  }

  function removeDraftFilter(id: string) {
    setDraftFilters((currentFilters) => currentFilters.filter((filter) => filter.id !== id))
  }

  async function handleApplyFilters() {
    const filters = normalizedFilters(draftFilters)

    if (draftFilters.some((filter) => filter.field && !filter.value.trim())) {
      message.warning('Select a value for each selected filter field.')
      return
    }

    if (filters.length === 0) {
      message.warning('Select at least one filter field and value.')
      return
    }

    setActiveFilters(filters)
    setIsFilterActive(true)
    setCurrentPage(1)
    setFilterModalOpen(false)
    clearSelectionBuffer()
    await loadUsers({ page: 1, filters })
  }

  async function handleClearSearch() {
    setDraftFilters([])
    setActiveFilters([])
    setIsFilterActive(false)
    setFilterModalOpen(false)
    setCurrentPage(1)
    clearSelectionBuffer()
    await loadUsers({ filters: [], page: 1 })
  }

  function openCreateModal() {
    form.setFieldsValue({ password_hash: '123456' })
    setModalOpen(true)
  }

  async function handleCreate(values: UserFormValues) {
    setCreating(true)

    try {
      await api.post('/api/responsibilities/users', normalizeUserPayload(values))
      form.resetFields()
      setModalOpen(false)
      setCurrentPage(1)
      await loadUsers({ page: 1 })
      message.success('User Master record created successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create User Master record')
    } finally {
      setCreating(false)
    }
  }

  function openEditModal(user: UserRow) {
    setOpenActionId(null)
    setSelectedUser(user)
    editForm.setFieldsValue({
      employee_id: user.employee_id,
      employee_name: user.employee_name,
      email_id: user.email_id ?? '',
      password_hash: user.password_hash,
    })
    setEditModalOpen(true)
  }

  async function handleEdit(values: UserFormValues) {
    if (!selectedUser) {
      return
    }

    setUpdating(true)

    try {
      await api.put(`/api/responsibilities/users/${encodeURIComponent(selectedUser.employee_id)}`, {
        employee_name: values.employee_name.trim(),
        email_id: values.email_id?.trim() ?? '',
        password_hash: values.password_hash?.trim() || undefined,
      })
      setEditModalOpen(false)
      setSelectedUser(null)
      editForm.resetFields()
      await loadUsers(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
      message.success('User Master record updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update User Master record')
    } finally {
      setUpdating(false)
    }
  }

  function openPasswordModal(user: UserRow) {
    setOpenActionId(null)
    setSelectedUser(user)
    passwordForm.resetFields()
    setPasswordValidationError(null)
    setPasswordModalOpen(true)
  }

  async function handleChangePassword(values: { new_pin: string; confirm_pin: string }) {
    if (!selectedUser) {
      return
    }

    if (!/^\d{6}$/.test(values.new_pin)) {
      setPasswordValidationError('Format Invalid: Password must be an exact 6-digit numerical PIN.')
      return
    }

    if (values.new_pin !== values.confirm_pin) {
      setPasswordValidationError('Validation Error: Both entered password fields do not match. Please verify and try again.')
      return
    }

    setUpdating(true)

    try {
      await api.put(`/api/responsibilities/users/${encodeURIComponent(selectedUser.employee_id)}`, {
        password_hash: values.new_pin,
      })
      setPasswordModalOpen(false)
      setSelectedUser(null)
      passwordForm.resetFields()
      await loadUsers(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
      message.success('PIN updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update PIN')
    } finally {
      setUpdating(false)
    }
  }

  async function handleToggleStatus(user: UserRow) {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active'

    try {
      setOpenActionId(null)
      await api.patch(`/api/responsibilities/users/${encodeURIComponent(user.employee_id)}/toggle-status`, {
        manual_status: nextStatus,
      })
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.employee_id === user.employee_id
            ? { ...currentUser, manual_status: nextStatus, status: nextStatus }
            : currentUser,
        ),
      )
      message.success(nextStatus === 'Active' ? 'User activated successfully' : 'User deactivated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update user status')
    }
  }

  async function openProjectModal(user: UserRow) {
    setOpenActionId(null)
    setSelectedUser(user)
    setEditingAssignmentId(null)
    assignmentForm.resetFields()
    setProjectModalOpen(true)
    await Promise.all([
      loadAssignments(user.employee_id),
      roleSelectOptions.length ? Promise.resolve() : loadRoleOptions(),
      projectOptions.length ? Promise.resolve() : loadProjectOptions(),
    ])
  }

  function getRoleDisplay(value: string) {
    const exactRoleNameMatch = roles.roles?.find((role) => role.role_name === value)
    if (exactRoleNameMatch) {
      return formatRoleOptionLabel(exactRoleNameMatch)
    }

    return value
  }

  function handleEditAssignment(assignment: AssignmentRow) {
    setEditingAssignmentId(assignment.id)
    assignmentForm.setFieldsValue({
      project_id: assignment.project_id,
      project_description: assignment.project_description,
      responsibility: getRoleDisplay(assignment.responsibility),
      valid_from: assignment.valid_from ?? '',
      valid_to: assignment.valid_to ?? '',
    })
  }

  async function handleAssignmentSubmit(values: AssignmentFormValues) {
    if (!selectedUser) {
      return
    }

    setUpdating(true)

    try {
      const payload = normalizeAssignmentPayload(values)
      if (editingAssignmentId === null) {
        await api.post(`/api/responsibilities/users/${encodeURIComponent(selectedUser.employee_id)}/projects`, payload)
        message.success('Project assignment added successfully')
      } else {
        await api.put(`/api/responsibilities/${editingAssignmentId}`, payload)
        message.success('Project assignment updated successfully')
      }

      assignmentForm.resetFields()
      setEditingAssignmentId(null)
      await loadAssignments(selectedUser.employee_id)
      await loadUsers(isFilterActive ? filterRequestParams(currentPage) : { filters: [], page: currentPage })
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to save project assignment')
    } finally {
      setUpdating(false)
    }
  }

  async function handleImportFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      message.error('Import file must be .xlsx, .xls, or .csv')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      try {
        const result = readerEvent.target?.result
        if (!result) {
          message.error('Could not read the selected file')
          return
        }

        const workbook = XLSX.read(new Uint8Array(result as ArrayBuffer), { type: 'array', sheetRows: 1 })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null
        const headerRows = firstSheet ? XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' }) : []
        const headers = (headerRows[0] ?? []).map((header) => String(header ?? '').trim()).filter(Boolean)
        const missingHeader = [...REQUIRED_IMPORT_HEADERS].find((header) => !headers.includes(header))

        if (missingHeader) {
          message.error(`Import file must include the ${missingHeader} column`)
          event.target.value = ''
          return
        }

        const initialMapping = Object.fromEntries(headers.map((header) => [header, true]))
        for (const header of REQUIRED_IMPORT_HEADERS) {
          initialMapping[header] = true
        }

        setDetectedHeaders(headers)
        setFieldsMapping(initialMapping)
        setImportFile(file)
        setShowMappingModal(true)
      } catch (readerError) {
        console.error(readerError)
        message.error('Could not parse the selected spreadsheet headers')
        event.target.value = ''
      }
    }
    reader.onerror = () => {
      message.error('Could not read the selected file')
      event.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  async function executeImport() {
    if (!importFile) {
      message.error('Choose a file before importing')
      return
    }

    const formData = new FormData()
    formData.append('file', importFile)
    formData.append('fieldsMapping', JSON.stringify(fieldsMapping))
    setImporting(true)

    try {
      const { data } = await api.post<{ summary: SyncSummary }>('/api/responsibilities/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setShowMappingModal(false)
      setSyncResults(data.summary)
      setShowResultsModal(true)
      setImportFile(null)
      setDetectedHeaders([])
      clearSelectionBuffer()
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setCurrentPage(1)
      await loadUsers({ page: 1 })
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to import User Project Assignment file')
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    setExporting(true)

    try {
      const selectedKeys = Array.from(selectedRowKeys)
      const exportParams = selectedKeys.length > 0
        ? { selectedKeys: selectedKeys.join(',') }
        : isFilterActive
          ? { filters: JSON.stringify(normalizedFilters().map(({ field, value }) => ({ field, value }))) }
          : undefined
      const { data } = await api.get<Blob>('/api/responsibilities/export', {
        params: exportParams,
        responseType: 'blob',
      })
      const downloadUrl = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'User_Master_Export.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      clearSelectionBuffer()
      message.success(selectedKeys.length > 0
        ? `${selectedKeys.length} selected user${selectedKeys.length === 1 ? '' : 's'} exported`
        : 'User Master export started')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to export User Master data')
    } finally {
      setExporting(false)
    }
  }

  function togglePinVisibility(employeeId: string) {
    setVisiblePins((currentPins) => {
      const nextPins = new Set(currentPins)
      nextPins.has(employeeId) ? nextPins.delete(employeeId) : nextPins.add(employeeId)
      return nextPins
    })
  }

  const showingStart = totalRecords === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
  const showingEnd = Math.min(currentPage * PAGE_SIZE, totalRecords)

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">User Master</h3>
          <p className="mt-1 text-sm text-slate-500">Manage user identity, login PINs, activation, and project assignments.</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {totalRecords} Users
          </span>
          {selectedRowKeys.size > 0 && (
            <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {selectedRowKeys.size} user{selectedRowKeys.size === 1 ? '' : 's'} selected
            </span>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button className="relative" icon={<Filter size={16} />} onClick={handleOpenFilterModal} title="Filter users">
              Filter
              {activeFilters.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {activeFilters.length}
                </span>
              )}
            </Button>
            {isFilterActive && <Button onClick={handleClearSearch} type="text">Clear</Button>}
            <input
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFileSelect}
              ref={fileInputRef}
              type="file"
            />
            <Button disabled={!isSuperAdmin || importing} icon={<Upload size={16} />} loading={importing} onClick={() => fileInputRef.current?.click()}>
              Import
            </Button>
            <Button disabled={!isSuperAdmin || exporting} icon={<Download size={16} />} loading={exporting} onClick={handleExport}>
              Export
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreateModal} type="primary">
              Add User
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-5">
          <Alert message={error} type="error" showIcon />
        </div>
      )}

      {loading || importing ? (
        <div className="grid min-h-64 place-items-center">
          <Spin tip={importing ? 'Importing User Project Assignments...' : undefined} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full table-fixed divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr>
                  <th className={TABLE_HEADER_SELECTION_CLASS}>
                    <Checkbox
                      checked={allVisibleRowsSelected}
                      disabled={!users.length}
                      indeterminate={someVisibleRowsSelected}
                      onChange={handleSelectAllVisibleToggle}
                    />
                  </th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Employee ID</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Employee Name</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Email ID</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Pin</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Status</th>
                  <th className={TABLE_HEADER_ACTIONS_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((user) => {
                  const rowSelectionKey = user.employee_id
                  const isPinVisible = visiblePins.has(user.employee_id)

                  return (
                    <tr className={`${selectedRowKeys.has(rowSelectionKey) ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`} key={user.employee_id}>
                      <td className="px-4 py-4 text-center align-middle">
                        <Checkbox checked={selectedRowKeys.has(rowSelectionKey)} onChange={() => handleSelectRowToggle(rowSelectionKey)} />
                      </td>
                      <td className="px-5 py-4 align-middle font-mono font-bold text-slate-800">{user.employee_id}</td>
                      <td className="px-5 py-4 align-middle text-slate-700">{user.employee_name}</td>
                      <td className="px-5 py-4 align-middle text-slate-700">{user.email_id || '-'}</td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold tracking-[0.35em] text-slate-800">
                            {maskedPinText(user.password_hash, isPinVisible)}
                          </span>
                          <button
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            onClick={() => togglePinVisibility(user.employee_id)}
                            title={isPinVisible ? 'Hide PIN' : 'Show PIN'}
                            type="button"
                          >
                            {isPinVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${user.status === 'Active' ? 'bg-green-600' : 'bg-red-600'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="w-20 px-5 py-4 text-center align-middle">
                        {isSuperAdmin ? (
                          <Dropdown
                            dropdownRender={() => (
                              <div className="w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                                <button className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50" onClick={() => openEditModal(user)} type="button">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Pencil size={18} /></span>
                                  <span className="text-sm font-medium">Edit User</span>
                                </button>
                                <button className="mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50" onClick={() => openPasswordModal(user)} type="button">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500"><KeyRound size={18} /></span>
                                  <span className="text-sm font-medium">Change PIN</span>
                                </button>
                                <button className="mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50" onClick={() => openProjectModal(user)} type="button">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500"><ShieldCheck size={18} /></span>
                                  <span className="text-sm font-medium">Manage Projects</span>
                                </button>
                                <button
                                  className={`mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left transition ${user.status === 'Active' ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}
                                  onClick={() => handleToggleStatus(user)}
                                  type="button"
                                >
                                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${user.status === 'Active' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                    {user.status === 'Active' ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}
                                  </span>
                                  <span className="text-sm font-medium">{user.status === 'Active' ? 'Deactivate User' : 'Activate User'}</span>
                                </button>
                              </div>
                            )}
                            onOpenChange={(open) => setOpenActionId(open ? user.employee_id : null)}
                            open={openActionId === user.employee_id}
                            placement="bottomRight"
                            trigger={['click']}
                          >
                            <button className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title="User actions" type="button">
                              <MoreVertical size={20} />
                            </button>
                          </Dropdown>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">No Access</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!users.length && <div className="px-5 py-10 text-center text-sm text-slate-500">No users found.</div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>Showing users {showingStart}-{showingEnd} of {totalRecords}</span>
            <NumberedPagination
              currentPage={currentPage}
              loading={loading}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          </div>
        </>
      )}

      <Modal
        okText="Apply Filters"
        onCancel={() => setFilterModalOpen(false)}
        onOk={handleApplyFilters}
        open={filterModalOpen}
        title="Filter Records"
        width={680}
      >
        <div className="space-y-3">
          {availableFilterOptions().length > 0 && (
            <Select
              className="w-full"
              onChange={handleAppendDraftFilter}
              options={availableFilterOptions()}
              placeholder="Select Field"
              value={undefined}
            />
          )}

          {draftFilters.map((filter) => {
            const selectedField = searchFields.find((field) => field.value === filter.field)

            return (
              <div className="grid grid-cols-[minmax(170px,0.9fr)_minmax(220px,1.25fr)_36px] items-center gap-3" key={filter.id}>
                <Select
                  onChange={(value) => updateDraftFilter(filter.id, { field: value, value: '' })}
                  options={availableFilterOptions(filter.id)}
                  placeholder="Select Field"
                  value={filter.field || undefined}
                />
                <Select
                  allowClear
                  loading={filterValueOptionsLoading[filter.field]}
                  onChange={(value) => updateDraftFilter(filter.id, { value: value ?? '' })}
                  onDropdownVisibleChange={(open) => {
                    if (open) {
                      void loadFilterValueOptions(filter.field)
                    }
                  }}
                  options={filterValueOptions[filter.field] ?? []}
                  placeholder={selectedField?.placeholder ?? 'Select filter value'}
                  showSearch
                  value={filter.value || undefined}
                />
                <button
                  className="grid h-9 w-9 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => removeDraftFilter(filter.id)}
                  title="Remove filter"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}

          {draftFilters.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Select a field to start filtering users.
            </div>
          )}

          {isFilterActive && (
            <Button onClick={handleClearSearch} type="text">
              Clear all filters
            </Button>
          )}
        </div>
      </Modal>

      <UserModal
        confirmLoading={creating}
        form={form}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onFinish={handleCreate}
        onOk={() => form.submit()}
        open={modalOpen}
        title="Add User"
      />

      <UserModal
        confirmLoading={updating}
        form={editForm}
        onCancel={() => {
          setEditModalOpen(false)
          setSelectedUser(null)
          editForm.resetFields()
        }}
        onFinish={handleEdit}
        onOk={() => editForm.submit()}
        open={editModalOpen}
        readOnlyEmployeeId
        title="Edit User"
      />

      <Modal
        confirmLoading={updating}
        okText="Update PIN"
        onCancel={() => {
          setPasswordModalOpen(false)
          setSelectedUser(null)
          setPasswordValidationError(null)
          passwordForm.resetFields()
        }}
        onOk={() => passwordForm.submit()}
        open={passwordModalOpen}
        title="Change Password"
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword} requiredMark={false}>
          <Form.Item label="New Password" name="new_pin" rules={[{ required: true, message: 'PIN is required' }, { pattern: /^\d{6}$/, message: 'PIN must be exactly 6 digits' }]}>
            <Input.Password className={passwordValidationError ? 'border-red-500' : undefined} maxLength={6} onChange={() => setPasswordValidationError(null)} placeholder="Enter New 6-Digit PIN" />
          </Form.Item>
          <Form.Item label="Confirm Password" name="confirm_pin" rules={[{ required: true, message: 'Confirm PIN is required' }]}>
            <Input.Password className={passwordValidationError ? 'border-red-500' : undefined} maxLength={6} onChange={() => setPasswordValidationError(null)} placeholder="Re-enter New 6-Digit PIN" />
          </Form.Item>
          {passwordValidationError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {passwordValidationError}
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        confirmLoading={updating}
        footer={null}
        onCancel={() => {
          setProjectModalOpen(false)
          setSelectedUser(null)
          setEditingAssignmentId(null)
          assignmentForm.resetFields()
        }}
        open={projectModalOpen}
        title={selectedUser ? `Manage Projects - ${selectedUser.employee_name}` : 'Manage Projects'}
        width={980}
      >
        {selectedUser && (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input addonBefore="Username" readOnly value={selectedUser.employee_name} />
              <Input addonBefore="User ID" readOnly value={selectedUser.employee_id} />
            </div>

            <Form form={assignmentForm} layout="vertical" onFinish={handleAssignmentSubmit} requiredMark={false}>
              <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
                <ProjectFields form={assignmentForm} projectOptions={projectOptions} projectOptionsLoading={projectOptionsLoading} />
                <Form.Item label="Role" name="responsibility" rules={[{ required: true, message: 'Role is required' }]}>
                  <Select loading={optionsLoading} optionFilterProp="label" options={roleSelectOptions} showSearch />
                </Form.Item>
                <Form.Item label="Valid From" name="valid_from">
                  <Input type="date" />
                </Form.Item>
                <Form.Item label="Valid To" name="valid_to">
                  <Input type="date" />
                </Form.Item>
              </div>
              <div className="mb-4 flex justify-end gap-2">
                {editingAssignmentId !== null && (
                  <Button onClick={() => {
                    setEditingAssignmentId(null)
                    assignmentForm.resetFields()
                  }}>
                    Cancel Edit
                  </Button>
                )}
                <Button htmlType="submit" loading={updating} type="primary">
                  {editingAssignmentId === null ? 'Add Project' : 'Update Project'}
                </Button>
              </div>
            </Form>

            {assignmentLoading ? (
              <div className="grid min-h-32 place-items-center"><Spin /></div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr>
                      <th className={TABLE_HEADER_CELL_CLASS}>Project</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>Project Description</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>Role</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>Valid From</th>
                      <th className={TABLE_HEADER_CELL_CLASS}>Valid To</th>
                      <th className={TABLE_HEADER_ACTIONS_CLASS}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {assignments.map((assignment) => (
                      <tr className="hover:bg-slate-50" key={assignment.id}>
                        <td className="px-5 py-3 font-mono font-semibold text-slate-800">{assignment.project_id}</td>
                        <td className="px-5 py-3 text-slate-700">{assignment.project_description}</td>
                        <td className="px-5 py-3 text-slate-700">{getRoleDisplay(assignment.responsibility)}</td>
                        <td className="px-5 py-3 text-slate-700">{formatDisplayDate(assignment.valid_from)}</td>
                        <td className="px-5 py-3 text-slate-700">{formatDisplayDate(assignment.valid_to)}</td>
                        <td className="px-5 py-3 text-center">
                          <Button icon={<Pencil size={16} />} onClick={() => handleEditAssignment(assignment)} type="text" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!assignments.length && <div className="px-5 py-8 text-center text-sm text-slate-500">No project assignments found.</div>}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        confirmLoading={importing}
        okText="Confirm & Import"
        onCancel={() => {
          setShowMappingModal(false)
          setImportFile(null)
          setDetectedHeaders([])
          setFieldsMapping(DEFAULT_FIELDS_MAPPING)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
        onOk={executeImport}
        open={showMappingModal}
        title="Configure User Project Assignment Import"
        width={760}
      >
        <p className="mb-4 text-sm text-slate-500">Select assignment spreadsheet columns to sync.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {detectedHeaders.map((header) => {
            const isRequired = REQUIRED_IMPORT_HEADERS.has(header)
            const isSupported = ASSIGNMENT_IMPORT_COLUMNS.includes(header)

            return (
              <label className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${isSupported ? 'border-slate-200' : 'border-slate-100 bg-slate-50 text-slate-400'}`} key={header}>
                <Checkbox checked={fieldsMapping[header] || false} disabled={isRequired} onChange={(event) => setFieldsMapping((currentMapping) => ({ ...currentMapping, [header]: event.target.checked }))} />
                <span className="font-medium text-slate-700">{isRequired ? `${header} (Required)` : header}</span>
              </label>
            )
          })}
        </div>
      </Modal>

      <Modal
        footer={[<Button key="close" onClick={() => setShowResultsModal(false)} type="primary">Acknowledge & Close</Button>]}
        onCancel={() => setShowResultsModal(false)}
        open={showResultsModal}
        title="Spreadsheet Sync Audit Report"
        width={760}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-green-700">New Appended</p>
            <p className="mt-1 text-2xl font-bold text-green-800">{syncResults?.insertedCount ?? 0}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-amber-700">Entries Modified</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{syncResults?.updatedCount ?? 0}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-600">Records Unchanged</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{syncResults?.unchangedCount ?? 0}</p>
          </div>
        </div>
      </Modal>
    </section>
  )
}

function normalizeUserPayload(values: UserFormValues) {
  return {
    employee_id: values.employee_id.trim(),
    employee_name: values.employee_name.trim(),
    email_id: values.email_id?.trim() ?? '',
    password_hash: values.password_hash?.trim() || '123456',
  }
}

function buildRoleSelectOptions(roleOptions: RoleOptions): SelectOption[] {
  const sourceRoles = roleOptions.roles?.length
    ? roleOptions.roles
    : roleOptions.responsibilities.map((responsibility) => ({ role_name: responsibility, responsibility }))
  const seenRoleNames = new Set<string>()

  return sourceRoles
    .map((role) => ({
      role_name: String(role.role_name || role.responsibility || '').trim(),
      responsibility: String(role.responsibility || role.role_name || '').trim(),
    }))
    .filter((role) => role.role_name)
    .filter((role) => {
      const key = role.role_name.toLowerCase()
      if (seenRoleNames.has(key)) {
        return false
      }
      seenRoleNames.add(key)
      return true
    })
    .map((role) => ({
      label: formatRoleOptionLabel(role),
      value: role.role_name,
    }))
}

function formatRoleOptionLabel(role: RoleOption) {
  return role.responsibility && role.responsibility !== role.role_name
    ? `${role.responsibility} (${role.role_name})`
    : role.role_name
}

function normalizeAssignmentPayload(values: AssignmentFormValues) {
  return {
    project_id: values.project_id.trim(),
    project_description: values.project_description.trim(),
    responsibility: values.responsibility.trim(),
    valid_from: values.valid_from || null,
    valid_to: values.valid_to || null,
  }
}

function formatDisplayDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-GB')
}

function UserModal({
  confirmLoading,
  form,
  onCancel,
  onFinish,
  onOk,
  open,
  readOnlyEmployeeId = false,
  title,
}: {
  confirmLoading: boolean
  form: ReturnType<typeof Form.useForm<UserFormValues>>[0]
  onCancel: () => void
  onFinish: (values: UserFormValues) => void
  onOk: () => void
  open: boolean
  readOnlyEmployeeId?: boolean
  title: string
}) {
  return (
    <Modal confirmLoading={confirmLoading} okText={title.startsWith('Edit') ? 'Save Changes' : 'Create'} onCancel={onCancel} onOk={onOk} open={open} title={title}>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item label="Employee ID" name="employee_id" rules={[{ required: true, message: 'Employee ID is required' }]}>
          <Input className="font-mono" disabled={readOnlyEmployeeId} />
        </Form.Item>
        <Form.Item label="Employee Name" name="employee_name" rules={[{ required: true, message: 'Employee Name is required' }]}>
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
        </Form.Item>
        <Form.Item label="Email ID" name="email_id" rules={[{ type: 'email', message: 'Enter a valid Email ID' }]}>
          <Input placeholder="Enter Email ID" />
        </Form.Item>
        <Form.Item label="PIN" name="password_hash" rules={[{ pattern: /^\d{6}$/, message: 'PIN must be exactly 6 digits' }]}>
          <Input maxLength={6} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function ProjectFields({
  form,
  projectOptions,
  projectOptionsLoading,
}: {
  form: ReturnType<typeof Form.useForm<AssignmentFormValues>>[0]
  projectOptions: ProjectOption[]
  projectOptionsLoading: boolean
}) {
  const projectCodeOptions = projectOptions.map((project) => ({
    label: project.description ? `${project.code} - ${project.description}` : project.code,
    value: project.code,
  }))
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

  return (
    <>
      <Form.Item label="Project" name="project_id" rules={[{ required: true, message: 'Project is required' }]}>
        <Select allowClear loading={projectOptionsLoading} onChange={handleProjectIdChange} optionFilterProp="label" options={projectCodeOptions} placeholder="Select Project" showSearch />
      </Form.Item>
      <Form.Item hidden name="project_description" rules={[{ required: true, message: 'Project Description is required' }]}>
        <Input />
      </Form.Item>
    </>
  )
}
