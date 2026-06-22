import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Folder,
  MapPin,
  PackagePlus,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

type Option = {
  code: string
  label: string
  description?: string
  group?: string
  meta?: Record<string, string | number | null | undefined>
}

type OptionResponse<T> = {
  data: T[]
  hasMore?: boolean
  nextOffset?: number
}

type DraftItem = {
  id: string
  workType: string
  locationCode?: string
  locationLabel?: string
  activityCode?: string
  activityLabel?: string
  materialCode: string
  materialDesc: string
  uom: string
  requestedQty: string
  toBusinessPartner?: string
  toBusinessPartnerLabel?: string
  remarks?: string
  attachmentName?: string
  attachments?: DraftAttachment[]
  onHandQty?: string | number
}

type DraftAttachment = {
  name: string
  url: string
}

type IndentDraft = {
  id: string
  requestNo: string
  engineerType: 'SIE' | 'SER'
  createdAt: string
  projectCode: string
  projectLabel: string
  indentType: string
  warehouseCode?: string
  warehouseLabel?: string
  sourceLocationCode?: string
  sourceLocationLabel?: string
  toEntityId?: string
  toEntityLabel?: string
  orderNo?: string
  orderType?: string
  equipmentDisplay?: string
  items: DraftItem[]
}

type IndentTransaction = {
  id: string
  app_request_id?: string | null
  indent_no: string
  project_code: string
  project_name?: string | null
  source_warehouse?: string | null
  source_warehouse_name?: string | null
  source_location?: string | null
  delivery_location?: string | null
  delivery_location_name?: string | null
  indent_type?: string | null
  to_entity_type?: string | null
  to_entity_id?: string | null
  status: string
  created_at: string
  items?: Array<{
    id?: string
    line_number: number
    item_code: string
    item_name?: string | null
    uom?: string | null
    on_hand_qty?: string | number | null
    required_qty: string | number
    approved_qty?: string | number | null
    work_type?: string | null
    activity_code?: string | null
    location_code?: string | null
    remarks?: string | null
    attachment_url?: string | null
  }>
}

type IndentSubmitPayload = {
  app_request_id: string
  project_code: string
  source_warehouse: string | null
  source_location: string | null
  delivery_location: string
  requirement_type: string
  indent_type: string
  engineerType: 'SIE' | 'SER'
  orderNo: string | null
  orderType: string | null
  equipmentDisplay: string | null
  status: string
  items: Array<{
    item_code: string
    materialCode: string
    materialDesc: string
    workType: string
    activityId?: string
    locationId?: string
    uom: string
    required_qty: string
    requestedQty: string
    to_entity_id?: string
    remarks?: string
    attachmentUrl: string | null
  }>
}

type PendingSyncRecord = {
  transaction: IndentTransaction
  payload?: IndentSubmitPayload
}

const DRAFTS_KEY = 'indent_field_drafts'
const PENDING_SYNC_INDENTS_KEY = 'indent_pending_sync_indents'
const darkBlue = '#123468'
const OPTION_RENDER_LIMIT = 80
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024

export function FieldIndentHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [indents, setIndents] = useState<IndentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [projects, setProjects] = useState<Option[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const role = getFieldRole(user)
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'Field User'

  async function loadIndents() {
    setIsLoading(true)
    try {
      await syncPendingSyncIndents()
      const response = await api.get<{ data: IndentTransaction[] }>('/api/indents/mine')
      setIndents(mergePendingSyncIndents(response.data.data, readPendingSyncIndents()))
      setErrorMessage('')
    } catch {
      setIndents(readPendingSyncIndents())
      setErrorMessage('Unable to load your indent dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadProjectFilterOptions() {
    try {
      const response = await api.get<{ data: Array<{ project_code: string; project_description: string }> }>(`/api/indents/options/projects?role=${encodeURIComponent(role)}`)
      setProjects(response.data.data.map((project) => ({
        code: project.project_code,
        label: `${project.project_code} - ${project.project_description}`,
        description: project.project_description,
      })))
    } catch {
      setProjects([])
    }
  }

  useEffect(() => {
    loadIndents()
    loadProjectFilterOptions()
  }, [role])

  useEffect(() => {
    const syncOnOnline = () => void loadIndents()
    window.addEventListener('online', syncOnOnline)
    return () => window.removeEventListener('online', syncOnOnline)
  }, [])

  useEffect(() => {
    const refresh = () => void loadIndents()

    window.addEventListener('notifications-refreshed', refresh)
    window.addEventListener('indent-status-updated', refresh)

    return () => {
      window.removeEventListener('notifications-refreshed', refresh)
      window.removeEventListener('indent-status-updated', refresh)
    }
  }, [])

  const dashboardRows = useMemo(() => {
    return [...indents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [indents])
  const projectRows = dashboardRows.filter((row) => !projectFilter || row.project_code === projectFilter)
  const filteredRows = projectRows.filter((row) => activeFilter === 'All' || normalizeStatus(displayIndentStatus(row.status)) === normalizeStatus(activeFilter))

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-blue-950/10 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-white" style={{ backgroundColor: darkBlue }}>
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-xl font-bold">Indent Home</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/15" onClick={loadIndents} type="button" title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="grid h-11 w-11 place-items-center rounded-lg bg-orange-400 text-slate-950 transition hover:bg-orange-300" onClick={() => navigate('/indent-create')} type="button" title="Create indent">
              <Plus size={23} />
            </button>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 border-t border-white/10 px-4 py-4 text-left text-white md:flex-row md:items-center md:justify-between" style={{ backgroundColor: darkBlue }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-orange-300 bg-[#253f78] text-lg font-black">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{displayName}</p>
              <p className="mt-1 text-xs text-blue-100">ID {user?.login_name || user?.employee_id || '-'} <span className="ml-2 rounded bg-yellow-400 px-2 py-0.5 font-bold text-slate-900">{role}</span></p>
            </div>
          </div>
          <select
            className="h-10 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none transition focus:border-white/60 md:w-[280px]"
            onChange={(event) => setProjectFilter(event.target.value)}
            title="Filter project"
            value={projectFilter}
          >
            <option className="text-slate-900" value="">All Projects</option>
            {projects.map((project) => (
              <option className="text-slate-900" key={project.code} value={project.code}>{project.label}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage ? <Alert text={errorMessage} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <MetricBox count={countStatus(projectRows, ['Pending', 'PendingApproval', 'ApprovalPending', 'Created'])} label="Pending for Approval" onClick={() => navigate(`/indent-transactions?status=Pending${projectFilter ? `&projectCode=${encodeURIComponent(projectFilter)}` : ''}`)} tone="yellow" />
        <MetricBox count={projectRows.length} label="Indents Raised" onClick={() => navigate(`/indent-transactions${projectFilter ? `?projectCode=${encodeURIComponent(projectFilter)}` : ''}`)} tone="blue" />
        <MetricBox count={countStatus(projectRows, ['Rejected'])} label="Rejected Indents" onClick={() => navigate(`/indent-transactions?status=Rejected${projectFilter ? `&projectCode=${encodeURIComponent(projectFilter)}` : ''}`)} tone="red" />
        <MetricBox count={countStatus(projectRows, ['Approved'])} label="Approved Indents" onClick={() => navigate(`/indent-transactions?status=Approved${projectFilter ? `&projectCode=${encodeURIComponent(projectFilter)}` : ''}`)} tone="green" />
      </div>

      <div className="flex flex-wrap gap-3">
        {['All', 'Pending', 'Approved', 'Rejected', 'Pending Sync'].map((filter) => (
          <button
            className={`h-11 rounded-full border px-5 text-sm font-bold transition ${
              activeFilter === filter ? 'border-blue-950 bg-blue-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black uppercase text-slate-900">Recent Requests</h3>
        <button className="text-sm font-bold text-slate-700" onClick={() => setActiveFilter('All')} type="button">See All</button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <EmptyState label="Loading requests..." />
        ) : filteredRows.length === 0 ? (
          <EmptyState label="No recent requests." />
        ) : filteredRows.map((indent) => (
          <button
            className={`w-full rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              normalizeStatus(indent.status) === 'CREATED'
                ? 'border-emerald-300 bg-emerald-100/70'
                : 'border-slate-200 bg-white'
            }`}
            key={indent.id}
            onClick={() => navigate(`/indent-workspace/indents/${indent.id}`)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-900/10 pb-3">
              <p className="font-bold text-slate-900">{displayIndentStatus(indent.status) === 'Pending Sync' ? 'IND: Pending Sync' : 'Indent Request'}</p>
              <StatusPill status={indent.status} />
            </div>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              <MetaRow icon={<ClipboardList size={15} />} value={indent.app_request_id || indent.indent_no} />
              <MetaRow icon={<CalendarDays size={15} />} value={formatDate(indent.created_at)} />
              <MetaRow icon={<Folder size={15} />} value={formatPair(indent.project_code, indent.project_name)} />
              <MetaRow icon={<Warehouse size={15} />} value={formatPair(indent.source_warehouse, indent.source_warehouse_name)} />
              <MetaRow icon={<Send size={15} />} value={indent.indent_type || 'Issue'} />
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export function FieldIndentHeader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = getFieldRole(user)
  const [projects, setProjects] = useState<Option[]>([])
  const [warehouses, setWarehouses] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [partners, setPartners] = useState<Option[]>([])
  const [orders, setOrders] = useState<Option[]>([])
  const [form, setForm] = useState({
    projectCode: '',
    indentType: 'Issue',
    warehouseCode: '',
    sourceLocationCode: '',
    toEntityId: '',
    orderNo: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const isIssueReturn = form.indentType === 'Issue Return'

  useEffect(() => {
    async function loadBaseOptions() {
      const projectResponse = await api.get<{ data: Array<{ project_code: string; project_description: string }> }>(`/api/indents/options/projects?role=${encodeURIComponent(role)}`)
      setProjects(projectResponse.data.data.map((project) => ({
        code: project.project_code,
        label: `${project.project_code} - ${project.project_description}`,
        description: project.project_description,
      })))
    }

    loadBaseOptions().catch(() => setErrorMessage('Unable to load header options.'))
  }, [role])

  useEffect(() => {
    if (!form.projectCode) {
      setWarehouses([])
      setLocations([])
      setOrders([])
      setPartners([])
      return
    }

    async function loadProjectOptions() {
      const [warehouseResponse, orderResponse] = await Promise.all([
        api.get<{ data: Array<{ warehouse_code: string; warehouse_description: string }> }>(`/api/warehouses/options?projectCode=${encodeURIComponent(form.projectCode)}`),
        api.get<{ data: Array<{ order_no: string; order_type: string; order_group?: string; description: string; item_code?: string | null; item_description?: string | null; serial_number?: string | null; status?: string | null }> }>(`/api/indents/options/orders?projectCode=${encodeURIComponent(form.projectCode)}`),
      ])
      const nextWarehouses = warehouseResponse.data.data.map((warehouse) => ({
        code: warehouse.warehouse_code,
        label: `${warehouse.warehouse_code} - ${warehouse.warehouse_description}`,
        description: warehouse.warehouse_description,
      }))
      const nextOrders = orderResponse.data.data.map((order) => ({
        code: `${order.order_type}:${order.order_no}`,
        label: formatOrderLabel(order.order_no, order.status, order.description),
        description: order.description,
        group: order.order_group ?? (order.order_type === 'Rental_Order' ? 'Rental Orders' : 'Service Orders'),
        meta: {
          orderNo: order.order_no,
          orderType: order.order_type,
          equipment: formatOrderEquipment(order.item_code, order.item_description, order.serial_number),
        },
      }))
      setWarehouses(nextWarehouses)
      setLocations([])
      setOrders(nextOrders)
      setPartners([])
      setForm((current) => ({
        ...current,
        warehouseCode: nextWarehouses.some((warehouse) => warehouse.code === current.warehouseCode) ? current.warehouseCode : nextWarehouses[0]?.code ?? '',
        sourceLocationCode: '',
        toEntityId: '',
        orderNo: nextOrders.some((order) => order.code === current.orderNo) ? current.orderNo : '',
      }))
      setErrorMessage('')
    }

    loadProjectOptions().catch(() => setErrorMessage('Unable to load project-specific options.'))
  }, [form.projectCode])

  useEffect(() => {
    if (!form.projectCode || (role === 'SIE' && !isIssueReturn && !form.warehouseCode)) {
      setLocations([])
      setPartners([])
      return
    }

    if (role !== 'SIE' && role !== 'SER') {
      return
    }

    const warehouseCode = role === 'SIE' && !isIssueReturn ? form.warehouseCode : ''
    api.get<{ data: Array<{ location_code: string; description: string }> }>(`/api/indents/options/warehouse-locations?projectCode=${encodeURIComponent(form.projectCode)}&warehouseCode=${encodeURIComponent(warehouseCode)}`)
      .then((response) => {
        const nextLocations = response.data.data.map((location) => ({
          code: location.location_code,
          label: `${location.location_code} - ${location.description}`,
          description: location.description,
        }))
        setLocations(nextLocations)
        setPartners([])
        setForm((current) => ({
          ...current,
          sourceLocationCode: nextLocations.some((location) => location.code === current.sourceLocationCode)
            ? current.sourceLocationCode
            : role === 'SIE' && !isIssueReturn
              ? nextLocations[0]?.code ?? ''
              : '',
          toEntityId: role === 'SIE' ? '' : current.toEntityId,
        }))
      })
      .catch(() => setErrorMessage(role === 'SIE' ? 'Unable to load warehouse locations.' : 'Unable to load project locations.'))
  }, [form.projectCode, form.warehouseCode, role, isIssueReturn])

  useEffect(() => {
    if (role !== 'SIE' || isIssueReturn || !form.projectCode || !form.sourceLocationCode) {
      setPartners([])
      return
    }

    loadDeliveryPointOptions(form.projectCode)
      .then((nextPartners) => {
        setPartners(nextPartners)
        setForm((current) => ({
          ...current,
          toEntityId: nextPartners.some((partner) => partner.code === current.toEntityId) ? current.toEntityId : '',
        }))
      })
      .catch(() => setErrorMessage('Unable to load business partner options.'))
  }, [form.projectCode, form.sourceLocationCode, role, isIssueReturn])

  const selectedProject = projects.find((project) => project.code === form.projectCode)
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.code === form.warehouseCode)
  const selectedLocation = locations.find((location) => location.code === form.sourceLocationCode)
  const selectedOrder = orders.find((order) => order.code === form.orderNo)
  const canCreateRequest = Boolean(
    selectedProject &&
    (
      role === 'SIE'
        ? selectedWarehouse && selectedLocation
        : selectedOrder && selectedLocation && (!isIssueReturn || selectedWarehouse)
    ),
  )

  function createDraft() {
    const selectedPartner = partners.find((partner) => partner.code === form.toEntityId)

    if (!selectedProject) {
      setErrorMessage('Select a project.')
      return
    }

    if (role === 'SIE' && (!selectedWarehouse || !selectedLocation)) {
      setErrorMessage(isIssueReturn ? 'Select from location and to warehouse.' : 'Select warehouse and from location.')
      return
    }

    if (role === 'SER' && !selectedOrder) {
      setErrorMessage('Select a service or rental order.')
      return
    }

    if (role === 'SER' && !selectedLocation) {
      setErrorMessage('Select delivery location.')
      return
    }

    if (role === 'SER' && isIssueReturn && !selectedWarehouse) {
      setErrorMessage('Select to warehouse.')
      return
    }

    const draft: IndentDraft = {
      id: `draft-${crypto.randomUUID()}`,
      requestNo: buildRequestNo(),
      engineerType: role,
      createdAt: new Date().toISOString(),
      projectCode: selectedProject.code,
      projectLabel: selectedProject.label,
      indentType: form.indentType,
      warehouseCode: selectedWarehouse?.code,
      warehouseLabel: selectedWarehouse?.label,
      sourceLocationCode: selectedLocation?.code,
      sourceLocationLabel: selectedLocation?.label,
      toEntityId: role === 'SIE'
        ? isIssueReturn ? selectedWarehouse?.code : selectedPartner?.code
        : isIssueReturn ? selectedWarehouse?.code : selectedLocation?.code,
      toEntityLabel: role === 'SIE'
        ? isIssueReturn ? selectedWarehouse?.label : selectedPartner?.label
        : isIssueReturn ? selectedWarehouse?.label : selectedLocation?.label,
      orderNo: String(selectedOrder?.meta?.orderNo ?? selectedOrder?.code ?? ''),
      orderType: String(selectedOrder?.meta?.orderType ?? ''),
      equipmentDisplay: String(selectedOrder?.meta?.equipment ?? ''),
      items: [],
    }

    upsertDraft(draft)
    navigate(`/indent-drafts/${draft.id}`)
  }

  return (
    <MobileShell title="Indent Creation" onBack={() => navigate('/indent-workspace')}>
      <div className="grid w-full min-w-0 gap-5">
        <div className="min-w-0 overflow-visible rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="min-w-0 text-base font-black text-slate-900">{role} Header Details</h3>
            <button
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canCreateRequest}
              onClick={createDraft}
              type="button"
            >
              <FileText size={17} />
              Create Request
            </button>
          </div>
          <div className="grid min-w-0 gap-4">
            <div className={`grid min-w-0 gap-3 ${role === 'SER' ? 'grid-cols-[repeat(auto-fit,minmax(190px,1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(185px,1fr))]'}`}>
              <OptionField compact label="Project *" value={form.projectCode} onChange={(value) => setForm((current) => ({ ...current, projectCode: value }))} options={projects} placeholder="Select Project" />
            {role === 'SER' ? (
              <>
                <OptionField
                  compact
                  label="Service / Rental Order *"
                  value={form.orderNo}
                  onChange={(value) => setForm((current) => ({ ...current, orderNo: value }))}
                  onSearch={(search) => loadOrderOptions(form.projectCode, search).then((nextOrders) => {
                    setOrders((current) => mergeOptions(current, nextOrders))
                    return nextOrders
                  })}
                  options={orders}
                  placeholder="Select Order"
                />
                <ReadonlyField compact label="Equipment" value={String(orders.find((order) => order.code === form.orderNo)?.meta?.equipment ?? 'Auto-filled after order selection')} />
                <OptionField
                  compact
                  label={isIssueReturn ? 'From Location *' : 'Delivery Location *'}
                  value={form.sourceLocationCode}
                  onChange={(value) => setForm((current) => ({ ...current, sourceLocationCode: value }))}
                  options={locations}
                  placeholder={isIssueReturn ? 'Select from location' : 'Select delivery location'}
                />
              </>
            ) : null}
            <OptionField compact label="Type of Indent *" value={form.indentType} onChange={(value) => setForm((current) => ({ ...current, indentType: value }))} options={[
              { code: 'Issue', label: 'Issue' },
              { code: 'Issue Return', label: 'Issue Return' },
            ]} />
            {role === 'SIE' ? (
              <>
                {isIssueReturn ? (
                  <>
                    <OptionField compact label="From Location *" value={form.sourceLocationCode} onChange={(value) => setForm((current) => ({ ...current, sourceLocationCode: value }))} options={locations} placeholder="Select from location" />
                    <OptionField compact label="To Warehouse *" value={form.warehouseCode} onChange={(value) => setForm((current) => ({ ...current, warehouseCode: value }))} options={warehouses} placeholder="Select to warehouse" />
                  </>
                ) : (
                  <>
                    <OptionField compact label="Warehouse *" value={form.warehouseCode} onChange={(value) => setForm((current) => ({ ...current, warehouseCode: value }))} options={warehouses} placeholder="Select warehouse" />
                    <OptionField compact label="From Location *" value={form.sourceLocationCode} onChange={(value) => setForm((current) => ({ ...current, sourceLocationCode: value }))} options={locations} placeholder="Select location" />
                  </>
                )}
                {!isIssueReturn && partners.length > 0 ? (
                  <OptionField
                    compact
                    label="To (Business Partner)"
                    value={form.toEntityId}
                    onChange={(value) => setForm((current) => ({ ...current, toEntityId: value }))}
                    onSearch={(search) => loadDeliveryPointOptions(form.projectCode, '', search).then((nextPartners) => {
                      setPartners((current) => mergeOptions(current, nextPartners))
                      return nextPartners
                    })}
                    options={partners}
                    placeholder="Select BP"
                  />
                ) : null}
              </>
            ) : null}
            {role === 'SER' && isIssueReturn ? (
              <OptionField compact label="To Warehouse *" value={form.warehouseCode} onChange={(value) => setForm((current) => ({ ...current, warehouseCode: value }))} options={warehouses} placeholder="Select to warehouse" />
            ) : null}
          </div>
          </div>
          {errorMessage ? <p className="mt-4 text-sm font-bold text-red-600">{errorMessage}</p> : null}
        </div>
      </div>
    </MobileShell>
  )
}

export function FieldIndentDraftDetails() {
  const { draftId = '' } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<IndentDraft | null>(() => readDrafts().find((item) => item.id === draftId) ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  if (!draft) {
    return <MobileShell title="Indent Details" onBack={() => navigate('/indent-workspace')}><EmptyState label="Draft not found." /></MobileShell>
  }

  async function submitDraft() {
    if (!draft || draft.items.length === 0) {
      setMessage('Add at least one item before submitting.')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    const isReturnDraft = isIssueReturnType(draft.indentType)
    const payload: IndentSubmitPayload = {
      app_request_id: draft.requestNo,
      project_code: draft.projectCode,
      source_warehouse: draft.warehouseCode ?? null,
      source_location: draft.sourceLocationCode ?? draft.warehouseCode ?? null,
      delivery_location: isReturnDraft
        ? draft.warehouseCode ?? draft.sourceLocationCode ?? draft.projectCode
        : draft.sourceLocationCode ?? draft.projectCode,
      requirement_type: draft.indentType,
      indent_type: draft.indentType,
      engineerType: draft.engineerType === 'SER' ? 'SER' : 'SIE',
      orderNo: draft.orderNo ?? draft.toEntityId ?? null,
      orderType: draft.orderType ?? null,
      equipmentDisplay: draft.equipmentDisplay ?? null,
      status: 'Pending',
      items: draft.items.map((item) => ({
        item_code: item.materialCode,
        materialCode: item.materialCode,
        materialDesc: item.materialDesc,
        workType: item.workType,
        activityId: item.activityCode,
        locationId: item.locationCode ?? draft.sourceLocationCode,
        uom: item.uom,
        required_qty: item.requestedQty,
        requestedQty: item.requestedQty,
        to_entity_id: item.toBusinessPartner ?? draft.toEntityId,
        remarks: item.remarks,
        attachmentUrl: serializeAttachments(item.attachments ?? legacyDraftAttachments(item.attachmentName)),
      })),
    }

    try {
      const response = await api.post<{ data: IndentTransaction }>('/api/indents', payload)
      window.dispatchEvent(new CustomEvent('indent-created', {
        detail: {
          id: response.data.data.id,
          indent_no: response.data.data.indent_no,
          status: 'Created',
        },
      }))
      const createdIndent = { ...response.data.data, status: 'Created' }
      removeDraft(draft.id)
      navigate(`/indent-workspace/indents/${createdIndent.id}`, {
        replace: true,
        state: { indent: createdIndent },
      })
    } catch (error) {
      const responseData = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string; issues?: unknown } } }).response?.data
        : undefined
      const serverMessage = responseData?.message === 'Validation failed'
        ? formatValidationIssues(responseData.issues) || responseData.message
        : responseData?.message
      const hasBlankUom = draft.items.some((item) => !String(item.uom ?? '').trim())
      const friendlyMessage = hasBlankUom
        ? 'One or more items is missing UOM. Please remove and add the item again.'
        : ''
      setMessage(friendlyMessage || serverMessage || 'Unable to submit this indent.')
      if (!friendlyMessage && isOfflineSubmitError(error)) {
        const pendingIndent = { ...draftToTransaction(draft), status: 'PendingSync' }
        upsertPendingSyncIndent(pendingIndent, payload)
        removeDraft(draft.id)
        navigate(`/indent-workspace/indents/${pendingIndent.id}`, {
          replace: true,
          state: { indent: pendingIndent },
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function deleteItem(itemId: string) {
    if (!draft) return
    const nextDraft = { ...draft, items: draft.items.filter((item) => item.id !== itemId) }
    upsertDraft(nextDraft)
    setDraft(nextDraft)
  }

  function saveInlineItem(item: DraftItem) {
    if (!draft) return
    const nextDraft = {
      ...draft,
      items: editingItemId
        ? draft.items.map((currentItem) => (currentItem.id === editingItemId ? item : currentItem))
        : [...draft.items, item],
    }
    upsertDraft(nextDraft)
    setDraft(nextDraft)
    setItemFormOpen(false)
    setEditingItemId(null)
    setMessage('')
  }

  function cancelInlineItem() {
    setItemFormOpen(false)
    setEditingItemId(null)
  }

  const visibleItems = itemFormOpen && editingItemId
    ? draft.items.filter((item) => item.id !== editingItemId)
    : draft.items

  return (
    <MobileShell title="Indent Details" onBack={() => navigate('/indent-workspace')}>
      <IndentSummaryCard indent={draftToTransaction(draft)} />
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-black uppercase text-slate-900">Items</h3>
          <p className="mt-2 text-xs text-slate-400">{draft.items.length} added</p>
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-lg bg-blue-950 text-white transition hover:bg-blue-900" onClick={() => {
          setEditingItemId(null)
          setItemFormOpen((current) => !current)
        }} type="button" title="Add item">
          <Plus size={19} />
        </button>
      </div>
      {itemFormOpen ? (
        <InlineDraftItemForm
          key={editingItemId ?? 'new'}
          draft={draft}
          editItem={draft.items.find((item) => item.id === editingItemId) ?? null}
          existingItems={draft.items}
          onCancel={cancelInlineItem}
          onSave={saveInlineItem}
        />
      ) : null}
      {draft.items.length === 0 || visibleItems.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white shadow-sm">
        {draft.items.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-slate-400">No items added yet. Tap + to add an item.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleItems.map((item) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto]" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-slate-900">{item.materialCode} - {item.materialDesc}</p>
                  <p className="mt-1 text-sm text-slate-500">Qty: {item.requestedQty} {item.uom} · {item.workType}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.locationLabel || draft.sourceLocationLabel || '-'} · {item.activityLabel || '-'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50" onClick={() => {
                    setEditingItemId(item.id)
                    setItemFormOpen(true)
                  }} type="button">
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-50" onClick={() => deleteItem(item.id)} type="button">
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      ) : null}
      {message ? <p className="mt-4 text-sm font-bold text-red-600">{message}</p> : null}
      <div className="mt-6 grid gap-3">
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-950 text-sm font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-45" disabled={isSubmitting || draft.items.length === 0} onClick={submitDraft} type="button">
          <Check size={17} />
          {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
        </button>
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-950 bg-white text-sm font-black text-blue-950 transition hover:bg-slate-50" onClick={() => setMessage('Draft saved on this device.')} type="button">
          <Save size={17} />
          Save as Draft
        </button>
      </div>
    </MobileShell>
  )
}

function InlineDraftItemForm({ draft, editItem, existingItems, onCancel, onSave }: { draft: IndentDraft; editItem?: DraftItem | null; existingItems: DraftItem[]; onCancel: () => void; onSave: (item: DraftItem) => void }) {
  const [materials, setMaterials] = useState<Option[]>([])
  const [activities, setActivities] = useState<Option[]>([])
  const [form, setForm] = useState({
    workType: editItem?.workType ?? 'BOQ',
    activityCode: editItem?.activityCode ?? '',
    materialCode: editItem?.materialCode ?? '',
    requestedQty: editItem?.requestedQty ?? '',
    remarks: editItem?.remarks ?? '',
    attachments: editItem?.attachments ?? legacyDraftAttachments(editItem?.attachmentName),
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraMessage, setCameraMessage] = useState('')
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const materialScope = draft.engineerType === 'SER' ? 'all' : 'project'
    loadMaterialOptions(draft.projectCode, draft.engineerType === 'SIE' ? draft.warehouseCode ?? '' : '', '', materialScope)
      .then((initialMaterials) => setMaterials(mergeOptions(initialMaterials, editItem ? [{
        code: editItem.materialCode,
        label: `${editItem.materialCode} - ${editItem.materialDesc}`,
        description: editItem.materialDesc,
        meta: { uom: editItem.uom, onHandQty: editItem.onHandQty },
      }] : [])))
      .catch(() => setErrorMessage('Unable to load materials.'))

    void loadAllMaterialOptions(draft.projectCode, draft.engineerType === 'SIE' ? draft.warehouseCode ?? '' : '', materialScope)
      .then((allMaterials) => setMaterials((current) => mergeOptions(current, allMaterials)))
      .catch(() => undefined)

    if (draft.engineerType === 'SIE') {
      api.get<OptionResponse<{ activity_code: string; description: string }>>(`/api/indents/options/activities?projectCode=${encodeURIComponent(draft.projectCode)}&limit=500`)
        .then((response) => setActivities(mergeOptions(response.data.data.map((activity) => ({
          code: activity.activity_code,
          label: `${activity.activity_code} - ${activity.description}`,
          description: activity.description,
        })), editItem?.activityCode ? [{
          code: editItem.activityCode,
          label: editItem.activityLabel ?? editItem.activityCode,
        }] : [])))
        .catch(() => setErrorMessage('Unable to load activities.'))

    }
  }, [draft, editItem])

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
  }, [cameraStream])

  const selectedMaterial = materials.find((material) => material.code === form.materialCode)
  const selectedActivity = activities.find((activity) => activity.code === form.activityCode)
  const canSaveItem = Boolean(
    selectedMaterial &&
    form.requestedQty &&
    Number(form.requestedQty) > 0 &&
    (draft.engineerType !== 'SIE' || selectedActivity),
  )

  async function handleAttachmentSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setErrorMessage('Attachment size must be 5 MB or less.')
      event.target.value = ''
      return
    }

    try {
      await uploadAndAppendAttachment(file)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to upload attachment. Please try again.')
    } finally {
      event.target.value = ''
    }
  }

  function removeAttachment(url: string) {
    setForm((current) => ({ ...current, attachments: current.attachments.filter((attachment) => attachment.url !== url) }))
  }

  async function uploadAndAppendAttachment(file: File) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setErrorMessage('Attachment size must be 5 MB or less.')
      return
    }

    const uploadedAttachment = await uploadIndentAttachment(file)
    setForm((current) => ({ ...current, attachments: [...current.attachments, uploadedAttachment] }))
  }

  async function startCameraCapture() {
    setCameraMessage('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      })
      setCameraStream(stream)
    } catch {
      setCameraMessage('Camera is not available. Please allow camera access and try again.')
    }
  }

  function stopCameraCapture() {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraMessage('')
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraMessage('Camera is still starting. Please try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraMessage('Unable to capture photo.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setCameraMessage('Unable to capture photo.')
      return
    }

    try {
      const file = new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: 'image/jpeg' })
      await uploadAndAppendAttachment(file)
      stopCameraCapture()
    } catch {
      setCameraMessage('Unable to upload captured photo.')
    }
  }

  function saveItem() {
    if (!selectedMaterial || !form.requestedQty || Number(form.requestedQty) <= 0) {
      setErrorMessage('Select material and enter a valid requested quantity.')
      return
    }

    if (draft.engineerType === 'SIE' && !selectedActivity) {
      setErrorMessage('Select activity.')
      return
    }

    const duplicate = existingItems.some((item) =>
      item.id !== editItem?.id &&
      item.materialCode === selectedMaterial.code &&
      item.locationCode === draft.sourceLocationCode &&
      item.activityCode === selectedActivity?.code &&
      item.toBusinessPartner === draft.toEntityId
    )

    if (duplicate) {
      setErrorMessage('Item already present for the same location, activity, and business partner.')
      return
    }

    onSave({
      id: editItem?.id ?? crypto.randomUUID(),
      workType: form.workType,
      locationCode: draft.sourceLocationCode,
      locationLabel: draft.sourceLocationLabel,
      activityCode: selectedActivity?.code,
      activityLabel: selectedActivity?.label,
      materialCode: selectedMaterial.code,
      materialDesc: selectedMaterial.description || selectedMaterial.label,
      uom: String(selectedMaterial.meta?.uom ?? ''),
      requestedQty: form.requestedQty,
      toBusinessPartner: draft.toEntityId,
      toBusinessPartnerLabel: draft.toEntityLabel,
      remarks: form.remarks,
      attachmentName: form.attachments.map((attachment) => attachment.name).join(', '),
      attachments: form.attachments,
      onHandQty: selectedMaterial.meta?.onHandQty ?? undefined,
    })
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-base font-black text-slate-900">Item Details</h3>
        <div className="flex items-center gap-2">
          <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50" onClick={onCancel} type="button">Cancel</button>
          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-950 px-5 text-sm font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-45" disabled={!canSaveItem} onClick={saveItem} type="button">
            {editItem ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </div>
      {draft.engineerType === 'SIE' ? (
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 max-w-full gap-3 lg:grid-cols-[minmax(120px,0.55fr)_minmax(190px,0.85fr)_minmax(230px,1fr)_minmax(280px,1.3fr)]">
            <OptionField compact label="Work Type *" value={form.workType} onChange={(value) => setForm((current) => ({ ...current, workType: value }))} options={[
              { code: 'BOQ', label: 'BOQ' },
              { code: 'NON-BOQ', label: 'NON-BOQ' },
            ]} />
            <ReadonlyField compact label="Location" value={draft.sourceLocationLabel || draft.sourceLocationCode || '-'} />
            <OptionField
              compact
              label="Activity *"
              value={form.activityCode}
              onChange={(value) => setForm((current) => ({ ...current, activityCode: value }))}
              onSearch={(search) => loadActivityOptions(draft.projectCode, search).then((nextActivities) => {
                setActivities((current) => mergeOptions(current, nextActivities))
                return nextActivities
              })}
              options={activities}
              placeholder="Select activity"
            />
            <OptionField
              compact
              label="Material *"
              value={form.materialCode}
              onChange={(value) => setForm((current) => ({ ...current, materialCode: value }))}
              onSearch={(search) => loadMaterialOptions(draft.projectCode, draft.warehouseCode ?? '', search, 'project').then((nextMaterials) => {
                setMaterials((current) => mergeOptions(current, nextMaterials))
                return nextMaterials
              })}
              options={materials}
              placeholder="Select material"
            />
          </div>
          <div className="grid min-w-0 max-w-full gap-3 lg:grid-cols-[70px_110px_minmax(240px,1fr)_minmax(260px,0.9fr)]">
            <ReadonlyField compact label="UOM" value={String(selectedMaterial?.meta?.uom ?? '') || '-'} />
            <TextField compact label="Req Qty *" value={form.requestedQty} onChange={(value) => setForm((current) => ({ ...current, requestedQty: value }))} placeholder="Qty" type="number" />
            <TextField compact label="Remarks" value={form.remarks} onChange={(value) => setForm((current) => ({ ...current, remarks: value }))} placeholder="Enter remarks" />
            <AttachmentPicker attachments={form.attachments} cameraInputRef={cameraInputRef} onCamera={startCameraCapture} onChange={handleAttachmentSelect} onRemove={removeAttachment} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(300px,1.5fr)_minmax(100px,0.55fr)_minmax(120px,0.6fr)_minmax(260px,1fr)]">
          <OptionField
            compact
            label="Material *"
            value={form.materialCode}
            onChange={(value) => setForm((current) => ({ ...current, materialCode: value }))}
            onSearch={(search) => loadMaterialOptions(draft.projectCode, '', search, 'all').then((nextMaterials) => {
              setMaterials((current) => mergeOptions(current, nextMaterials))
              return nextMaterials
            })}
            options={materials}
            placeholder="Select material"
          />
          <ReadonlyField compact label="UOM" value={String(selectedMaterial?.meta?.uom ?? '') || '-'} />
          <TextField compact label="Requested Qty *" value={form.requestedQty} onChange={(value) => setForm((current) => ({ ...current, requestedQty: value }))} placeholder="Qty" type="number" />
          <TextField compact label="Remarks" value={form.remarks} onChange={(value) => setForm((current) => ({ ...current, remarks: value }))} placeholder="Enter remarks" />
          <AttachmentPicker attachments={form.attachments} cameraInputRef={cameraInputRef} onCamera={startCameraCapture} onChange={handleAttachmentSelect} onRemove={removeAttachment} />
        </div>
      )}
      {errorMessage ? <p className="mt-3 text-sm font-bold text-red-600">{errorMessage}</p> : null}
      {cameraStream ? (
        <CameraCaptureDialog
          cameraMessage={cameraMessage}
          onCancel={stopCameraCapture}
          onCapture={captureCameraPhoto}
          videoRef={cameraVideoRef}
        />
      ) : null}
    </div>
  )
}

function AttachmentPicker({ attachments, cameraInputRef, onCamera, onChange, onRemove }: { attachments: DraftAttachment[]; cameraInputRef: RefObject<HTMLInputElement | null>; onCamera: () => void; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onRemove: (url: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <p className="mb-1 text-[13px] font-black text-slate-600">Attachment</p>
      <div className="flex flex-nowrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-blue-950 transition hover:bg-slate-100">
          <Upload size={15} />
          File
          <input className="sr-only" type="file" onChange={onChange} />
        </label>
        <button className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-blue-950 transition hover:bg-slate-100" onClick={onCamera} type="button">
          <Camera size={15} />
          Camera
        </button>
        <input accept="image/*" capture="environment" className="sr-only" ref={cameraInputRef as unknown as Ref<HTMLInputElement>} type="file" onChange={onChange} />
        {attachments.length > 0 ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Paperclip size={15} />
            Open
          </button>
        ) : null}
      </div>
      {open ? <DraftAttachmentDialog attachments={attachments} onClose={() => setOpen(false)} onRemove={onRemove} /> : null}
    </div>
  )
}

function DraftAttachmentDialog({ attachments, onClose, onRemove }: { attachments: DraftAttachment[]; onClose: () => void; onRemove: (url: string) => void }) {
  useEffect(() => {
    if (attachments.length === 0) {
      onClose()
    }
  }, [attachments.length, onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">Attachments</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{attachments.length} selected</p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            type="button"
            title="Close attachments"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="grid gap-2">
            {attachments.map((attachment, index) => (
              <div className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={`${attachment.url}-${index}`}>
                <a
                  className="flex min-w-0 flex-1 items-center gap-3 text-sm font-bold text-slate-700 transition hover:text-blue-950"
                  href={resolveAttachmentHref(attachment.url)}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Paperclip className="shrink-0 text-slate-500" size={16} />
                  <span className="min-w-0 break-all">{attachment.name || `Attachment ${index + 1}`}</span>
                </a>
                <button
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => onRemove(attachment.url)}
                  title={`Remove ${attachment.name}`}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CameraCaptureDialog({ cameraMessage, onCancel, onCapture, videoRef }: { cameraMessage: string; onCancel: () => void; onCapture: () => void; videoRef: RefObject<HTMLVideoElement | null> }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4">
      <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-slate-950 shadow-2xl">
        <video autoPlay className="aspect-[3/4] w-full bg-black object-cover sm:aspect-video" playsInline ref={videoRef as unknown as Ref<HTMLVideoElement>} />
        {cameraMessage ? <p className="bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">{cameraMessage}</p> : null}
        <div className="grid grid-cols-2 gap-3 bg-white p-4">
          <button className="h-12 rounded-lg border border-slate-200 text-sm font-black text-slate-700" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-12 rounded-lg bg-blue-950 text-sm font-black text-white" onClick={onCapture} type="button">
            Capture
          </button>
        </div>
      </div>
    </div>
  )
}

export function FieldIndentSubmittedDetails() {
  const { indentId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateIndent = (location.state as { indent?: IndentTransaction } | null)?.indent
    ?? readPendingSyncIndents().find((pendingIndent) => pendingIndent.id === indentId)
    ?? null
  const [indent, setIndent] = useState<IndentTransaction | null>(() => stateIndent)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadIndentDetail() {
    const pendingIndent = readPendingSyncIndents().find((item) => item.id === indentId)
    if (pendingIndent) {
      setIndent(pendingIndent)
      setErrorMessage('')
      return
    }

    try {
      const response = await api.get<{ data: IndentTransaction }>(`/api/indents/mine/${encodeURIComponent(indentId)}`)
      setIndent(response.data.data)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load indent details.')
    }
  }

  useEffect(() => {
    if (stateIndent) {
      return
    }

    void loadIndentDetail()
  }, [indentId, stateIndent])

  useEffect(() => {
    const refresh = () => void loadIndentDetail()

    window.addEventListener('notifications-refreshed', refresh)
    window.addEventListener('indent-status-updated', refresh)

    return () => {
      window.removeEventListener('notifications-refreshed', refresh)
      window.removeEventListener('indent-status-updated', refresh)
    }
  }, [indentId])

  useEffect(() => {
    if (!indent || normalizeStatus(indent.status) !== 'CREATED') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIndent((current) => current && normalizeStatus(current.status) === 'CREATED'
        ? { ...current, status: 'Pending' }
        : current)
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [indent])

  return (
    <MobileShell title="Indent Details" onBack={() => navigate('/indent-workspace')}>
      {errorMessage ? <Alert text={errorMessage} /> : null}
      {!indent ? <EmptyState label={errorMessage ? 'No details available.' : 'Loading indent details...'} /> : (
        <>
          <IndentSummaryCard indent={indent} onPrint={() => printFieldIndentPdf(indent)} />
          <div className="mt-7">
            <h3 className="text-xl font-black uppercase text-slate-900">Items</h3>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white shadow-sm">
              {!indent.items?.length ? <p className="px-4 py-7 text-center text-sm text-slate-400">No item details found.</p> : (
                <div className="divide-y divide-slate-100">
                  {indent.items.map((item) => (
                    <div className="p-4" key={item.id ?? item.line_number}>
                      <p className="font-mono text-sm font-black text-slate-900">{item.item_code} - {item.item_name || '-'}</p>
                      <p className="mt-1 text-sm text-slate-500">Qty: {formatQty(item.required_qty)} {item.uom || ''} · {item.work_type || indent.indent_type || '-'}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.location_code || '-'} · {item.activity_code || '-'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </MobileShell>
  )
}

export function FieldIndentAddItem() {
  const { draftId = '', itemId = '' } = useParams()
  const navigate = useNavigate()
  const draft = readDrafts().find((item) => item.id === draftId) ?? null
  const editItem = draft?.items.find((item) => item.id === itemId) ?? null
  const [materials, setMaterials] = useState<Option[]>([])
  const [activities, setActivities] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [form, setForm] = useState({
    workType: editItem?.workType ?? 'BOQ',
    locationCode: editItem?.locationCode ?? draft?.sourceLocationCode ?? '',
    activityCode: editItem?.activityCode ?? '',
    materialCode: editItem?.materialCode ?? '',
    requestedQty: editItem?.requestedQty ?? '',
    remarks: editItem?.remarks ?? '',
    attachmentName: editItem?.attachmentName ?? '',
    attachments: editItem?.attachments ?? legacyDraftAttachments(editItem?.attachmentName),
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraMessage, setCameraMessage] = useState('')
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!draft) return
    const sourceDraft = draft

    async function loadOptions() {
      const materialScope = sourceDraft.engineerType === 'SER' ? 'all' : 'project'
      const initialMaterials = await loadMaterialOptions(sourceDraft.projectCode, sourceDraft.engineerType === 'SIE' ? sourceDraft.warehouseCode ?? '' : '', '', materialScope)
      const editMaterial = editItem
        ? [{
          code: editItem.materialCode,
          label: `${editItem.materialCode} - ${editItem.materialDesc}`,
          description: editItem.materialDesc,
          meta: { uom: editItem.uom, onHandQty: editItem.onHandQty },
        }]
        : []
      setMaterials(mergeOptions(initialMaterials, editMaterial))

      void loadAllMaterialOptions(sourceDraft.projectCode, sourceDraft.engineerType === 'SIE' ? sourceDraft.warehouseCode ?? '' : '', materialScope)
        .then((allMaterials) => setMaterials((current) => mergeOptions(current, allMaterials)))
        .catch(() => undefined)

      if (sourceDraft.engineerType !== 'SIE') {
        return
      }

      const [activityResponse, locationResponse] = await Promise.all([
        api.get<OptionResponse<{ activity_code: string; description: string }>>(`/api/indents/options/activities?projectCode=${encodeURIComponent(sourceDraft.projectCode)}&limit=500`),
        api.get<{ data: Array<{ location_code: string; description: string }> }>(`/api/indents/options/warehouse-locations?projectCode=${encodeURIComponent(sourceDraft.projectCode)}&warehouseCode=${encodeURIComponent(sourceDraft.warehouseCode ?? '')}`),
      ])
      setActivities(activityResponse.data.data.map((activity) => ({
        code: activity.activity_code,
        label: `${activity.activity_code} - ${activity.description}`,
        description: activity.description,
      })))
      setLocations(locationResponse.data.data.map((location) => ({
        code: location.location_code,
        label: `${location.location_code} - ${location.description}`,
        description: location.description,
      })))
      setForm((current) => ({
        ...current,
        materialCode: current.materialCode,
        activityCode: current.activityCode,
      }))
    }

    loadOptions().catch(() => setErrorMessage('Unable to load item options.'))
  }, [draftId, itemId])

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
  }, [cameraStream])

  if (!draft) {
    return <MobileShell title="Add New Item" onBack={() => navigate('/indent-workspace')}><EmptyState label="Draft not found." /></MobileShell>
  }
  const activeDraft = draft
  const isEditMode = Boolean(editItem)

  const selectedMaterial = materials.find((material) => material.code === form.materialCode)
  const selectedActivity = activities.find((activity) => activity.code === form.activityCode)
  const selectedLocation = locations.find((location) => location.code === form.locationCode) ?? {
    code: activeDraft.sourceLocationCode ?? '',
    label: activeDraft.sourceLocationLabel ?? '',
  }
  const canSaveItem = Boolean(
    selectedMaterial &&
    form.requestedQty &&
    Number(form.requestedQty) > 0 &&
    (activeDraft.engineerType !== 'SIE' || selectedActivity),
  )

  async function handleAttachmentSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setErrorMessage('Attachment size must be 5 MB or less.')
      event.target.value = ''
      return
    }

    await uploadAndAppendAttachment(file)
    event.target.value = ''
  }

  async function uploadAndAppendAttachment(file: File) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setErrorMessage('Attachment size must be 5 MB or less.')
      return
    }

    setErrorMessage('')
    try {
      const uploadedAttachment = await uploadIndentAttachment(file)
      setForm((current) => {
        const attachments = [...current.attachments, uploadedAttachment]
        return {
          ...current,
          attachments,
          attachmentName: attachments.map((attachment) => attachment.name).join(', '),
        }
      })
    } catch {
      setErrorMessage('Unable to upload attachment. Please try again.')
    }
  }

  function removeAttachment(url: string) {
    setForm((current) => {
      const attachments = current.attachments.filter((attachment) => attachment.url !== url)
      return {
        ...current,
        attachments,
        attachmentName: attachments.map((attachment) => attachment.name).join(', '),
      }
    })
  }

  async function startCameraCapture() {
    setCameraMessage('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      })
      setCameraStream(stream)
    } catch {
      setCameraMessage('Camera is not available. Please allow camera access and try again.')
    }
  }

  function stopCameraCapture() {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraMessage('')
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraMessage('Camera is still starting. Please try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraMessage('Unable to capture photo.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setCameraMessage('Unable to capture photo.')
      return
    }

    const file = new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: 'image/jpeg' })
    await uploadAndAppendAttachment(file)
    stopCameraCapture()
  }

  function saveItem() {
    if (!selectedMaterial || !form.requestedQty || Number(form.requestedQty) <= 0) {
      setErrorMessage('Select material and enter a valid requested quantity.')
      return
    }

    const duplicate = activeDraft.items.some((item) =>
      item.id !== itemId &&
      item.materialCode === selectedMaterial.code &&
      item.locationCode === selectedLocation.code &&
      item.activityCode === selectedActivity?.code &&
      item.toBusinessPartner === activeDraft.toEntityId
    )

    if (duplicate) {
      setErrorMessage('Item already present for the same location, activity, and business partner.')
      return
    }

    const nextItem: DraftItem = {
        id: crypto.randomUUID(),
        workType: form.workType,
        locationCode: selectedLocation.code,
        locationLabel: selectedLocation.label,
        activityCode: selectedActivity?.code,
        activityLabel: selectedActivity?.label,
        materialCode: selectedMaterial.code,
        materialDesc: selectedMaterial.description || selectedMaterial.label,
        uom: String(selectedMaterial.meta?.uom ?? ''),
        requestedQty: form.requestedQty,
        toBusinessPartner: activeDraft.toEntityId,
        toBusinessPartnerLabel: activeDraft.toEntityLabel,
        remarks: form.remarks,
        attachmentName: form.attachmentName,
        attachments: form.attachments,
        onHandQty: selectedMaterial.meta?.onHandQty ?? undefined,
      }
    const nextDraft: IndentDraft = {
      ...activeDraft,
      items: isEditMode
        ? activeDraft.items.map((item) => (item.id === itemId ? { ...nextItem, id: item.id } : item))
        : [...activeDraft.items, nextItem],
    }
    upsertDraft(nextDraft)
    navigate(`/indent-drafts/${activeDraft.id}`)
  }

  return (
    <MobileShell title={isEditMode ? 'Edit Item' : 'Add New Item'} onBack={() => navigate(`/indent-drafts/${draft.id}`)}>
      <div className="mx-auto grid w-full max-w-[560px] gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 text-lg font-black text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-orange-50 text-orange-700"><PackagePlus size={19} /></span>
            Item Details
          </h3>
          <div className="grid gap-4">
            {draft.engineerType === 'SIE' ? (
              <>
                <OptionField label="Work Type (Item Transaction Type) *" value={form.workType} onChange={(value) => setForm((current) => ({ ...current, workType: value }))} options={[
                  { code: 'BOQ', label: 'BOQ' },
                  { code: 'NON-BOQ', label: 'NON-BOQ' },
                ]} />
                <ReadonlyField label="Location (Optional)" value={draft.sourceLocationLabel || selectedLocation.label || '-'} />
                <OptionField
                  label="Activity *"
                  value={form.activityCode}
                  onChange={(value) => setForm((current) => ({ ...current, activityCode: value }))}
                  onSearch={(search) => loadActivityOptions(activeDraft.projectCode, search).then((nextActivities) => {
                    setActivities((current) => mergeOptions(current, nextActivities))
                    return nextActivities
                  })}
                  options={activities}
                  placeholder="Select activity"
                />
              </>
            ) : null}
            <OptionField
              label="Material *"
              value={form.materialCode}
              onChange={(value) => setForm((current) => ({ ...current, materialCode: value }))}
              onSearch={(search) => loadMaterialOptions(activeDraft.projectCode, activeDraft.engineerType === 'SIE' ? activeDraft.warehouseCode ?? '' : '', search, activeDraft.engineerType === 'SER' ? 'all' : 'project').then((nextMaterials) => {
                setMaterials((current) => mergeOptions(current, nextMaterials))
                return nextMaterials
              })}
              options={materials}
              placeholder="Select material"
            />
            <ReadonlyField label="UOM (Auto-filled)" value={String(selectedMaterial?.meta?.uom ?? '') || '-'} />
            <TextField label="Requested Qty *" value={form.requestedQty} onChange={(value) => setForm((current) => ({ ...current, requestedQty: value }))} placeholder="Enter quantity" type="number" />
            <TextField label="Remarks" value={form.remarks} onChange={(value) => setForm((current) => ({ ...current, remarks: value }))} placeholder="Enter remarks" multiline />
            <div>
              <p className="mb-2 text-sm font-black text-slate-600">Attachment</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-blue-950 transition hover:bg-slate-100">
                  <Upload size={16} />
                  File
                  <input className="sr-only" type="file" onChange={handleAttachmentSelect} />
                </label>
                <button className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-blue-950 transition hover:bg-slate-100" onClick={startCameraCapture} type="button">
                  <Camera size={16} />
                  Camera
                </button>
                <input accept="image/*" capture="environment" className="sr-only" ref={cameraInputRef} type="file" onChange={handleAttachmentSelect} />
              </div>
              {form.attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.attachments.map((attachment) => (
                    <span
                      className="inline-flex min-h-8 max-w-full items-center overflow-hidden rounded-md border border-blue-100 bg-blue-50 text-xs font-bold text-blue-950"
                      key={attachment.url}
                    >
                      <a
                        className="inline-flex min-w-0 items-center gap-2 px-3 py-1 transition hover:bg-blue-100"
                        href={resolveAttachmentHref(attachment.url)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <FileText size={13} className="shrink-0" />
                        <span className="truncate">{attachment.name}</span>
                      </a>
                      <button
                        className="grid h-8 w-8 shrink-0 place-items-center border-l border-blue-100 text-blue-950 transition hover:bg-blue-100"
                        onClick={() => removeAttachment(attachment.url)}
                        title={`Remove ${attachment.name}`}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Max attachment size: 5 MB</p>
              )}
            </div>
          </div>
          {errorMessage ? <p className="mt-4 text-sm font-bold text-red-600">{errorMessage}</p> : null}
        </div>
        <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-950 text-base font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-45" disabled={!canSaveItem} onClick={saveItem} type="button">
          <Check size={19} />
          {isEditMode ? 'Update Item' : 'Save Item'}
        </button>
      </div>
      {cameraStream ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4">
          <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-slate-950 shadow-2xl">
            <video autoPlay className="aspect-[3/4] w-full bg-black object-cover sm:aspect-video" playsInline ref={cameraVideoRef} />
            {cameraMessage ? <p className="bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">{cameraMessage}</p> : null}
            <div className="grid grid-cols-2 gap-3 bg-white p-4">
              <button className="h-12 rounded-lg border border-slate-200 text-sm font-black text-slate-700" onClick={stopCameraCapture} type="button">
                Cancel
              </button>
              <button className="h-12 rounded-lg bg-blue-950 text-sm font-black text-white" onClick={captureCameraPhoto} type="button">
                Capture
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  )
}

function MobileShell({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return (
    <section className="-m-4 min-h-[calc(100vh-74px)] bg-[#f4f7fb] sm:-m-6 lg:-m-8">
      <div className="px-5 pt-3 lg:px-8">
        <button className="grid h-9 w-9 place-items-center rounded-lg bg-blue-950 text-white shadow-sm transition hover:bg-blue-900" onClick={onBack} type="button" title={`Back from ${title}`}>
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="px-5 py-5 lg:px-8">{children}</div>
    </section>
  )
}

function IndentSummaryCard({ indent, onPrint }: { indent: IndentTransaction; onPrint?: () => void }) {
  const canPrintPdf = isApprovedStatus(indent.status)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase text-slate-400">Request ID</p>
          <h3 className="mt-1 break-all text-base font-black text-slate-900">{indent.app_request_id || indent.indent_no}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onPrint ? (
            <button
              aria-disabled={!canPrintPdf}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition ${
                canPrintPdf
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
              }`}
              onClick={canPrintPdf ? onPrint : undefined}
              type="button"
            >
              <Printer size={15} />
              PDF
            </button>
          ) : null}
          <StatusPill status={indent.status} />
        </div>
      </div>
      <p className="mt-3 text-xs font-black text-slate-600">INDENT : {indent.indent_no === 'Indent No. will be assigned after submission' ? indent.indent_no : indent.indent_no}</p>
      <div className="mt-3 grid gap-4 text-xs font-semibold text-slate-700 md:grid-cols-3">
        <div className="grid content-start gap-2">
          <MetaRow icon={<CalendarDays size={15} />} value={formatDate(indent.created_at)} />
          <MetaRow icon={<Folder size={15} />} value={formatPair(indent.project_code, indent.project_name)} />
        </div>
        <div className="grid content-start gap-2">
          <MetaRow icon={<Warehouse size={15} />} value={formatPair(indent.source_warehouse, indent.source_warehouse_name)} />
          <MetaRow icon={<MapPin size={15} />} value={indent.source_location || indent.delivery_location || '-'} />
        </div>
        <div className="grid content-start gap-2">
          <MetaRow icon={<Send size={15} />} value={indent.indent_type || '-'} />
          {indent.to_entity_id ? <MetaRow icon={<Building2 size={15} />} value={indent.to_entity_id} /> : null}
        </div>
      </div>
    </div>
  )
}

function MetricBox({ count, label, onClick, tone }: { count: number; label: string; onClick?: () => void; tone: 'blue' | 'green' | 'red' | 'yellow' }) {
  const toneClasses = {
    blue: 'border-l-blue-950 bg-blue-50/40 text-blue-950',
    green: 'border-l-emerald-500 bg-emerald-50 text-emerald-700',
    red: 'border-l-red-500 bg-red-50 text-red-700',
    yellow: 'border-l-amber-400 bg-amber-50 text-amber-700',
  }
  return (
    <button className={`min-h-24 rounded-lg border border-slate-200 border-l-4 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClasses[tone]}`} onClick={onClick} type="button">
      <span className="block text-4xl font-light">{count}</span>
      <span className="mt-2 block text-sm font-semibold text-slate-500">{label}</span>
    </button>
  )
}

function OptionField({
  compact = false,
  label,
  onChange,
  onSearch,
  options,
  placeholder = 'Select',
  value,
}: {
  compact?: boolean
  label: string
  onChange: (value: string) => void
  onSearch?: (search: string) => Promise<Option[]>
  options: Option[]
  placeholder?: string
  value: string
}) {
  const selectedOption = options.find((option) => option.code === value)
  const [query, setQuery] = useState(selectedOption?.label ?? '')
  const [searchOptions, setSearchOptions] = useState<Option[]>(options)
  const [open, setOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const onSearchRef = useRef(onSearch)
  const optionsRef = useRef(options)
  const searchRequestIdRef = useRef(0)
  const usesServerSearch = options.length > 20 && Boolean(onSearch)
  const visibleOptions = useMemo(() => {
    const sourceOptions = usesServerSearch ? searchOptions : options
    const normalizedQuery = query.trim().toLowerCase()
    const selectedInSource = selectedOption && !sourceOptions.some((option) => option.code === selectedOption.code)
      ? [selectedOption]
      : []

    if (usesServerSearch) {
      const narrowedOptions = normalizedQuery.length === 1
        ? sourceOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
        : sourceOptions

      return [...selectedInSource, ...narrowedOptions.slice(0, OPTION_RENDER_LIMIT)]
    }

    const filteredOptions = normalizedQuery
      ? sourceOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
      : sourceOptions

    return [...selectedInSource, ...filteredOptions.slice(0, OPTION_RENDER_LIMIT)]
  }, [options, query, searchOptions, selectedOption, usesServerSearch])
  const visibleOptionRows = useMemo(() => {
    const rows: Array<{ type: 'group'; label: string } | { type: 'option'; option: Option }> = []
    let currentGroup = ''

    for (const option of visibleOptions) {
      const nextGroup = option.group ?? ''
      if (nextGroup && nextGroup !== currentGroup) {
        rows.push({ type: 'group', label: nextGroup })
        currentGroup = nextGroup
      }
      rows.push({ type: 'option', option })
    }

    return rows
  }, [visibleOptions])

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label)
    }
  }, [selectedOption?.code])

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    optionsRef.current = options

    if (!usesServerSearch || query.trim().length < 2) {
      setSearchOptions(options)
    }
  }, [options, query, usesServerSearch])

  useEffect(() => {
    if (!usesServerSearch || !onSearchRef.current) {
      return
    }

    const searchText = query.trim()

    if (searchText.length < 2) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = searchRequestIdRef.current + 1
      searchRequestIdRef.current = requestId
      setIsSearching(true)
      onSearchRef.current?.(searchText)
        .then((nextOptions) => {
          if (searchRequestIdRef.current === requestId) {
            setSearchOptions(nextOptions)
          }
        })
        .catch(() => {
          if (searchRequestIdRef.current === requestId) {
            setSearchOptions(optionsRef.current)
          }
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setIsSearching(false)
          }
        })
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [query, usesServerSearch])

  function selectOption(option: Option) {
    setQuery(option.label)
    onChange(option.code)
    setOpen(false)
  }

  return (
    <label className={`relative grid min-w-0 font-black text-slate-600 ${compact ? 'gap-1 text-[13px]' : 'gap-2 text-sm'}`}>
      {label}
      <span className="relative">
        <input
          className={`${compact ? 'h-10 text-sm' : 'h-14 text-base'} w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-4 pr-14 font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100`}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 130)
          }}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setOpen(true)

            if (selectedOption && nextQuery !== selectedOption.label) {
              onChange('')
            }
          }}
          placeholder={placeholder}
          title={query}
          value={query}
        />
        <button
          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          type="button"
          title={`Show ${label} options`}
        >
          <ChevronDown size={18} />
        </button>
      </span>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm font-semibold text-slate-800 shadow-xl">
          {isSearching && visibleOptions.length === 0 ? (
            <div className="px-4 py-3 text-slate-400">Searching...</div>
          ) : visibleOptions.length === 0 ? (
            <div className="px-4 py-3 text-slate-400">No matching options.</div>
          ) : visibleOptionRows.map((row) => row.type === 'group' ? (
            <div className="px-4 pb-1 pt-2 text-center text-xs font-black uppercase text-slate-700" key={`group-${row.label}`}>
              -- {row.label} --
            </div>
          ) : (
            <button
              className={`block w-full px-4 py-2.5 text-left transition hover:bg-blue-50 ${
                row.option.code === value ? 'bg-blue-50 text-blue-800' : 'text-slate-800'
              }`}
              key={row.option.code}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(row.option)}
              type="button"
              title={row.option.label}
            >
              {row.option.label}
            </button>
          ))}
        </div>
      ) : null}

    </label>
  )
}

function TextField({ compact = false, label, multiline = false, onChange, placeholder, type = 'text', value }: { compact?: boolean; label: string; multiline?: boolean; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) {
  return (
    <label className={`grid min-w-0 font-black text-slate-600 ${compact ? 'gap-1 text-[13px]' : 'gap-2 text-sm'}`}>
      {label}
      {multiline ? (
        <textarea className={`${compact ? 'min-h-20 text-sm' : 'min-h-24 text-base'} rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100`} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
      ) : (
        <input className={`${compact ? 'h-10 px-3 text-sm' : 'h-14 px-4 text-base'} min-w-0 rounded-lg border border-slate-200 bg-white font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100`} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
      )}
    </label>
  )
}

function ReadonlyField({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <label className={`grid min-w-0 font-black text-slate-600 ${compact ? 'gap-1 text-[13px]' : 'gap-2 text-sm'}`}>
      {label}
      <span className={`${compact ? 'min-h-10 text-sm' : 'min-h-14 text-base'} flex min-w-0 items-center truncate rounded-lg border border-slate-200 bg-slate-100 px-4 font-medium text-slate-700`}>{value}</span>
    </label>
  )
}

function MetaRow({ icon, value }: { icon: ReactNode; value: string }) {
  return <p className="flex min-w-0 items-center gap-3"><span className="shrink-0 text-blue-950">{icon}</span><span className="truncate">{value}</span></p>
}

function StatusPill({ status }: { status: string }) {
  const normalized = normalizeStatus(status)
  const classes = normalized === 'REJECTED'
    ? 'bg-red-50 text-red-700'
    : normalized === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'PENDING' || normalized === 'PENDINGAPPROVAL' || normalized === 'APPROVALPENDING' || normalized === 'CREATED'
        ? 'bg-amber-50 text-amber-700'
        : normalized === 'PENDINGSYNC'
          ? 'bg-blue-50 text-blue-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${classes}`}>{displayIndentStatus(status)}</span>
}

function Alert({ text }: { text: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><XCircle size={16} />{text}</div>
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500 shadow-sm">{label}</div>
}

async function loadMaterialOptions(projectCode: string, warehouseCode = '', search = '', scope: 'project' | 'all' = 'project') {
  const response = await fetchMaterialOptions(projectCode, warehouseCode, search, 500, 0, scope)
  return mapMaterialOptions(response.data)
}

async function loadAllMaterialOptions(projectCode: string, warehouseCode = '', scope: 'project' | 'all' = 'project') {
  if (!projectCode) {
    return []
  }

  const allMaterials: Option[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchMaterialOptions(projectCode, warehouseCode, '', 500, offset, scope)
    allMaterials.push(...mapMaterialOptions(response.data))
    hasMore = Boolean(response.hasMore)
    offset = response.nextOffset ?? allMaterials.length
  }

  return allMaterials
}

async function fetchMaterialOptions(projectCode: string, warehouseCode = '', search = '', limit = 500, offset = 0, scope: 'project' | 'all' = 'project') {
  if (!projectCode && scope !== 'all') {
    return { data: [] }
  }

  const params = new URLSearchParams({
    projectCode,
    limit: String(limit),
    offset: String(offset),
  })

  if (scope === 'all') {
    params.set('scope', 'all')
  }

  if (warehouseCode && scope !== 'all') {
    params.set('warehouseCode', warehouseCode)
  }

  if (search.trim().length >= 2) {
    params.set('search', search.trim())
  }

  const response = await api.get<OptionResponse<{ item_code: string; item_description: string; item_type?: string | null; uom?: string | null; purchase_unit?: string | null; on_hand_qty?: string | number | null }>>(`/api/indents/options/items?${params}`)
  return response.data
}

function mapMaterialOptions(materials: Array<{ item_code: string; item_description: string; item_type?: string | null; uom?: string | null; purchase_unit?: string | null; on_hand_qty?: string | number | null }>) {
  return materials.map((material) => ({
    code: material.item_code,
    label: formatMaterialLabel(material.item_code, material.item_type, material.item_description),
    description: material.item_description,
    meta: { itemType: material.item_type, uom: material.uom || material.purchase_unit || '', onHandQty: material.on_hand_qty },
  }))
}

function formatValidationIssues(issues: unknown) {
  if (!issues || typeof issues !== 'object') {
    return ''
  }

  const fieldErrors = 'fieldErrors' in issues
    ? (issues as { fieldErrors?: Record<string, string[]> }).fieldErrors
    : undefined
  const formErrors = 'formErrors' in issues
    ? (issues as { formErrors?: string[] }).formErrors
    : undefined
  const messages = [
    ...(formErrors ?? []),
    ...Object.entries(fieldErrors ?? {}).flatMap(([field, errors]) =>
      errors.map((message) => `${field}: ${message}`),
    ),
  ]

  return messages[0] ?? ''
}

async function loadActivityOptions(projectCode: string, search = '') {
  if (!projectCode) {
    return []
  }

  const params = new URLSearchParams({
    projectCode,
    limit: '500',
  })

  if (search.trim().length >= 2) {
    params.set('search', search.trim())
  }

  const response = await api.get<OptionResponse<{ activity_code: string; description: string }>>(`/api/indents/options/activities?${params}`)
  return response.data.data.map((activity) => ({
    code: activity.activity_code,
    label: `${activity.activity_code} - ${activity.description}`,
    description: activity.description,
  }))
}

async function loadOrderOptions(projectCode: string, search = '') {
  if (!projectCode) {
    return []
  }

  const params = new URLSearchParams({
    projectCode,
    limit: search.trim().length >= 2 ? '80' : '600',
  })

  if (search.trim().length >= 2) {
    params.set('search', search.trim())
  }

  const response = await api.get<OptionResponse<{
    order_no: string
    order_type: string
    order_group?: string
    description: string
    item_code?: string | null
    item_description?: string | null
    serial_number?: string | null
    status?: string | null
  }>>(`/api/indents/options/orders?${params}`)

  return response.data.data.map((order) => ({
    code: `${order.order_type}:${order.order_no}`,
    label: formatOrderLabel(order.order_no, order.status, order.description),
    description: order.description,
    group: order.order_group ?? (order.order_type === 'Rental_Order' ? 'Rental Orders' : 'Service Orders'),
    meta: {
      orderNo: order.order_no,
      orderType: order.order_type,
      equipment: formatOrderEquipment(order.item_code, order.item_description, order.serial_number),
    },
  }))
}

async function loadDeliveryPointOptions(projectCode: string, addressCode = '', search = '', activityCode = '') {
  if (!projectCode) {
    return []
  }

  const params = new URLSearchParams({
    projectCode,
    limit: search.trim().length >= 2 ? '50' : '21',
  })

  if (addressCode) {
    params.set('addressCode', addressCode)
  }

  if (activityCode) {
    params.set('activityCode', activityCode)
  }

  if (search.trim().length >= 2) {
    params.set('search', search.trim())
  }

  const response = await api.get<OptionResponse<{ address_code: string; address_description: string; delivery_point: string; description_1?: string | null }>>(`/api/indents/options/delivery-points?${params}`)
  return response.data.data.map((deliveryPoint) => ({
    code: deliveryPoint.delivery_point,
    label: `${deliveryPoint.address_code} - ${deliveryPoint.delivery_point}${deliveryPoint.description_1 ? ` - ${deliveryPoint.description_1}` : ''}`,
    description: deliveryPoint.description_1 || deliveryPoint.address_description,
    meta: {
      addressCode: deliveryPoint.address_code,
      addressDescription: deliveryPoint.address_description,
    },
  }))
}

function mergeOptions(currentOptions: Option[], nextOptions: Option[]) {
  const byCode = new Map(currentOptions.map((option) => [option.code, option]))

  for (const option of nextOptions) {
    byCode.set(option.code, option)
  }

  return [...byCode.values()]
}

function getFieldRole(user: { role?: string; primary_role?: string; responsibility?: string } | null): 'SIE' | 'SER' {
  const role = String(user?.role ?? user?.primary_role ?? user?.responsibility ?? '').trim().toUpperCase()

  if (
    role === 'STE' ||
    role.includes('SITE ENGINEER') ||
    role.includes('STE ENGINEER') ||
    role.includes('(STE)') ||
    role.includes('SITE INCHARGE ENGINEER') ||
    role.includes('SITE IN-CHARGE ENGINEER') ||
    role.includes('SITE IN CHARGE ENGINEER')
  ) {
    return 'SIE'
  }

  return role === 'SER' || role === 'SRE' || role.includes('SER') || role.includes('SRE') ? 'SER' : 'SIE'
}

function readDrafts(): IndentDraft[] {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as IndentDraft[]
  } catch {
    return []
  }
}

function writeDrafts(drafts: IndentDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
}

function upsertDraft(draft: IndentDraft) {
  const drafts = readDrafts().filter((item) => item.id !== draft.id)
  writeDrafts([draft, ...drafts])
}

function removeDraft(draftId: string) {
  writeDrafts(readDrafts().filter((draft) => draft.id !== draftId))
}

function readPendingSyncRecords(): PendingSyncRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_SYNC_INDENTS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((record) => {
        if (record?.transaction) {
          return record as PendingSyncRecord
        }

        return { transaction: record as IndentTransaction }
      })
      .filter((record) => record.transaction?.id)
  } catch {
    return []
  }
}

function readPendingSyncIndents(): IndentTransaction[] {
  return readPendingSyncRecords().map((record) => record.transaction)
}

function writePendingSyncRecords(records: PendingSyncRecord[]) {
  localStorage.setItem(PENDING_SYNC_INDENTS_KEY, JSON.stringify(records))
}

function upsertPendingSyncIndent(transaction: IndentTransaction, payload?: IndentSubmitPayload) {
  const records = readPendingSyncRecords().filter((record) => record.transaction.id !== transaction.id)
  writePendingSyncRecords([{ transaction, payload }, ...records])
}

function removePendingSyncIndent(indentId: string) {
  writePendingSyncRecords(readPendingSyncRecords().filter((record) => record.transaction.id !== indentId))
}

function mergePendingSyncIndents(serverIndents: IndentTransaction[], pendingIndents: IndentTransaction[]) {
  const serverRequestIds = new Set(serverIndents.map((indent) => String(indent.app_request_id ?? '').trim()).filter(Boolean))
  const visiblePendingIndents = pendingIndents.filter((indent) => !serverRequestIds.has(String(indent.app_request_id ?? '').trim()))

  return [...visiblePendingIndents, ...serverIndents]
}

async function syncPendingSyncIndents() {
  if (!navigator.onLine) {
    return
  }

  const records = readPendingSyncRecords()

  for (const record of records) {
    if (!record.payload) {
      continue
    }

    try {
      await api.post('/api/indents', record.payload)
      removePendingSyncIndent(record.transaction.id)
    } catch {
      // Keep the record queued for the next online retry.
    }
  }
}

function draftToTransaction(draft: IndentDraft): IndentTransaction {
  const isReturnDraft = isIssueReturnType(draft.indentType)

  return {
    id: draft.id,
    app_request_id: draft.requestNo,
    indent_no: 'Indent No. will be assigned after submission',
    project_code: draft.projectCode,
    project_name: draft.projectLabel.replace(`${draft.projectCode} - `, ''),
    source_warehouse: draft.warehouseCode ?? '-',
    source_warehouse_name: draft.warehouseLabel?.replace(`${draft.warehouseCode} - `, ''),
    source_location: draft.sourceLocationLabel ?? draft.sourceLocationCode,
    delivery_location: isReturnDraft ? draft.warehouseCode : draft.sourceLocationCode,
    delivery_location_name: isReturnDraft ? draft.warehouseLabel?.replace(`${draft.warehouseCode} - `, '') : draft.sourceLocationLabel,
    indent_type: draft.indentType,
    to_entity_type: draft.engineerType,
    to_entity_id: draft.toEntityLabel ?? draft.toEntityId,
    status: 'Created',
    created_at: draft.createdAt,
    items: draft.items.map((item, index) => ({
      id: item.id,
      line_number: index + 1,
      item_code: item.materialCode,
      item_name: item.materialDesc,
      uom: item.uom,
      on_hand_qty: item.onHandQty,
      required_qty: item.requestedQty,
      work_type: item.workType,
      activity_code: item.activityCode,
      location_code: item.locationCode,
      remarks: item.remarks,
      attachment_url: serializeAttachments(item.attachments ?? legacyDraftAttachments(item.attachmentName)),
    })),
  }
}

function isOfflineSubmitError(error: unknown) {
  if (!navigator.onLine) {
    return true
  }

  if (!error || typeof error !== 'object') {
    return false
  }

  const requestError = error as { request?: unknown; response?: unknown; code?: string }
  return Boolean(requestError.request && !requestError.response)
    || requestError.code === 'ERR_NETWORK'
}

async function uploadIndentAttachment(file: File): Promise<DraftAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post<{ data: DraftAttachment }>('/api/indents/attachments', formData)
  return response.data.data
}

function serializeAttachments(attachments: DraftAttachment[]) {
  if (attachments.length === 0) {
    return null
  }

  return JSON.stringify(attachments)
}

function legacyDraftAttachments(attachmentName?: string) {
  const cleanName = String(attachmentName ?? '').trim()
  return cleanName ? [{ name: cleanName, url: cleanName }] : []
}

function resolveAttachmentHref(url: string) {
  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url
  }

  const baseUrl = api.defaults.baseURL ?? window.location.origin
  return new URL(url, baseUrl).toString()
}

function buildRequestNo() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]
  return `REQ-${parts.join('')}`
}

function countStatus(rows: IndentTransaction[], statuses: string[]) {
  const allowed = new Set(statuses.map(normalizeStatus))
  return rows.filter((row) => allowed.has(normalizeStatus(row.status))).length
}

function isIssueReturnType(indentType?: string | null) {
  return normalizeStatus(indentType ?? '') === 'ISSUERETURN'
}

function normalizeStatus(status: string) {
  return String(status ?? '').replace(/\s+/g, '').trim().toUpperCase()
}

function isApprovedStatus(status: string) {
  const normalized = normalizeStatus(status)
  return normalized === 'APPROVED' || normalized === 'ACCEPTED'
}

function displayIndentStatus(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized === 'CREATED') return 'Created'
  if (normalized === 'PENDINGSYNC') return 'Pending Sync'
  if (normalized === 'APPROVED' || normalized === 'ACCEPTED') return 'Approved'
  if (normalized === 'REJECTED') return 'Rejected'
  return 'Pending'
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

function formatPair(code?: string | null, description?: string | null) {
  const cleanCode = String(code ?? '').trim()
  const cleanDescription = String(description ?? '').trim()
  if (cleanCode && cleanDescription && cleanCode !== '-') return `${cleanCode} - ${cleanDescription}`
  return cleanCode || cleanDescription || '-'
}

function printFieldIndentPdf(indent: IndentTransaction) {
  const printWindow = window.open('about:blank', '_blank', 'width=1100,height=800')

  if (!printWindow) {
    return
  }

  const leftDetailRows = [
    ['Date', formatDate(indent.created_at)],
    ['Project', formatPair(indent.project_code, indent.project_name)],
  ]
  const middleDetailRows = [
    ['Warehouse', formatPair(indent.source_warehouse, indent.source_warehouse_name)],
    ['Location', indent.source_location || indent.delivery_location || '-'],
  ]
  const rightDetailRows = [
    ['Type', indent.indent_type || '-'],
    ['To', indent.to_entity_id || indent.to_entity_type || '-'],
    ['Delivery', formatPair(indent.delivery_location, indent.delivery_location_name)],
    ['Status', displayIndentStatus(indent.status)],
  ]

  const itemRows = (indent.items ?? []).map((item) => `
    <tr>
      <td>${escapeHtml(String(item.line_number ?? '-'))}</td>
      <td>${escapeHtml(item.work_type || indent.indent_type || '-')}</td>
      <td>${escapeHtml(item.activity_code || '-')}</td>
      <td>${escapeHtml(formatPair(item.item_code, item.item_name))}</td>
      <td>${escapeHtml(item.uom || '-')}</td>
      <td>${escapeHtml(formatQty(item.approved_qty ?? item.required_qty))}</td>
      <td>${escapeHtml(item.remarks || '-')}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(indent.app_request_id || indent.indent_no)} - Indent Details</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 18px 22px; }
          .header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          .document-title { margin: 0; text-align: center; color: #0f172a; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; }
          .request-no { grid-column: 3; justify-self: end; text-align: right; font-size: 12px; font-weight: 700; }
          .details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 14px; border-bottom: 1px solid #dbe3ef; padding-bottom: 10px; }
          .detail-row { display: grid; grid-template-columns: 82px 8px 1fr; gap: 4px; margin-bottom: 4px; font-size: 10.5px; line-height: 1.25; }
          .label, .colon { color: #334155; font-weight: 800; }
          .value { color: #0f172a; font-weight: 600; overflow-wrap: anywhere; }
          h2 { margin: 9px 0 7px; font-size: 14px; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; }
          th { background: #f1f5f9; color: #475569; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; }
          th, td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; word-break: break-word; }
          th:nth-child(1), td:nth-child(1) { width: 6%; }
          th:nth-child(2), td:nth-child(2) { width: 12%; }
          th:nth-child(3), td:nth-child(3) { width: 12%; }
          th:nth-child(4), td:nth-child(4) { width: 38%; }
          th:nth-child(5), td:nth-child(5) { width: 8%; }
          th:nth-child(6), td:nth-child(6) { width: 10%; }
          th:nth-child(7), td:nth-child(7) { width: 20%; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <header class="header">
          <div></div>
          <h1 class="document-title">Indent Request Details</h1>
          <div class="request-no">
            <div>${escapeHtml(indent.app_request_id || '-')}</div>
            <div>${escapeHtml(indent.indent_no || '-')}</div>
          </div>
        </header>
        <section class="details">
          ${[leftDetailRows, middleDetailRows, rightDetailRows].map((group) => `
            <div>
              ${group.map(([label, value]) => `
                <div class="detail-row">
                  <div class="label">${escapeHtml(label)}</div>
                  <div class="colon">:</div>
                  <div class="value">${escapeHtml(value)}</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </section>
        <h2>Item Details</h2>
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Work Type</th>
              <th>Activity</th>
              <th>Material</th>
              <th>UOM</th>
              <th>Approved Qty</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="7">No item details found.</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.setTimeout(() => printWindow.print(), 250)
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatQty(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN') : String(value ?? '-')
}

function formatMaterialLabel(itemCode: string, itemType?: string | null, itemDescription?: string | null) {
  const code = String(itemCode ?? '').trim()
  const type = String(itemType ?? '').trim()
  const description = String(itemDescription ?? '').trim()
  const details = type && description && !description.toLowerCase().startsWith(`${type.toLowerCase()} -`)
    ? `${type} - ${description}`
    : description || type

  return [code, details].filter(Boolean).join(' - ')
}

function formatOrderLabel(orderNo: string, status?: string | null, description?: string | null) {
  const statusText = String(status ?? '').trim()
  const descriptionText = String(description ?? '').trim()

  if (descriptionText && descriptionText !== orderNo && statusText) {
    return `${orderNo} - ${descriptionText} - ${statusText}`
  }

  if (descriptionText && descriptionText !== orderNo) {
    return `${orderNo} - ${descriptionText}`
  }

  if (statusText) {
    return `${orderNo} - ${statusText}`
  }

  return orderNo
}

function formatOrderEquipment(itemCode?: string | null, itemDescription?: string | null, serialNumber?: string | null) {
  const description = String(itemDescription ?? '').trim()
  const code = String(itemCode ?? '').trim()
  const serial = String(serialNumber ?? '').trim()
  const equipment = description || code

  return [equipment, serial].filter(Boolean).join(' - ') || 'Auto-filled'
}
