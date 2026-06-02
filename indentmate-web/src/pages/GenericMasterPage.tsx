import { Alert, Button, Dropdown, Form, Input, Modal, Select, Spin, Switch, message } from 'antd'
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api'

const PAGE_SIZE = 100

type FieldType = 'text' | 'textarea' | 'boolean' | 'checkboxText' | 'datetime' | 'number'

type MasterField = {
  key: string
  label: string
  required?: boolean
  type?: FieldType
  options?: Array<{ label: string; value: string }>
}

type MasterConfig = {
  title: string
  subtitle: string
  countLabel: string
  addButtonLabel?: string
  addModalTitle?: string
  editModalTitle?: string
  fields: MasterField[]
  columns: MasterField[]
  searchFields?: Array<{ label: string; value: string; placeholder: string }>
}

const masterConfigs: Record<string, MasterConfig> = {
  'project-master': {
    title: 'Project Master',
    subtitle: 'Enterprise project catalogs, engineering controls, and coordination flags',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'dpr_engineer_control', label: 'DPR Engineer Control', required: true },
      { key: 'multi_location_activity', label: 'Multi Location Activity', required: true },
      { key: 'project_location_linked_activities', label: 'Project Location Linked to Activities', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'dpr_engineer_control', label: 'DPR Engineer Control' },
      { key: 'multi_location_activity', label: 'Multi Location Act.' },
      { key: 'project_location_linked_activities', label: 'Loc. Linked To Act.' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'DPR Engineer Control', value: 'dpr_engineer_control', placeholder: 'Enter DPR Engineer Control (LOCATION or ACTIVITY)...' },
      { label: 'Multi Location Activity', value: 'multi_location_activity', placeholder: 'Enter Multi Location Activity (YES or NO)...' },
      { label: 'Location Linked to Activities', value: 'project_location_linked_activities', placeholder: 'Enter Linked to Activities (YES or NO)...' },
    ],
  },
  'activity-master': {
    title: 'Activity Master',
    subtitle: 'Enterprise task schedules, critical dependencies, and resource tracking',
    countLabel: 'Records',
    fields: [
      { key: 'activity_code', label: 'Activity Code', required: true },
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'description', label: 'Description', required: true, type: 'textarea' },
      { key: 'activity_type', label: 'Activity Type', required: true },
      { key: 'critical_capacity_type', label: 'Critical Capacity Type', required: true },
      { key: 'work_auth_status', label: 'Work Auth Status', required: true },
      { key: 'resource_required', label: 'Resource Required', required: true },
      { key: 'scheduled_start_date', label: 'Scheduled Start Date', type: 'datetime' },
      { key: 'scheduled_finish_date', label: 'Scheduled Finish Date', type: 'datetime' },
    ],
    columns: [
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'project_code', label: 'Project Code' },
      { key: 'description', label: 'Description' },
      { key: 'activity_type', label: 'Activity Type' },
      { key: 'critical_capacity_type', label: 'Critical Capacity' },
      { key: 'work_auth_status', label: 'Auth Status' },
      { key: 'resource_required', label: 'Resource Req.' },
      { key: 'scheduled_start_date', label: 'Start Date', type: 'datetime' },
      { key: 'scheduled_finish_date', label: 'Finish Date', type: 'datetime' },
    ],
    searchFields: [
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
      { label: 'Activity Type', value: 'activity_type', placeholder: 'Enter Activity Type (e.g. Work Package)...' },
      { label: 'Critical Capacity Type', value: 'critical_capacity_type', placeholder: 'Enter Critical Capacity Type...' },
      { label: 'Work Auth Status', value: 'work_auth_status', placeholder: 'Enter Work Auth Status...' },
      { label: 'Resource Required', value: 'resource_required', placeholder: 'Enter Resource Required (Yes or No)...' },
    ],
  },
  'location-master': {
    title: 'Location Master',
    subtitle: 'Enterprise site locations and project assignment metadata',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_name', label: 'Project Name', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'description', label: 'Description', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_name', label: 'Project Name' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'description', label: 'Description' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Name', value: 'project_name', placeholder: 'Enter Project Name...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. CB)...' },
      { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
    ],
  },
  'item-master': {
    title: 'Item Master',
    subtitle: 'Enterprise inventory ledger, material catalogs, and stock counts per site',
    countLabel: 'Records',
    fields: [
      { key: 'project_site', label: 'Site Code', required: true },
      { key: 'site_description', label: 'Site Description', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_description', label: 'Item Description', required: true, type: 'textarea' },
      { key: 'purchase_unit', label: 'Purchase Unit (UOM)', required: true },
      { key: 'item_type', label: 'Item Type', required: true },
    ],
    columns: [
      { key: 'project_site', label: 'Site' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Desc' },
      { key: 'on_hand_qty', label: 'On Hand Qty', type: 'number' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_description', label: 'Item Description' },
      { key: 'purchase_unit', label: 'UOM' },
      { key: 'item_type', label: 'Item Type' },
    ],
    searchFields: [
      { label: 'Site Code', value: 'project_site', placeholder: 'Enter Site Code (e.g. EODBHS001)...' },
      { label: 'Site Description', value: 'site_description', placeholder: 'Enter Site Description...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80039)...' },
      { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code (e.g. 1113131)...' },
      { label: 'Item Description', value: 'item_description', placeholder: 'Enter Item Description...' },
      { label: 'Item Type', value: 'item_type', placeholder: 'Enter Item Type (e.g. Product)...' },
    ],
  },
  'business-partner-master': {
    title: 'Business Partner Activity Master',
    subtitle: 'Relational matrix linking projects, location boundaries, and subcontractors',
    countLabel: 'Records',
    addButtonLabel: 'Assign BP Act',
    addModalTitle: 'Add Business Partner Assignment',
    editModalTitle: 'Edit Business Partner Assignment',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'business_partner_code', label: 'Business Partner Code', required: true },
      { key: 'business_partner_name', label: 'Business Partner Name', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'location_code', label: 'Location Code' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity Code' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'business_partner_code', label: 'Partner Code' },
      { key: 'business_partner_name', label: 'Business Partner Name' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. WMHEDS002)...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. AR1005)...' },
      { label: 'Location Description', value: 'location_description', placeholder: 'Enter Location Description...' },
      { label: 'Activity Code', value: 'activity_code', placeholder: 'Enter Activity Code...' },
      { label: 'Business Partner Code', value: 'business_partner_code', placeholder: 'Enter Partner Code (e.g. SC0000965)...' },
      { label: 'Business Partner Name', value: 'business_partner_name', placeholder: 'Enter Business Partner Name...' },
    ],
  },
  'warehouse-master': {
    title: 'Warehouse Master',
    subtitle: 'Corporate storage facilities, material yards, and virtual site boundaries',
    countLabel: 'Records',
    fields: [
      { key: 'warehouse_code', label: 'Warehouse Code', required: true },
      { key: 'warehouse_description', label: 'Warehouse Description', required: true },
      { key: 'project_site', label: 'Site Code', required: true },
      { key: 'site_description', label: 'Site Description', required: true },
      { key: 'is_material_warehouse', label: 'Material Warehouse', required: true, type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', required: true, type: 'checkboxText' },
    ],
    columns: [
      { key: 'warehouse_code', label: 'Warehouse Code' },
      { key: 'warehouse_description', label: 'Warehouse Description' },
      { key: 'project_site', label: 'Site Code' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'is_material_warehouse', label: 'Material Warehouse', type: 'checkboxText' },
      { key: 'is_virtual_warehouse', label: 'Virtual Warehouse', type: 'checkboxText' },
    ],
    searchFields: [
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. B80002)...' },
      { label: 'Warehouse Description', value: 'warehouse_description', placeholder: 'Enter Warehouse Description...' },
      { label: 'Site Code', value: 'project_site', placeholder: 'Enter Site Code (e.g. NHRBGB001)...' },
      { label: 'Site Description', value: 'site_description', placeholder: 'Enter Site Description...' },
    ],
  },
  'warehouse-bin-master': {
    title: 'Warehouse Location Master',
    subtitle: 'Granular storage bins, physical sub-locations, and sub-contractor yards',
    countLabel: 'Records',
    fields: [
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'warehouse_code', label: 'Warehouse Code', required: true },
      { key: 'warehouse_name', label: 'Warehouse Name', required: true },
      { key: 'location_code', label: 'Location Code', required: true },
      { key: 'location_description', label: 'Location Description', required: true, type: 'textarea' },
      {
        key: 'location_category',
        label: 'Location Category',
        required: true,
        options: [
          { label: 'Storage', value: 'Storage' },
          { label: 'Consumption', value: 'Consumption' },
          { label: 'Subcon/Prw', value: 'Subcon/Prw' },
          { label: 'Employee', value: 'Employee' },
        ],
      },
    ],
    columns: [
      { key: 'project_code', label: 'Project Code' },
      { key: 'warehouse_code', label: 'WH Code' },
      { key: 'warehouse_name', label: 'WH Name' },
      { key: 'location_code', label: 'Loc Code' },
      { key: 'location_description', label: 'Loc Description' },
      { key: 'location_category', label: 'Category' },
    ],
    searchFields: [
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NUPEDS014)...' },
      { label: 'Warehouse Code', value: 'warehouse_code', placeholder: 'Enter Warehouse Code (e.g. E8V001)...' },
      { label: 'Warehouse Name', value: 'warehouse_name', placeholder: 'Enter Warehouse Name...' },
      { label: 'Location Code', value: 'location_code', placeholder: 'Enter Location Code (e.g. SC0000101)...' },
      { label: 'Location Category', value: 'location_category', placeholder: 'Enter Location Category (Storage, Consumption, Subcon/Prw, Employee)...' },
    ],
  },
  'delivery-point-master': {
    title: 'Delivery Master',
    subtitle: 'Enterprise site delivery points, logistics coordinates, and project addresses',
    countLabel: 'Records',
    fields: [
      { key: 'address_code', label: 'Address Code', required: true },
      { key: 'address_description', label: 'Address Description', required: true, type: 'textarea' },
      { key: 'project_code', label: 'Project Code', required: true },
      { key: 'project_description', label: 'Project Description', required: true },
      { key: 'delivery_point', label: 'Delivery Point', required: true },
      { key: 'description_1', label: 'Description I', type: 'textarea' },
    ],
    columns: [
      { key: 'address_code', label: 'Address Code' },
      { key: 'address_description', label: 'Address Description' },
      { key: 'project_code', label: 'Project Code' },
      { key: 'project_description', label: 'Project Description' },
      { key: 'delivery_point', label: 'Delivery Point' },
      { key: 'description_1', label: 'Description I' },
    ],
    searchFields: [
      { label: 'Address Code', value: 'address_code', placeholder: 'Enter Address Code (e.g. AD0000072)...' },
      { label: 'Address Description', value: 'address_description', placeholder: 'Enter Address Description...' },
      { label: 'Project Code', value: 'project_code', placeholder: 'Enter Project Code (e.g. NHRBGB001)...' },
      { label: 'Project Description', value: 'project_description', placeholder: 'Enter Project Description...' },
      { label: 'Delivery Point', value: 'delivery_point', placeholder: 'Enter Delivery Point (e.g. 0148)...' },
      { label: 'Description I', value: 'description_1', placeholder: 'Enter Description I...' },
    ],
  },
}

type MasterRecord = Record<string, unknown>

type MasterListResponse = {
  data: MasterRecord[]
  metadata?: {
    totalRecords: number
    totalPages: number
    currentPage: number
    limit: number
  }
}

type LoadParams = {
  field?: string
  value?: string
  page?: number
}

function displayValue(record: MasterRecord, field: MasterField) {
  const value = record[field.key]

  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (field.type === 'checkboxText') {
    return String(value).toLowerCase() === 'yes' ? 'Yes' : 'No'
  }

  if (field.type === 'datetime') {
    return formatDateTime(value)
  }

  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') {
      return '-'
    }

    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) {
      return String(value)
    }

    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  }

  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function toDateTimeInputValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const date = new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function isStatusField(field: MasterField) {
  return field.key === 'status'
}

function isCodeField(field: MasterField) {
  return ['activity_code', 'project_code', 'project_site', 'location_code', 'site_code', 'item_code', 'warehouse_code', 'address_code', 'delivery_point', 'business_partner_code'].includes(field.key)
}

function isFlagField(field: MasterField) {
  return ['multi_location_activity', 'project_location_linked_activities'].includes(field.key)
}

function supportsInlineEdit(masterKey: string) {
  return ['project-master', 'location-master', 'activity-master', 'item-master', 'delivery-point-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master'].includes(masterKey)
}

function isPaginatedMaster(masterKey: string) {
  return ['project-master', 'activity-master', 'item-master', 'delivery-point-master', 'location-master', 'warehouse-master', 'warehouse-bin-master', 'business-partner-master'].includes(masterKey)
}

function normalizeFormPayload(values: MasterRecord, fields: MasterField[]) {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const field = fieldByKey.get(key)

      if (field?.type === 'checkboxText') {
        return [key, value ? 'Yes' : 'No']
      }

      return [key, typeof value === 'string' ? value.trim() : value]
    }),
  )
}

export default function GenericMasterPage() {
  const { masterKey = '' } = useParams()
  const config = useMemo(() => masterConfigs[masterKey], [masterKey])
  const isPaginated = isPaginatedMaster(masterKey)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchField, setSearchField] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  async function loadRecords(params?: LoadParams) {
    if (!config) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestParams = isPaginated
        ? {
          page: params?.page ?? currentPage,
          limit: PAGE_SIZE,
          ...(params?.field && params?.value ? { field: params.field, value: params.value } : {}),
        }
        : params?.field && params?.value
          ? { field: params.field, value: params.value }
          : undefined

      const { data } = await api.get<MasterListResponse>(`/api/master-data/${masterKey}`, {
        params: requestParams,
      })
      setRecords(data.data)

      if (isPaginated && data.metadata) {
        setCurrentPage(data.metadata.currentPage)
        setTotalPages(data.metadata.totalPages)
        setTotalRecords(data.metadata.totalRecords)
      } else {
        setTotalRecords(data.data.length)
        setTotalPages(1)
        setCurrentPage(1)
      }
    } catch (requestError) {
      console.error(requestError)
      setError(`Could not load ${config.title}. Check that the backend is running and you are logged in.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    loadRecords({ page: 1 })
  }, [masterKey])

  useEffect(() => {
    if (!isPaginated || !config) {
      return
    }

    loadRecords(isFilterActive && searchField && searchQuery.trim()
      ? { field: searchField, value: searchQuery.trim(), page: currentPage }
      : { page: currentPage })
  }, [currentPage])

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim()

    if (!searchField || !trimmedQuery) {
      message.warning('Select a filter field and enter a search value.')
      return
    }

    setIsFilterActive(true)
    setCurrentPage(1)
    await loadRecords({ field: searchField, value: trimmedQuery, page: 1 })
  }

  async function handleClearSearch() {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    await loadRecords({ page: 1 })
  }

  async function handleCreate(values: MasterRecord) {
    setCreating(true)

    try {
      const payload = normalizeFormPayload(values, config.fields)
      await api.post<{ data: MasterRecord }>(`/api/master-data/${masterKey}`, payload)

      form.resetFields()
      setModalOpen(false)
      setCurrentPage(1)
      await loadRecords(isFilterActive && searchField && searchQuery.trim()
        ? { field: searchField, value: searchQuery.trim(), page: 1 }
        : { page: 1 })
      message.success(`${config.title} record created successfully`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to create ${config.title} record`)
    } finally {
      setCreating(false)
    }
  }

  function handleOpenEdit(record: MasterRecord) {
    setSelectedLocationId(record.id as string | number)
    editForm.setFieldsValue(
      Object.fromEntries(
        (config?.fields ?? []).map((field) => [
          field.key,
          field.type === 'datetime'
            ? toDateTimeInputValue(record[field.key])
            : field.type === 'checkboxText'
              ? String(record[field.key]).toLowerCase() === 'yes'
              : record[field.key] ?? '',
        ]),
      ),
    )
    setIsEditModalOpen(true)
  }

  async function handleEdit(values: MasterRecord) {
    if (selectedLocationId === null) {
      return
    }

    setUpdating(true)

    try {
      const payload = normalizeFormPayload(values, config.fields)
      const { data } = await api.put<{ data: MasterRecord }>(
        `/api/master-data/${masterKey}/${selectedLocationId}`,
        payload,
      )

      setRecords((currentRecords) =>
        currentRecords.map((record) => record.id === selectedLocationId ? data.data : record),
      )
      setIsEditModalOpen(false)
      setSelectedLocationId(null)
      editForm.resetFields()
      await loadRecords(isFilterActive && searchField && searchQuery.trim()
        ? { field: searchField, value: searchQuery.trim(), page: currentPage }
        : { page: currentPage })
      message.success(`${config.title} record updated successfully`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to update ${config.title} record`)
    } finally {
      setUpdating(false)
    }
  }

  const recordCount = isPaginated ? totalRecords : records.length
  const showingStart = recordCount === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
  const showingEnd = Math.min(currentPage * PAGE_SIZE, recordCount)

  if (!config) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Master Not Found</h3>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
        </div>

        {config.searchFields && (
          <div className="mt-4 flex flex-wrap items-center gap-[15px]">
            <Select
              allowClear
              className="min-w-[220px]"
              onChange={(value) => {
                setSearchField(value ?? '')
                setSearchQuery('')
              }}
              options={config.searchFields.map((field) => ({
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
                config.searchFields.find((field) => field.value === searchField)?.placeholder ??
                'Select a field first...'
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
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {recordCount} {config.countLabel}
          </span>
          <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)} type="primary">
            {masterKey === 'delivery-point-master'
              ? 'Add Delivery Pt'
              : masterKey === 'warehouse-bin-master'
                ? 'Add Wh Location'
                : config.addButtonLabel
                  ? config.addButtonLabel
                  : `Add ${config.title.replace(' Master', '')}`}
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
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {config.columns.map((column) => (
                    <th className="px-5 py-3 font-semibold" key={column.key}>
                      {column.label}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {records.map((record, index) => (
                  <tr className="hover:bg-slate-50" key={String(record.id ?? record[config.columns[0].key] ?? index)}>
                    {config.columns.map((column) => (
                    <td
                      className={`px-5 py-4 text-slate-700 ${column.type === 'number' ? 'text-right' : ''}`}
                      key={column.key}
                    >
                        {isStatusField(column) ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                              record.status === 'Active' ? 'bg-green-600' : 'bg-red-600'
                            }`}
                          >
                            {displayValue(record, column)}
                          </span>
                        ) : column.type === 'checkboxText' ? (
                          <span className="flex justify-center">
                            <input
                              checked={displayValue(record, column) === 'Yes'}
                              className="h-4 w-4 cursor-not-allowed accent-blue-600"
                              disabled
                              readOnly
                              type="checkbox"
                            />
                          </span>
                        ) : (
                          <span
                            className={[
                              isCodeField(column) ? 'font-mono font-semibold text-slate-800' : '',
                              column.type === 'number' ? 'font-semibold text-slate-800' : '',
                              column.key === 'purchase_unit' ? 'inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700' : '',
                              column.key === 'business_partner_name' ? 'font-semibold text-slate-800' : '',
                              isFlagField(column) ? 'inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700' : '',
                            ].filter(Boolean).join(' ') || undefined}
                          >
                            {displayValue(record, column)}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        {supportsInlineEdit(masterKey) ? (
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'edit',
                                  icon: <Pencil size={16} />,
                                  label: 'Edit',
                                  onClick: () => handleOpenEdit(record),
                                },
                                {
                                  key: 'delete',
                                  icon: <Trash2 size={16} />,
                                  label: 'Delete',
                                  disabled: true,
                                },
                              ],
                            }}
                            placement="bottomRight"
                            trigger={['click']}
                          >
                            <button
                              className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              title={`${config.title} actions`}
                              type="button"
                            >
                              <MoreVertical size={20} />
                            </button>
                          </Dropdown>
                        ) : (
                          <button
                            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            title={`${config.title} actions`}
                            type="button"
                          >
                            <MoreVertical size={20} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!records.length && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No records found.
              </div>
            )}
          </div>

          {isPaginated && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
              <span>
                Showing records {showingStart}-{showingEnd} of {recordCount}
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
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        confirmLoading={creating}
        okText="Create"
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        open={modalOpen}
        title={config.addModalTitle ?? `Add ${config.title}`}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          {config.fields.map((field) => (
            <Form.Item
              key={field.key}
              label={field.label}
              name={field.key}
              rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
              valuePropName={['boolean', 'checkboxText'].includes(field.type ?? '') ? 'checked' : undefined}
            >
              {field.type === 'textarea' ? (
                <Input.TextArea rows={3} />
              ) : ['boolean', 'checkboxText'].includes(field.type ?? '') ? (
                <Switch />
              ) : field.options ? (
                <Select options={field.options} />
              ) : field.type === 'datetime' ? (
                <Input type="datetime-local" />
              ) : field.type === 'number' ? (
                <Input type="number" />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {supportsInlineEdit(masterKey) && (
        <Modal
          confirmLoading={updating}
          okText="Save Changes"
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedLocationId(null)
            editForm.resetFields()
          }}
          onOk={() => editForm.submit()}
          open={isEditModalOpen}
          title={config.editModalTitle ?? `Edit ${config.title}`}
          width={720}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              {config.fields.map((field) => (
                <Form.Item
                  key={field.key}
                  label={field.label}
                  name={field.key}
                  rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
                  valuePropName={['boolean', 'checkboxText'].includes(field.type ?? '') ? 'checked' : undefined}
                >
                  {field.type === 'textarea' ? (
                    <Input.TextArea rows={3} />
                  ) : field.options ? (
                    <Select options={field.options} />
                  ) : field.type === 'datetime' ? (
                    <Input type="datetime-local" />
                  ) : field.type === 'number' ? (
                    <Input type="number" />
                  ) : ['boolean', 'checkboxText'].includes(field.type ?? '') ? (
                    <Switch />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              ))}
            </div>
          </Form>
        </Modal>
      )}
    </section>
  )
}
