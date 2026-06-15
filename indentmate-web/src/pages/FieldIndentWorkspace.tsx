import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Folder,
  MapPin,
  PackagePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  Warehouse,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
    required_qty: string | number
    work_type?: string | null
    activity_code?: string | null
    location_code?: string | null
    remarks?: string | null
    attachment_url?: string | null
  }>
}

const DRAFTS_KEY = 'indent_field_drafts'
const darkBlue = '#123468'
const OPTION_RENDER_LIMIT = 80

export function FieldIndentHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [indents, setIndents] = useState<IndentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const drafts = readDrafts()
  const role = getFieldRole(user)
  const displayName = user?.name?.trim() || user?.login_name?.trim() || 'Field User'

  async function loadIndents() {
    setIsLoading(true)
    try {
      const response = await api.get<{ data: IndentTransaction[] }>('/api/indents/mine')
      setIndents(response.data.data)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to load your indent dashboard.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIndents()
  }, [])

  const dashboardRows = useMemo(() => {
    const draftRows = drafts.map(draftToTransaction)
    return [...draftRows, ...indents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [drafts, indents])
  const filteredRows = dashboardRows.filter((row) => activeFilter === 'All' || normalizeStatus(row.status) === normalizeStatus(activeFilter))

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-blue-950/10 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-white" style={{ backgroundColor: darkBlue }}>
          <div className="flex min-w-0 items-center gap-3">
            <button className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 transition hover:bg-white/15" onClick={() => navigate('/')} type="button" title="Back">
              <ArrowLeft size={22} />
            </button>
            <h2 className="truncate text-xl font-bold">Indent Home</h2>
          </div>
          <div className="flex gap-2">
            <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/15" onClick={loadIndents} type="button" title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="grid h-11 w-11 place-items-center rounded-lg bg-orange-400 text-slate-950 transition hover:bg-orange-300" onClick={() => navigate('/indent-create')} type="button" title="Create indent">
              <Plus size={23} />
            </button>
          </div>
        </div>
        <button className="flex w-full items-center justify-between gap-4 border-t border-white/10 px-4 py-4 text-left text-white" style={{ backgroundColor: darkBlue }} type="button">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-orange-300 bg-[#253f78] text-lg font-black">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{displayName}</p>
              <p className="mt-1 text-xs text-blue-100">ID {user?.login_name || user?.employee_id || '-'} <span className="ml-2 rounded bg-yellow-400 px-2 py-0.5 font-bold text-slate-900">{role}</span></p>
            </div>
          </div>
        </button>
      </div>

      {errorMessage ? <Alert text={errorMessage} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <MetricBox count={countStatus(dashboardRows, ['Pending', 'PendingApproval', 'ApprovalPending'])} label="Pending for Approval" tone="muted" />
        <MetricBox count={dashboardRows.length} label="Indents Raised" tone="blue" />
        <MetricBox count={countStatus(dashboardRows, ['Rejected'])} label="Rejected Indents" tone="muted" />
        <MetricBox count={countStatus(dashboardRows, ['Approved'])} label="Approved Indents" tone="green" />
      </div>

      <div className="flex flex-wrap gap-3">
        {['All', 'Created', 'Pending', 'Approved', 'Rejected'].map((filter) => (
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
              normalizeStatus(indent.status) === 'CREATED' || normalizeStatus(indent.status) === 'DRAFT'
                ? 'border-emerald-300 bg-emerald-100/70'
                : 'border-slate-200 bg-white'
            }`}
            key={indent.id}
            onClick={() => indent.id.startsWith('draft-') ? navigate(`/indent-drafts/${indent.id}`) : navigate(`/indent-workspace/indents/${indent.id}`)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-900/10 pb-3">
              <p className="font-bold text-slate-900">{normalizeStatus(indent.status) === 'PENDING' ? 'IND: Pending ERP Sync' : 'Indent Request'}</p>
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
    if (role !== 'SIE' || !form.projectCode || !form.warehouseCode) {
      setLocations([])
      setPartners([])
      return
    }

    api.get<{ data: Array<{ location_code: string; description: string }> }>(`/api/indents/options/warehouse-locations?projectCode=${encodeURIComponent(form.projectCode)}&warehouseCode=${encodeURIComponent(form.warehouseCode)}`)
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
          sourceLocationCode: nextLocations.some((location) => location.code === current.sourceLocationCode) ? current.sourceLocationCode : nextLocations[0]?.code ?? '',
          toEntityId: '',
        }))
      })
      .catch(() => setErrorMessage('Unable to load warehouse locations.'))
  }, [form.projectCode, form.warehouseCode, role])

  useEffect(() => {
    if (role !== 'SIE' || !form.projectCode || !form.sourceLocationCode) {
      setPartners([])
      return
    }

    loadContractorOptions(form.projectCode, form.sourceLocationCode)
      .then((nextPartners) => {
        setPartners(nextPartners)
        setForm((current) => ({
          ...current,
          toEntityId: nextPartners.some((partner) => partner.code === current.toEntityId) ? current.toEntityId : '',
        }))
      })
      .catch(() => setErrorMessage('Unable to load contractor options.'))
  }, [form.projectCode, form.sourceLocationCode, role])

  function createDraft() {
    const selectedProject = projects.find((project) => project.code === form.projectCode)
    const selectedWarehouse = warehouses.find((warehouse) => warehouse.code === form.warehouseCode)
    const selectedLocation = locations.find((location) => location.code === form.sourceLocationCode)
    const selectedPartner = partners.find((partner) => partner.code === form.toEntityId)
    const selectedOrder = orders.find((order) => order.code === form.orderNo)

    if (!selectedProject) {
      setErrorMessage('Select a project.')
      return
    }

    if (role === 'SIE' && (!selectedWarehouse || !selectedLocation)) {
      setErrorMessage('Select warehouse and from location.')
      return
    }

    if (role === 'SIE' && partners.length > 0 && !selectedPartner) {
      setErrorMessage('Select contractor / BP.')
      return
    }

    if (role === 'SER' && !selectedOrder) {
      setErrorMessage('Select a service or rental order.')
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
      toEntityId: role === 'SIE' ? selectedPartner?.code : selectedOrder?.code,
      toEntityLabel: role === 'SIE' ? selectedPartner?.label : selectedOrder?.label,
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
      <div className="mx-auto grid w-full max-w-[560px] gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 border-b border-slate-100 pb-4 text-lg font-black text-slate-900">{role} Header Details</h3>
          <div className="grid gap-4">
            <OptionField label="Project *" value={form.projectCode} onChange={(value) => setForm((current) => ({ ...current, projectCode: value }))} options={projects} placeholder="Select Project" />
            {role === 'SER' ? (
              <>
                <OptionField
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
                <ReadonlyField label="Equipment" value={String(orders.find((order) => order.code === form.orderNo)?.meta?.equipment ?? 'Auto-filled after order selection')} />
              </>
            ) : null}
            <OptionField label="Type of Indent *" value={form.indentType} onChange={(value) => setForm((current) => ({ ...current, indentType: value }))} options={[
              { code: 'Issue', label: 'Issue' },
              { code: 'Issue Return', label: 'Issue Return' },
            ]} />
            {role === 'SIE' ? (
              <>
                <OptionField label="Warehouse *" value={form.warehouseCode} onChange={(value) => setForm((current) => ({ ...current, warehouseCode: value }))} options={warehouses} placeholder="Select warehouse" />
                <OptionField label="From (Warehouse Location) *" value={form.sourceLocationCode} onChange={(value) => setForm((current) => ({ ...current, sourceLocationCode: value }))} options={locations} placeholder="Select from location" />
                {partners.length > 0 ? (
                  <OptionField
                    label="To (Contractor / BP)"
                    value={form.toEntityId}
                    onChange={(value) => setForm((current) => ({ ...current, toEntityId: value }))}
                    onSearch={(search) => loadContractorOptions(form.projectCode, form.sourceLocationCode, search).then((nextPartners) => {
                      setPartners((current) => mergeOptions(current, nextPartners))
                      return nextPartners
                    })}
                    options={partners}
                    placeholder="Select contractor"
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {errorMessage ? <p className="mt-4 text-sm font-bold text-red-600">{errorMessage}</p> : null}
        </div>
        <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-950 text-base font-black text-white shadow-sm transition hover:bg-blue-900" onClick={createDraft} type="button">
          <FileText size={18} />
          Create Request
        </button>
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
    try {
      const response = await api.post<{ data: IndentTransaction }>('/api/indents', {
        app_request_id: draft.requestNo,
        project_code: draft.projectCode,
        source_warehouse: draft.warehouseCode ?? null,
        source_location: draft.sourceLocationCode ?? draft.warehouseCode ?? null,
        delivery_location: draft.sourceLocationCode ?? draft.projectCode,
        requirement_type: draft.indentType,
        indent_type: draft.indentType,
        engineerType: draft.engineerType === 'SER' ? 'SER' : 'SIE',
        orderNo: draft.orderNo ?? draft.toEntityId ?? null,
        orderType: draft.orderType ?? null,
        equipmentDisplay: draft.equipmentDisplay ?? null,
        status: 'PendingApproval',
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
          attachmentUrl: item.attachmentName ? `attachment://${item.attachmentName}` : null,
        })),
      })
      removeDraft(draft.id)
      navigate(`/indent-workspace/indents/${response.data.data.id}`, {
        replace: true,
        state: { indent: response.data.data },
      })
    } catch (error) {
      const serverMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : ''
      setMessage(serverMessage || 'Unable to submit this indent.')
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

  return (
    <MobileShell title="Indent Details" onBack={() => navigate('/indent-workspace')}>
      <IndentSummaryCard indent={draftToTransaction(draft)} />
      <div className="mt-7 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase text-slate-900">Items</h3>
          <p className="mt-4 text-sm text-slate-400">{draft.items.length}/20 added</p>
        </div>
        <button className="grid h-12 w-12 place-items-center rounded-lg bg-blue-950 text-white transition hover:bg-blue-900" onClick={() => navigate(`/indent-drafts/${draft.id}/items/new`)} type="button" title="Add item">
          <Plus size={22} />
        </button>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white shadow-sm">
        {draft.items.length === 0 ? (
          <p className="px-4 py-7 text-center text-sm text-slate-400">No items added yet. Tap + to add an item.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {draft.items.map((item) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto]" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-black text-slate-900">{item.materialCode} - {item.materialDesc}</p>
                  <p className="mt-1 text-sm text-slate-500">Qty: {item.requestedQty} {item.uom} · {item.workType}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.locationLabel || draft.sourceLocationLabel || '-'} · {item.activityLabel || '-'}</p>
                </div>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-50" onClick={() => deleteItem(item.id)} type="button">
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {message ? <p className="mt-4 text-sm font-bold text-red-600">{message}</p> : null}
      <div className="mt-8 grid gap-3">
        <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-950 text-base font-black text-white transition hover:bg-blue-900 disabled:opacity-60" disabled={isSubmitting} onClick={submitDraft} type="button">
          <Check size={19} />
          {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
        </button>
        <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-blue-950 bg-white text-base font-black text-blue-950 transition hover:bg-slate-50" onClick={() => setMessage('Draft saved on this device.')} type="button">
          <Save size={19} />
          Save as Draft
        </button>
      </div>
    </MobileShell>
  )
}

export function FieldIndentSubmittedDetails() {
  const { indentId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateIndent = (location.state as { indent?: IndentTransaction } | null)?.indent ?? null
  const [indent, setIndent] = useState<IndentTransaction | null>(() => stateIndent)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (stateIndent) {
      return
    }

    api.get<{ data: IndentTransaction }>(`/api/indents/mine/${encodeURIComponent(indentId)}`)
      .then((response) => setIndent(response.data.data))
      .catch(() => setErrorMessage('Unable to load indent details.'))
  }, [indentId, stateIndent])

  return (
    <MobileShell title="Indent Details" onBack={() => navigate('/indent-workspace')}>
      {errorMessage ? <Alert text={errorMessage} /> : null}
      {!indent ? <EmptyState label={errorMessage ? 'No details available.' : 'Loading indent details...'} /> : (
        <>
          <IndentSummaryCard indent={indent} />
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
  const { draftId = '' } = useParams()
  const navigate = useNavigate()
  const draft = readDrafts().find((item) => item.id === draftId) ?? null
  const [materials, setMaterials] = useState<Option[]>([])
  const [activities, setActivities] = useState<Option[]>([])
  const [locations, setLocations] = useState<Option[]>([])
  const [partners, setPartners] = useState<Option[]>([])
  const [form, setForm] = useState({
    workType: 'BOQ',
    locationCode: draft?.sourceLocationCode ?? '',
    activityCode: '',
    materialCode: '',
    requestedQty: '',
    toBusinessPartner: draft?.toEntityId ?? '',
    remarks: '',
    attachmentName: '',
  })
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!draft) return
    const sourceDraft = draft

    async function loadOptions() {
      const materialScope = sourceDraft.engineerType === 'SER' ? 'all' : 'project'
      const initialMaterials = await loadMaterialOptions(sourceDraft.projectCode, sourceDraft.engineerType === 'SIE' ? sourceDraft.warehouseCode ?? '' : '', '', materialScope)
      setMaterials(initialMaterials)

      void loadAllMaterialOptions(sourceDraft.projectCode, sourceDraft.engineerType === 'SIE' ? sourceDraft.warehouseCode ?? '' : '', materialScope)
        .then((allMaterials) => setMaterials((current) => mergeOptions(current, allMaterials)))
        .catch(() => undefined)

      if (sourceDraft.engineerType !== 'SIE') {
        return
      }

      const [activityResponse, locationResponse, partnerResponse] = await Promise.all([
        api.get<OptionResponse<{ activity_code: string; description: string }>>(`/api/indents/options/activities?projectCode=${encodeURIComponent(sourceDraft.projectCode)}&limit=500`),
        api.get<{ data: Array<{ location_code: string; description: string }> }>(`/api/indents/options/warehouse-locations?projectCode=${encodeURIComponent(sourceDraft.projectCode)}&warehouseCode=${encodeURIComponent(sourceDraft.warehouseCode ?? '')}`),
        loadDeliveryPointOptions(sourceDraft.projectCode, ''),
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
      setPartners(partnerResponse)
      setForm((current) => ({
        ...current,
        materialCode: current.materialCode,
        activityCode: current.activityCode,
      }))
    }

    loadOptions().catch(() => setErrorMessage('Unable to load item options.'))
  }, [draftId])

  if (!draft) {
    return <MobileShell title="Add New Item" onBack={() => navigate('/indent-workspace')}><EmptyState label="Draft not found." /></MobileShell>
  }
  const activeDraft = draft

  const selectedMaterial = materials.find((material) => material.code === form.materialCode)
  const selectedActivity = activities.find((activity) => activity.code === form.activityCode)
  const selectedLocation = locations.find((location) => location.code === form.locationCode) ?? {
    code: activeDraft.sourceLocationCode ?? '',
    label: activeDraft.sourceLocationLabel ?? '',
  }
  const selectedPartner = partners.find((partner) => partner.code === form.toBusinessPartner)

  function saveItem() {
    if (!selectedMaterial || !form.requestedQty || Number(form.requestedQty) <= 0) {
      setErrorMessage('Select material and enter a valid requested quantity.')
      return
    }

    const duplicate = activeDraft.items.some((item) =>
      item.materialCode === selectedMaterial.code &&
      item.locationCode === selectedLocation.code &&
      item.activityCode === selectedActivity?.code &&
      item.toBusinessPartner === (selectedPartner?.code ?? activeDraft.toEntityId)
    )

    if (duplicate) {
      setErrorMessage('Item already present for the same location, activity, and business partner.')
      return
    }

    const nextDraft: IndentDraft = {
      ...activeDraft,
      items: [...activeDraft.items, {
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
        toBusinessPartner: selectedPartner?.code ?? activeDraft.toEntityId,
        toBusinessPartnerLabel: selectedPartner?.label ?? activeDraft.toEntityLabel,
        remarks: form.remarks,
        attachmentName: form.attachmentName,
      }],
    }
    upsertDraft(nextDraft)
    navigate(`/indent-drafts/${activeDraft.id}`)
  }

  return (
    <MobileShell title="Add New Item" onBack={() => navigate(`/indent-drafts/${draft.id}`)}>
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
            {draft.engineerType === 'SIE' ? (
              <OptionField
                label="To (Business Partner)"
                value={form.toBusinessPartner}
                onChange={(value) => setForm((current) => ({ ...current, toBusinessPartner: value }))}
                onSearch={(search) => loadDeliveryPointOptions(activeDraft.projectCode, '', search).then((nextPartners) => {
                  setPartners((current) => mergeOptions(current, nextPartners))
                  return nextPartners
                })}
                options={partners}
                placeholder="Select business partner"
              />
            ) : null}
            <TextField label="Remarks" value={form.remarks} onChange={(value) => setForm((current) => ({ ...current, remarks: value }))} placeholder="Enter remarks" multiline />
            <div>
              <p className="mb-2 text-sm font-black text-slate-600">Attachment</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-blue-950 transition hover:bg-slate-100">
                  <Upload size={16} />
                  File
                  <input className="sr-only" type="file" onChange={(event) => setForm((current) => ({ ...current, attachmentName: event.target.files?.[0]?.name ?? '' }))} />
                </label>
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-blue-950 transition hover:bg-slate-100" onClick={() => setForm((current) => ({ ...current, attachmentName: 'camera-capture.jpg' }))} type="button">
                  <Paperclip size={16} />
                  Camera
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">{form.attachmentName || 'Max attachment size: 5 MB'}</p>
            </div>
          </div>
          {errorMessage ? <p className="mt-4 text-sm font-bold text-red-600">{errorMessage}</p> : null}
        </div>
        <button className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-950 text-base font-black text-white transition hover:bg-blue-900" onClick={saveItem} type="button">
          <Check size={19} />
          Save Item
        </button>
      </div>
    </MobileShell>
  )
}

function MobileShell({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return (
    <section className="-m-4 min-h-[calc(100vh-74px)] bg-[#f4f7fb] sm:-m-6 lg:-m-8">
      <div className="px-5 pt-6 lg:px-8">
        <button className="grid h-11 w-11 place-items-center rounded-lg bg-blue-950 text-white shadow-sm transition hover:bg-blue-900" onClick={onBack} type="button" title={`Back from ${title}`}>
          <ArrowLeft size={21} />
        </button>
      </div>
      <div className="px-5 py-7 lg:px-8">{children}</div>
    </section>
  )
}

function IndentSummaryCard({ indent }: { indent: IndentTransaction }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Request ID</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">{indent.app_request_id || indent.indent_no}</h3>
        </div>
        <StatusPill status={indent.status} />
      </div>
      <p className="mt-4 text-sm font-black text-slate-600">INDENT : {indent.indent_no === 'Indent No. will be assigned after submission' ? indent.indent_no : indent.indent_no}</p>
      <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
        <MetaRow icon={<CalendarDays size={17} />} value={formatDate(indent.created_at)} />
        <MetaRow icon={<Folder size={17} />} value={formatPair(indent.project_code, indent.project_name)} />
        <MetaRow icon={<Warehouse size={17} />} value={formatPair(indent.source_warehouse, indent.source_warehouse_name)} />
        <MetaRow icon={<MapPin size={17} />} value={indent.source_location || indent.delivery_location || '-'} />
        <MetaRow icon={<Send size={17} />} value={indent.indent_type || '-'} />
        {indent.to_entity_id ? <MetaRow icon={<Building2 size={17} />} value={indent.to_entity_id} /> : null}
      </div>
    </div>
  )
}

function MetricBox({ count, label, tone }: { count: number; label: string; tone: 'blue' | 'green' | 'muted' }) {
  const toneClasses = {
    blue: 'border-l-blue-950 bg-white text-blue-950',
    green: 'border-l-emerald-500 bg-emerald-50 text-emerald-700',
    muted: 'border-l-slate-100 bg-white text-slate-300',
  }
  return (
    <button className={`min-h-24 rounded-lg border border-slate-200 border-l-4 p-4 text-left shadow-sm ${toneClasses[tone]}`} type="button">
      <span className="block text-4xl font-light">{count}</span>
      <span className="mt-2 block text-sm font-semibold text-slate-500">{label}</span>
    </button>
  )
}

function OptionField({
  label,
  onChange,
  onSearch,
  options,
  placeholder = 'Select',
  value,
}: {
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
    <label className="relative grid gap-2 text-sm font-black text-slate-600">
      {label}
      <span className="relative">
        <input
          className="h-14 w-full rounded-lg border border-slate-200 bg-white px-4 pr-14 text-base font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            >
              {row.option.label}
            </button>
          ))}
        </div>
      ) : null}

    </label>
  )
}

function TextField({ label, multiline = false, onChange, placeholder, type = 'text', value }: { label: string; multiline?: boolean; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-600">
      {label}
      {multiline ? (
        <textarea className="min-h-24 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
      ) : (
        <input className="h-14 rounded-lg border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
      )}
    </label>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-600">
      {label}
      <span className="flex min-h-14 items-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-base font-medium text-slate-700">{value}</span>
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
      : normalized === 'PENDING' || normalized === 'PENDINGAPPROVAL'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${classes}`}>{status}</span>
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

  const response = await api.get<OptionResponse<{ item_code: string; item_description: string; item_type?: string | null; uom: string }>>(`/api/indents/options/items?${params}`)
  return response.data
}

function mapMaterialOptions(materials: Array<{ item_code: string; item_description: string; item_type?: string | null; uom: string }>) {
  return materials.map((material) => ({
    code: material.item_code,
    label: formatMaterialLabel(material.item_code, material.item_type, material.item_description),
    description: material.item_description,
    meta: { itemType: material.item_type, uom: material.uom },
  }))
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

async function loadContractorOptions(projectCode: string, locationCode = '', search = '', activityCode = '') {
  if (!projectCode) {
    return []
  }

  const params = new URLSearchParams({
    projectCode,
    limit: search.trim().length >= 2 ? '50' : '21',
  })

  if (locationCode) {
    params.set('locationCode', locationCode)
  }

  if (activityCode) {
    params.set('activityCode', activityCode)
  }

  if (search.trim().length >= 2) {
    params.set('search', search.trim())
  }

  const response = await api.get<OptionResponse<{ business_partner_code: string; business_partner_name: string }>>(`/api/indents/options/contractors?${params}`)
  return response.data.data.map((partner) => ({
    code: partner.business_partner_code,
    label: `${partner.business_partner_code} - ${partner.business_partner_name}`,
    description: partner.business_partner_name,
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

async function loadDeliveryPointOptions(projectCode: string, addressCode = '', search = '') {
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

function draftToTransaction(draft: IndentDraft): IndentTransaction {
  return {
    id: draft.id,
    app_request_id: draft.requestNo,
    indent_no: 'Indent No. will be assigned after submission',
    project_code: draft.projectCode,
    project_name: draft.projectLabel.replace(`${draft.projectCode} - `, ''),
    source_warehouse: draft.warehouseCode ?? '-',
    source_warehouse_name: draft.warehouseLabel?.replace(`${draft.warehouseCode} - `, ''),
    source_location: draft.sourceLocationLabel ?? draft.sourceLocationCode,
    delivery_location: draft.sourceLocationCode,
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
      required_qty: item.requestedQty,
      work_type: item.workType,
      activity_code: item.activityCode,
      location_code: item.locationCode,
      remarks: item.remarks,
    })),
  }
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

function normalizeStatus(status: string) {
  return String(status ?? '').replace(/\s+/g, '').trim().toUpperCase()
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
