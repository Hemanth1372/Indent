import { Alert, Button, Dropdown, Form, Input, Modal, Select, Spin, message } from 'antd'
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

const PAGE_SIZE = 100

type ServiceOrder = {
  id: number
  service_order_no: string
  status: string
  item_code: string | null
  serial_number: string | null
  project_site: string
  description: string | null
}

type ServiceOrderFormValues = {
  service_order_no: string
  status: string
  item_code?: string
  serial_number?: string
  project_site: string
  description?: string
}

type ServiceOrderListResponse = {
  data: ServiceOrder[]
  metadata: {
    totalRecords: number
    totalPages: number
    currentPage: number
    limit: number
  }
}

const searchFields = [
  { label: 'Service Order No', value: 'service_order_no', placeholder: 'Enter Service Order No (e.g. BDSR00001)...' },
  { label: 'Status', value: 'status', placeholder: 'Enter Status (e.g. Released)...' },
  { label: 'Item Code', value: 'item_code', placeholder: 'Enter Item Code...' },
  { label: 'Serial Number', value: 'serial_number', placeholder: 'Enter Serial Number (e.g. OD11K-7851)...' },
  { label: 'Project Site', value: 'project_site', placeholder: 'Enter Project Site (e.g. EODBHS001)...' },
  { label: 'Description', value: 'description', placeholder: 'Enter Description...' },
]

function statusClass(status: string) {
  const normalizedStatus = status.toLowerCase()

  if (normalizedStatus === 'released') {
    return 'bg-emerald-100 text-emerald-700'
  }

  if (normalizedStatus === 'completed') {
    return 'bg-blue-100 text-blue-700'
  }

  if (normalizedStatus === 'pending') {
    return 'bg-amber-100 text-amber-700'
  }

  return 'bg-slate-100 text-slate-700'
}

function toPayload(values: ServiceOrderFormValues) {
  return {
    service_order_no: values.service_order_no.trim(),
    status: values.status.trim(),
    item_code: values.item_code?.trim() || null,
    serial_number: values.serial_number?.trim() || null,
    project_site: values.project_site.trim(),
    description: values.description?.trim() || null,
  }
}

export default function ServiceOrdersTable() {
  const [form] = Form.useForm<ServiceOrderFormValues>()
  const [editForm] = Form.useForm<ServiceOrderFormValues>()
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchField, setSearchField] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  async function loadServiceOrders(params?: { page?: number; field?: string; value?: string }) {
    setIsLoading(true)
    setError(null)

    try {
      const requestParams = {
        page: params?.page ?? currentPage,
        limit: PAGE_SIZE,
        ...(params?.field && params?.value ? { field: params.field, value: params.value } : {}),
      }
      const { data } = await api.get<ServiceOrderListResponse>('/api/service-orders', {
        params: requestParams,
      })

      setServiceOrders(data.data)
      setCurrentPage(data.metadata.currentPage)
      setTotalPages(data.metadata.totalPages)
      setTotalRecords(data.metadata.totalRecords)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load Service Orders. Check that the backend is running and you are logged in.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadServiceOrders({ page: 1 })
  }, [])

  useEffect(() => {
    loadServiceOrders(isFilterActive && searchField && searchQuery.trim()
      ? { page: currentPage, field: searchField, value: searchQuery.trim() }
      : { page: currentPage })
  }, [currentPage])

  function openCreateModal() {
    form.setFieldsValue({ status: 'Released' })
    setModalOpen(true)
  }

  function openEditModal(order: ServiceOrder) {
    setSelectedOrderId(order.id)
    editForm.setFieldsValue({
      service_order_no: order.service_order_no,
      status: order.status,
      item_code: order.item_code ?? '',
      serial_number: order.serial_number ?? '',
      project_site: order.project_site,
      description: order.description ?? '',
    })
    setEditModalOpen(true)
  }

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim()

    if (!searchField || !trimmedQuery) {
      message.warning('Select a filter field and enter a search value.')
      return
    }

    setIsFilterActive(true)
    setCurrentPage(1)
    await loadServiceOrders({ page: 1, field: searchField, value: trimmedQuery })
  }

  async function handleClearSearch() {
    setSearchField('')
    setSearchQuery('')
    setIsFilterActive(false)
    setCurrentPage(1)
    await loadServiceOrders({ page: 1 })
  }

  async function handleCreate(values: ServiceOrderFormValues) {
    setCreating(true)

    try {
      await api.post<{ data: ServiceOrder }>('/api/service-orders', toPayload(values))

      form.resetFields()
      setModalOpen(false)
      setCurrentPage(1)
      await loadServiceOrders(isFilterActive && searchField && searchQuery.trim()
        ? { page: 1, field: searchField, value: searchQuery.trim() }
        : { page: 1 })
      message.success('Service order created successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create service order')
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(values: ServiceOrderFormValues) {
    if (selectedOrderId === null) {
      return
    }

    setUpdating(true)

    try {
      await api.put<{ data: ServiceOrder }>(`/api/service-orders/${selectedOrderId}`, toPayload(values))

      setEditModalOpen(false)
      setSelectedOrderId(null)
      editForm.resetFields()
      await loadServiceOrders(isFilterActive && searchField && searchQuery.trim()
        ? { page: currentPage, field: searchField, value: searchQuery.trim() }
        : { page: currentPage })
      message.success('Service order updated successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to update service order')
    } finally {
      setUpdating(false)
    }
  }

  const showingStart = totalRecords === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
  const showingEnd = Math.min(currentPage * PAGE_SIZE, totalRecords)

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Service Orders</h3>
          <p className="mt-1 text-sm text-slate-500">
            Operational equipment deployment, maintenance logs, and task tracking
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-[15px]">
          <Select
            allowClear
            className="min-w-[220px]"
            onChange={(value) => {
              setSearchField(value ?? '')
              setSearchQuery('')
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
              searchFields.find((field) => field.value === searchField)?.placeholder ??
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

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {totalRecords} Records
          </span>
          <Button icon={<Plus size={16} />} onClick={openCreateModal} type="primary">
            Add Service Order
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-5">
          <Alert message={error} type="error" showIcon />
        </div>
      )}

      {isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Spin />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Service Order</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Item Code</th>
                  <th className="px-5 py-3 font-semibold">Serial Number</th>
                  <th className="px-5 py-3 font-semibold">Project Site</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {serviceOrders.map((order) => (
                  <tr className="hover:bg-slate-50" key={order.id}>
                    <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                      {order.service_order_no}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                      {order.item_code ?? '-'}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-700">
                      {order.serial_number ?? '-'}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                      {order.project_site}
                    </td>
                    <td className="max-w-xl px-5 py-4 text-slate-600">
                      {order.description ?? '-'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'edit',
                                icon: <Pencil size={16} />,
                                label: 'Edit',
                                onClick: () => openEditModal(order),
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
                            title="Service order actions"
                            type="button"
                          >
                            <MoreVertical size={20} />
                          </button>
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!serviceOrders.length && (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No service orders found.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>
              Showing records {showingStart}-{showingEnd} of {totalRecords}
            </span>
            <div className="flex items-center gap-3">
              <Button
                disabled={currentPage === 1 || isLoading}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="min-w-[110px] text-center font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                disabled={currentPage === totalPages || isLoading}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        confirmLoading={creating}
        okText="Create Service Order"
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        open={modalOpen}
        title="Add Service Order Master"
      >
        <ServiceOrderForm form={form} onFinish={handleCreate} />
      </Modal>

      <Modal
        confirmLoading={updating}
        okText="Save Changes"
        onCancel={() => {
          setEditModalOpen(false)
          setSelectedOrderId(null)
          editForm.resetFields()
        }}
        onOk={() => editForm.submit()}
        open={editModalOpen}
        title="Edit Service Order Master"
      >
        <ServiceOrderForm form={editForm} onFinish={handleEdit} />
      </Modal>
    </section>
  )
}

function ServiceOrderForm({
  form,
  onFinish,
}: {
  form: ReturnType<typeof Form.useForm<ServiceOrderFormValues>>[0]
  onFinish: (values: ServiceOrderFormValues) => void
}) {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
      <Form.Item
        label="Service Order No"
        name="service_order_no"
        rules={[{ required: true, message: 'Service Order No is required' }]}
      >
        <Input placeholder="Example: BDSR00001" />
      </Form.Item>

      <Form.Item
        label="Status"
        name="status"
        rules={[{ required: true, message: 'Status is required' }]}
      >
        <Input placeholder="Example: Released" />
      </Form.Item>

      <Form.Item label="Item Code" name="item_code">
        <Input placeholder="Example: 21100101038H" />
      </Form.Item>

      <Form.Item label="Serial Number" name="serial_number">
        <Input placeholder="Example: OD11K-7851" />
      </Form.Item>

      <Form.Item
        label="Project Site"
        name="project_site"
        rules={[{ required: true, message: 'Project Site is required' }]}
      >
        <Input placeholder="Example: EODBHS001" />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <Input.TextArea placeholder="Enter description" rows={3} />
      </Form.Item>
    </Form>
  )
}
