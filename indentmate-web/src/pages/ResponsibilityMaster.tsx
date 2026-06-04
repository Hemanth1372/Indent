import { Alert, Button, Checkbox, Dropdown, Form, Input, Modal, Select, Spin, message } from 'antd'
import { Download, Eye, EyeOff, KeyRound, MoreVertical, Pencil, Plus, ShieldCheck, ToggleLeft, ToggleRight, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const PAGE_SIZE = 100
const TABLE_HEADER_CELL_CLASS = 'bg-[#1b2e4b] px-5 py-[14px] text-[13px] font-semibold text-white tracking-[0.5px] normal-case border-b-2 border-[#0f1c30]'
const TABLE_HEADER_SELECTION_CLASS = 'bg-[#1b2e4b] px-4 py-[14px] text-center align-middle border-b-2 border-[#0f1c30] w-[52px]'
const TABLE_HEADER_ACTIONS_CLASS = `${TABLE_HEADER_CELL_CLASS} text-center w-20`;

type ResponsibilityRow = {
  id: number
  employee_id: string
  employee_name: string
  project_id: string
  project_description: string
  responsibility: string
  valid_from: string | null
  valid_to: string | null
  manual_status: 'Active' | 'Inactive'
  password_hash: string
  status: 'Active' | 'Inactive'
}

type ResponsibilityFormValues = {
  employee_id: string
  employee_name: string
  project_id: string
  project_description: string
  responsibility: string
  valid_from?: string
  valid_to?: string
  password_hash?: string
}

type ResponsibilityOptions = {
  responsibilities: string[]
}

type ProjectOption = {
  code: string
  description: string
}

type ResponsibilityListResponse = {
  data: ResponsibilityRow[]
  metadata: {
    totalRecords: number
    totalPages: number
    currentPage: number
    limit: number
  }
}

const searchFields = [
  { label: 'Employee ID', value: 'employee_id', placeholder: 'Enter Employee ID (e.g. CS0236)...' },
  { label: 'Employee Name', value: 'employee_name', placeholder: 'Enter Employee Name...' },
  { label: 'Project ID', value: 'project_id', placeholder: 'Enter Project ID (e.g. EODBHS001)...' },
  { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
  { label: 'Responsibility / Role', value: 'responsibility', placeholder: 'Enter Responsibility / Role...' },
]

const RESPONSIBILITY_IMPORT_COLUMNS = [
  'Employee ID',
  'Employee Name',
  'Project ID',
  'Project Description',
  'Responsibility',
  'Valid From',
  'Valid To',
]

const REQUIRED_IMPORT_HEADERS = new Set(['Employee ID', 'Employee Name', 'Project ID', 'Project Description', 'Responsibility'])

const DEFAULT_RESPONSIBILITY_FIELDS_MAPPING = Object.fromEntries(
  RESPONSIBILITY_IMPORT_COLUMNS.map((column) => [column, true]),
)

type SyncSummary = {
  insertedCount: number
  updatedCount: number
  unchangedCount: number
  updatedRecordsLog: string[]
}

function pinText(value: string, visible: boolean) {
  return visible ? value : '••••••'
}

function maskedPinText(value: string, visible: boolean) {
  return visible ? pinText(value, true) : '\u2022\u2022\u2022\u2022\u2022\u2022'
}

export default function ResponsibilityMaster() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form] = Form.useForm<ResponsibilityFormValues>()
  const [editForm] = Form.useForm<ResponsibilityFormValues>()
  const [passwordForm] = Form.useForm<{ new_pin: string; confirm_pin: string }>()
  const [roleForm] = Form.useForm<{ responsibility: string }>()
  const { user: currentUser } = useAuth()
  const [responsibilities, setResponsibilities] = useState<ResponsibilityRow[]>([])
  const [options, setOptions] = useState<ResponsibilityOptions>({ responsibilities: [] })
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [visiblePins, setVisiblePins] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [searchField, setSearchField] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [passwordValidationError, setPasswordValidationError] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [fieldsMapping, setFieldsMapping] = useState<Record<string, boolean>>(DEFAULT_RESPONSIBILITY_FIELDS_MAPPING)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncSummary | null>(null)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set())
  const visibleRowKeys = useMemo(
    () => responsibilities.map((responsibility) => String(responsibility.id)),
    [responsibilities],
  )
  const selectedVisibleCount = useMemo(
    () => visibleRowKeys.filter((rowKey) => selectedRowKeys.has(rowKey)).length,
    [selectedRowKeys, visibleRowKeys],
  )
  const allVisibleRowsSelected = visibleRowKeys.length > 0 && selectedVisibleCount === visibleRowKeys.length
  const someVisibleRowsSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleRowKeys.length

  function clearSelectionBuffer() {
    setSelectedRowKeys(new Set())
  }

  function handleSelectRowToggle(rowKey: string) {
    setSelectedRowKeys((currentSelection) => {
      const updatedSelection = new Set(currentSelection)

      if (updatedSelection.has(rowKey)) {
        updatedSelection.delete(rowKey)
      } else {
        updatedSelection.add(rowKey)
      }

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

  async function loadResponsibilities(params?: { page?: number; field?: string; value?: string }) {
    setLoading(true)
    setError(null)

    try {
      const requestParams = {
        page: params?.page ?? currentPage,
        limit: PAGE_SIZE,
        ...(params?.field && params?.value ? { field: params.field, value: params.value } : {}),
      }
      const { data } = await api.get<ResponsibilityListResponse>('/api/responsibilities', {
        params: requestParams,
      })
      setResponsibilities(data.data)
      setCurrentPage(data.metadata.currentPage)
      setTotalPages(data.metadata.totalPages)
      setTotalRecords(data.metadata.totalRecords)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load Responsibility Master data. Check that the backend is running and you are logged in.')
    } finally {
      setLoading(false)
    }
  }

  async function loadOptions() {
    setOptionsLoading(true)

    try {
      const { data } = await api.get<ResponsibilityOptions>('/api/responsibilities/options')
      setOptions(data)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load responsibility options')
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

  useEffect(() => {
    loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
      ? { page: currentPage, field: searchField, value: searchQuery.trim() }
      : { page: currentPage })
  }, [currentPage])

  async function openCreateModal() {
    form.setFieldsValue({ password_hash: '123456' })
    setModalOpen(true)

    if (!options.responsibilities.length) {
      await loadOptions()
    }

    if (!projectOptions.length) {
      await loadProjectOptions()
    }
  }

  async function handleCreate(values: ResponsibilityFormValues) {
    setCreating(true)

    try {
      await api.post<{ data: ResponsibilityRow }>('/api/responsibilities', normalizePayload(values))

      form.resetFields()
      setModalOpen(false)
      setCurrentPage(1)
      await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
        ? { page: 1, field: searchField, value: searchQuery.trim() }
        : { page: 1 })
      await loadOptions()
      message.success('Responsibility Master record created successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create Responsibility Master record')
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(values: ResponsibilityFormValues) {
    if (selectedId === null) {
      return
    }

    setUpdating(true)

    try {
      await api.put<{ data: ResponsibilityRow }>(`/api/responsibilities/${selectedId}`, normalizePayload(values))
      setOpenActionId(null)
      setEditModalOpen(false)
      setSelectedId(null)
      editForm.resetFields()
      await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
        ? { page: currentPage, field: searchField, value: searchQuery.trim() }
        : { page: currentPage })
      await loadOptions()
      message.success('Responsibility Master record updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update Responsibility Master record')
    } finally {
      setUpdating(false)
    }
  }

  async function handleToggleStatus(row: ResponsibilityRow) {
    const nextStatus = row.status === 'Active' ? 'Inactive' : 'Active'

    try {
      setOpenActionId(null)
      const { data } = await api.patch<{ data: ResponsibilityRow; users?: ResponsibilityRow[] }>(`/api/responsibilities/${row.id}/toggle-status`, {
        manual_status: nextStatus,
      })
      const updatedRows = data.users ?? [data.data]
      setResponsibilities((currentRows) =>
        currentRows.map((currentRow) => {
          if (currentRow.employee_id !== row.employee_id) {
            return currentRow
          }

          return updatedRows.find((updatedRow) => updatedRow.id === currentRow.id) ?? {
            ...currentRow,
            manual_status: nextStatus,
            status: nextStatus,
          }
        }),
      )
      message.success(nextStatus === 'Active' ? 'User activated successfully' : 'User deactivated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update user status')
    }
  }

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim()

    if (!searchField || !trimmedQuery) {
      message.warning('Select a filter field and enter a search value.')
      return
    }

    setIsFilterActive(true)
    setCurrentPage(1)
    clearSelectionBuffer()
    await loadResponsibilities({ page: 1, field: searchField, value: trimmedQuery })
  }

  async function handleClearSearch() {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    clearSelectionBuffer()
    await loadResponsibilities({ page: 1 })
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

        const workbook = XLSX.read(new Uint8Array(result as ArrayBuffer), {
          type: 'array',
          sheetRows: 1,
        })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null
        const headerRows = firstSheet
          ? XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' })
          : []
        const headers = (headerRows[0] ?? [])
          .map((header) => String(header ?? '').trim())
          .filter(Boolean)
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
      } catch (error) {
        console.error(error)
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
      await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
        ? { page: 1, field: searchField, value: searchQuery.trim() }
        : { page: 1 })
      await loadOptions()
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to import Responsibility Master file')
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
        : isFilterActive && searchField && searchQuery.trim()
          ? { field: searchField, value: searchQuery.trim() }
          : undefined
      const { data } = await api.get<Blob>('/api/responsibilities/export', {
        params: exportParams,
        responseType: 'blob',
      })
      const downloadUrl = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'Responsibility_Master_Export.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      clearSelectionBuffer()
      message.success(selectedKeys.length > 0
        ? `${selectedKeys.length} selected responsibility record${selectedKeys.length === 1 ? '' : 's'} exported`
        : 'Responsibility Master export started')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to export Responsibility Master data')
    } finally {
      setExporting(false)
    }
  }

  async function openEditModal(row: ResponsibilityRow) {
    setOpenActionId(null)
    setSelectedId(row.id)
    editForm.setFieldsValue({
      employee_id: row.employee_id,
      employee_name: row.employee_name,
      project_id: row.project_id,
      project_description: row.project_description,
      responsibility: row.responsibility,
      valid_from: row.valid_from ?? '',
      valid_to: row.valid_to ?? '',
      password_hash: row.password_hash,
    })
    setEditModalOpen(true)

    if (!options.responsibilities.length) {
      await loadOptions()
    }

    if (!projectOptions.length) {
      await loadProjectOptions()
    }
  }

  async function openPasswordModal(row: ResponsibilityRow) {
    setOpenActionId(null)
    setSelectedId(row.id)
    passwordForm.resetFields()
    setPasswordValidationError(null)
    setPasswordModalOpen(true)
  }

  async function openRoleModal(row: ResponsibilityRow) {
    setOpenActionId(null)
    setSelectedId(row.id)
    roleForm.setFieldsValue({ responsibility: row.responsibility })
    setRoleModalOpen(true)

    if (!options.responsibilities.length) {
      await loadOptions()
    }
  }

  async function handleChangePassword(values: { new_pin: string; confirm_pin: string }) {
    if (selectedId === null) {
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

    setPasswordValidationError(null)
    setUpdating(true)

    try {
      await api.patch(`/api/responsibilities/${selectedId}/change-password`, {
        password_hash: values.new_pin,
      })
      setOpenActionId(null)
      setPasswordModalOpen(false)
      setSelectedId(null)
      passwordForm.resetFields()
      await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
        ? { page: currentPage, field: searchField, value: searchQuery.trim() }
        : { page: currentPage })
      message.success('PIN updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      setPasswordValidationError(requestError.response?.data?.message ?? 'Backend Error: Failed to commit password modification.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleChangeRole(values: { responsibility: string }) {
    if (selectedId === null) {
      return
    }

    setUpdating(true)

    try {
      await api.patch(`/api/responsibilities/${selectedId}/change-role`, {
        responsibility: values.responsibility,
      })
      setOpenActionId(null)
      setRoleModalOpen(false)
      setSelectedId(null)
      roleForm.resetFields()
      await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
        ? { page: currentPage, field: searchField, value: searchQuery.trim() }
        : { page: currentPage })
      await loadOptions()
      message.success('Role updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update role')
    } finally {
      setUpdating(false)
    }
  }

  function handleDelete(row: ResponsibilityRow) {
    setOpenActionId(null)
    Modal.confirm({
      title: 'Delete User Record',
      content: 'Are you sure you want to permanently delete this employee account? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      async onOk() {
        await api.delete(`/api/responsibilities/${row.id}`)
        await loadResponsibilities(isFilterActive && searchField && searchQuery.trim()
          ? { page: currentPage, field: searchField, value: searchQuery.trim() }
          : { page: currentPage })
        message.success('User record deleted successfully')
      },
    })
  }

  function togglePinVisibility(employeeId: string) {
    setVisiblePins((currentPins) => {
      const nextPins = new Set(currentPins)

      if (nextPins.has(employeeId)) {
        nextPins.delete(employeeId)
      } else {
        nextPins.add(employeeId)
      }

      return nextPins
    })
  }

  const showingStart = totalRecords === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
  const showingEnd = Math.min(currentPage * PAGE_SIZE, totalRecords)
  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.primary_role === 'Super Admin'

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Responsibility Master
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Manage workforce credentials, project allocations, and corporate
            roles
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-[15px]">
          <Select
            allowClear
            className="min-w-[220px]"
            onChange={(value) => {
              setSearchField(value ?? "");
              setSearchQuery("");
            }}
            options={searchFields.map((field) => ({
              label: field.label,
              value: field.value,
            }))}
            placeholder="Select Field"
            value={searchField || undefined}
          />
          <Input
            className="max-w-[360px]"
            disabled={!searchField}
            onChange={(event) => setSearchQuery(event.target.value)}
            onPressEnter={handleSearch}
            placeholder={
              searchFields.find((field) => field.value === searchField)
                ?.placeholder ?? "Select a field first..."
            }
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
            {totalRecords} Records
          </span>
          {selectedRowKeys.size > 0 && (
            <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {selectedRowKeys.size} row{selectedRowKeys.size === 1 ? "" : "s"}{" "}
              selected
            </span>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFileSelect}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={!isSuperAdmin || importing}
              icon={<Upload size={16} />}
              loading={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </Button>
            <Button
              disabled={!isSuperAdmin || exporting}
              icon={<Download size={16} />}
              loading={exporting}
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              icon={<Plus size={16} />}
              onClick={openCreateModal}
              type="primary"
            >
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
          <Spin
            tip={importing ? "Importing Responsibility Master..." : undefined}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr>
                  <th className={TABLE_HEADER_SELECTION_CLASS}>
                    <Checkbox
                      checked={allVisibleRowsSelected}
                      disabled={!responsibilities.length}
                      indeterminate={someVisibleRowsSelected}
                      onChange={handleSelectAllVisibleToggle}
                    />
                  </th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Employee Id</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Employee Name</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Project Id</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Project Desc</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Responsibility</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Valid From</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Valid To</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Pin</th>
                  <th className={TABLE_HEADER_CELL_CLASS}>Status</th>
                  <th className={TABLE_HEADER_ACTIONS_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {responsibilities.map((responsibility) => {
                  const pinVisible = visiblePins.has(
                    responsibility.employee_id,
                  );
                  const rowSelectionKey = String(responsibility.id);
                  const isRowSelected = selectedRowKeys.has(rowSelectionKey);

                  return (
                    <tr
                      className={`${isRowSelected ? "bg-blue-50" : "hover:bg-slate-50"} transition-colors`}
                      key={responsibility.id}
                    >
                      <td className="px-4 py-4 text-center align-middle">
                        <Checkbox
                          checked={isRowSelected}
                          onChange={() =>
                            handleSelectRowToggle(rowSelectionKey)
                          }
                        />
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                        {responsibility.employee_id}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {responsibility.employee_name}
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                        {responsibility.project_id}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {responsibility.project_description}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {responsibility.responsibility}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDisplayDate(responsibility.valid_from)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDisplayDate(responsibility.valid_to)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="min-w-[94px] font-mono text-base tracking-[2px] text-slate-800">
                            {maskedPinText(
                              responsibility.password_hash,
                              pinVisible,
                            )}
                          </span>
                          <button
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            onClick={() =>
                              togglePinVisibility(responsibility.employee_id)
                            }
                            title={pinVisible ? "Hide PIN" : "Show PIN"}
                            type="button"
                          >
                            {pinVisible ? (
                              <Eye size={16} />
                            ) : (
                              <EyeOff size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                            responsibility.status === "Active"
                              ? "bg-green-600"
                              : "bg-red-600"
                          }`}
                        >
                          {responsibility.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdmin ? (
                            <Dropdown
                              dropdownRender={() => (
                                <div className="w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                  <button
                                    className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50"
                                    onClick={() =>
                                      openEditModal(responsibility)
                                    }
                                    type="button"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600">
                                      <Pencil size={18} />
                                    </span>
                                    <span className="text-sm font-medium">
                                      Edit User
                                    </span>
                                  </button>
                                  <button
                                    className="mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50"
                                    onClick={() =>
                                      openPasswordModal(responsibility)
                                    }
                                    type="button"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500">
                                      <KeyRound size={18} />
                                    </span>
                                    <span className="text-sm font-medium">
                                      Change PIN
                                    </span>
                                  </button>
                                  <button
                                    className="mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-slate-800 transition hover:bg-slate-50"
                                    onClick={() =>
                                      openRoleModal(responsibility)
                                    }
                                    type="button"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500">
                                      <ShieldCheck size={18} />
                                    </span>
                                    <span className="text-sm font-medium">
                                      Change Responsibility
                                    </span>
                                  </button>
                                  <button
                                    className={`mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left transition ${
                                      responsibility.status === "Active"
                                        ? "text-red-600 hover:bg-red-50"
                                        : "text-blue-600 hover:bg-blue-50"
                                    }`}
                                    onClick={() =>
                                      handleToggleStatus(responsibility)
                                    }
                                    type="button"
                                  >
                                    <span
                                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                        responsibility.status === "Active"
                                          ? "bg-red-50 text-red-500"
                                          : "bg-blue-50 text-blue-500"
                                      }`}
                                    >
                                      {responsibility.status === "Active" ? (
                                        <ToggleRight size={19} />
                                      ) : (
                                        <ToggleLeft size={19} />
                                      )}
                                    </span>
                                    <span className="text-sm font-medium">
                                      {responsibility.status === "Active"
                                        ? "Deactivate User"
                                        : "Activate User"}
                                    </span>
                                  </button>
                                  <button
                                    className="mt-1 flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-red-600 transition hover:bg-red-50"
                                    onClick={() => handleDelete(responsibility)}
                                    type="button"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-500">
                                      <Trash2 size={18} />
                                    </span>
                                    <span className="text-sm font-medium">
                                      Delete Record
                                    </span>
                                  </button>
                                </div>
                              )}
                              onOpenChange={(open) =>
                                setOpenActionId(open ? responsibility.id : null)
                              }
                              open={openActionId === responsibility.id}
                              placement="bottomRight"
                              trigger={["click"]}
                            >
                              <button
                                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                title="Responsibility actions"
                                type="button"
                              >
                                <MoreVertical size={20} />
                              </button>
                            </Dropdown>
                          ) : (
                            <span className="text-sm font-semibold text-slate-400">
                              No Access
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!responsibilities.length && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No responsibilities found.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>
              Showing records {showingStart}-{showingEnd} of {totalRecords}
            </span>
            <div className="flex items-center gap-3">
              <Button
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="min-w-[110px] text-center font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                disabled={currentPage === totalPages || loading}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ResponsibilityModal
        confirmLoading={creating}
        form={form}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onFinish={handleCreate}
        onOk={() => form.submit()}
        open={modalOpen}
        options={options}
        optionsLoading={optionsLoading}
        projectOptions={projectOptions}
        projectOptionsLoading={projectOptionsLoading}
        title="Add Responsibility Master"
      />

      <Modal
        confirmLoading={importing}
        okText="Confirm & Import"
        onCancel={() => {
          setShowMappingModal(false);
          setImportFile(null);
          setDetectedHeaders([]);
          setFieldsMapping(DEFAULT_RESPONSIBILITY_FIELDS_MAPPING);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        onOk={executeImport}
        open={showMappingModal}
        title="Configure Responsibility Import"
        width={760}
      >
        <p className="mb-4 text-sm text-slate-500">
          Unchecked optional fields are excluded from the sync. Required
          identity fields stay locked.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {detectedHeaders.map((header) => {
            const isRequired = REQUIRED_IMPORT_HEADERS.has(header);
            const isSupported = RESPONSIBILITY_IMPORT_COLUMNS.includes(header);

            return (
              <label
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  isSupported
                    ? "border-slate-200"
                    : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
                key={header}
              >
                <Checkbox
                  checked={fieldsMapping[header] || false}
                  disabled={isRequired}
                  onChange={(event) =>
                    setFieldsMapping((currentMapping) => ({
                      ...currentMapping,
                      [header]: event.target.checked,
                    }))
                  }
                />
                <span className="font-medium text-slate-700">
                  {isRequired ? `${header} (Required)` : header}
                </span>
              </label>
            );
          })}
        </div>
      </Modal>

      <Modal
        footer={[
          <Button
            key="close"
            onClick={() => setShowResultsModal(false)}
            type="primary"
          >
            Acknowledge & Close
          </Button>,
        ]}
        onCancel={() => setShowResultsModal(false)}
        open={showResultsModal}
        title="Spreadsheet Sync Audit Report"
        width={760}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-green-700">
              New Appended
            </p>
            <p className="mt-1 text-2xl font-bold text-green-800">
              {syncResults?.insertedCount ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-amber-700">
              Entries Modified
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">
              {syncResults?.updatedCount ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-600">
              Records Unchanged
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {syncResults?.unchangedCount ?? 0}
            </p>
          </div>
        </div>

        {Boolean(syncResults?.updatedRecordsLog?.length) && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Modified Employee Log
            </p>
            <div className="flex flex-wrap gap-2">
              {syncResults?.updatedRecordsLog.map((employeeId) => (
                <span
                  className="rounded-md bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700"
                  key={employeeId}
                >
                  {employeeId}
                </span>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ResponsibilityModal
        confirmLoading={updating}
        form={editForm}
        onCancel={() => {
          setEditModalOpen(false);
          setSelectedId(null);
          editForm.resetFields();
        }}
        onFinish={handleEdit}
        onOk={() => editForm.submit()}
        open={editModalOpen}
        options={options}
        optionsLoading={optionsLoading}
        projectOptions={projectOptions}
        projectOptionsLoading={projectOptionsLoading}
        readOnlyEmployeeId
        title="Edit Responsibility Master"
      />

      <Modal
        confirmLoading={updating}
        okText="Update PIN"
        onCancel={() => {
          setPasswordModalOpen(false);
          setSelectedId(null);
          setPasswordValidationError(null);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
        open={passwordModalOpen}
        title="Change Password"
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          requiredMark={false}
        >
          <Form.Item
            label="New Password"
            name="new_pin"
            rules={[
              { required: true, message: "PIN is required" },
              { pattern: /^\d{6}$/, message: "PIN must be exactly 6 digits" },
            ]}
          >
            <Input.Password
              className={passwordValidationError ? "border-red-500" : undefined}
              maxLength={6}
              onChange={() => setPasswordValidationError(null)}
              placeholder="Enter New 6-Digit PIN"
            />
          </Form.Item>
          <Form.Item
            label="Confirm Password"
            name="confirm_pin"
            rules={[{ required: true, message: "Confirm PIN is required" }]}
          >
            <Input.Password
              className={passwordValidationError ? "border-red-500" : undefined}
              maxLength={6}
              onChange={() => setPasswordValidationError(null)}
              placeholder="Re-enter New 6-Digit PIN"
            />
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
        okText="Save Changes"
        onCancel={() => {
          setRoleModalOpen(false);
          setSelectedId(null);
          roleForm.resetFields();
        }}
        onOk={() => roleForm.submit()}
        open={roleModalOpen}
        title="Change Role"
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={handleChangeRole}
          requiredMark={false}
        >
          <Form.Item
            label="Responsibility"
            name="responsibility"
            rules={[{ required: true, message: "Responsibility is required" }]}
          >
            <Select
              loading={optionsLoading}
              optionFilterProp="label"
              options={options.responsibilities.map((responsibility) => ({
                label: responsibility,
                value: responsibility,
              }))}
              showSearch
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

function normalizePayload(values: ResponsibilityFormValues) {
  return {
    employee_id: values.employee_id.trim(),
    employee_name: values.employee_name.trim(),
    project_id: values.project_id.trim(),
    project_description: values.project_description.trim(),
    responsibility: values.responsibility.trim(),
    valid_from: values.valid_from || null,
    valid_to: values.valid_to || null,
    password_hash: values.password_hash?.trim() || '123456',
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

function ResponsibilityModal({
  confirmLoading,
  form,
  onCancel,
  onFinish,
  onOk,
  open,
  options,
  optionsLoading,
  projectOptions,
  projectOptionsLoading,
  readOnlyEmployeeId = false,
  title,
}: {
  confirmLoading: boolean
  form: ReturnType<typeof Form.useForm<ResponsibilityFormValues>>[0]
  onCancel: () => void
  onFinish: (values: ResponsibilityFormValues) => void
  onOk: () => void
  open: boolean
  options: ResponsibilityOptions
  optionsLoading: boolean
  projectOptions: ProjectOption[]
  projectOptionsLoading: boolean
  readOnlyEmployeeId?: boolean
  title: string
}) {
  const projectCodeOptions = projectOptions.map((project) => ({
    label: project.description ? `${project.code} - ${project.description}` : project.code,
    value: project.code,
  }))
  const projectDescriptionOptions = projectOptions.map((project) => ({
    label: project.code ? `${project.description} - ${project.code}` : project.description,
    value: project.description,
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

  return (
    <Modal
      confirmLoading={confirmLoading}
      okText={title.startsWith('Edit') ? 'Save Changes' : 'Create'}
      onCancel={onCancel}
      onOk={onOk}
      open={open}
      title={title}
      width={760}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Employee ID"
            name="employee_id"
            rules={[{ required: true, message: 'Employee ID is required' }]}
          >
            <Input className="font-mono" disabled={readOnlyEmployeeId} />
          </Form.Item>

          <Form.Item
            label="Employee Name"
            name="employee_name"
            rules={[{ required: true, message: 'Employee Name is required' }]}
          >
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
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
              options={projectCodeOptions}
              placeholder="Select Project ID"
              showSearch
            />
          </Form.Item>

          <Form.Item
            label="Project Description"
            name="project_description"
            rules={[{ required: true, message: 'Project Description is required' }]}
          >
            <Select
              allowClear
              loading={projectOptionsLoading}
              onChange={handleProjectDescriptionChange}
              optionFilterProp="label"
              options={projectDescriptionOptions}
              placeholder="Select Project Description"
              showSearch
            />
          </Form.Item>

          <Form.Item
            label="Responsibility"
            name="responsibility"
            rules={[{ required: true, message: 'Responsibility is required' }]}
          >
            <Select
              loading={optionsLoading}
              optionFilterProp="label"
              options={options.responsibilities.map((responsibility) => ({
                label: responsibility,
                value: responsibility,
              }))}
              showSearch
            />
          </Form.Item>

          <Form.Item
            label="PIN"
            name="password_hash"
            rules={[{ pattern: /^\d{6}$/, message: 'PIN must be exactly 6 digits' }]}
          >
            <Input maxLength={6} />
          </Form.Item>

          <Form.Item label="Valid From" name="valid_from">
            <Input type="date" />
          </Form.Item>

          <Form.Item label="Valid To" name="valid_to">
            <Input type="date" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
