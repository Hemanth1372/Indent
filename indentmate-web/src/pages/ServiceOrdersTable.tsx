import { Alert, Button, Form, Input, Modal, Select, Spin, message } from 'antd'
import { MoreVertical, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

type ServiceOrder = {
  id: string
  service_order_no: string
  status: string
  item_code: string
  item_name: string | null
  serial_number: string | null
  description: string | null
  project_site: string
  project_name: string | null
}

type ServiceOrderFormValues = {
  service_order_no: string
  status: string
  item_code: string
  serial_number?: string
  description?: string
  project_site: string
}

type ServiceOrderOptions = {
  items: Array<{
    item_code: string
    item_name: string
  }>
  sites: Array<{
    site_code: string
    project_name: string
  }>
}

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

export default function ServiceOrdersTable() {
  const [form] = Form.useForm<ServiceOrderFormValues>()
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([])
  const [options, setOptions] = useState<ServiceOrderOptions>({ items: [], sites: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadServiceOrders() {
    setIsLoading(true)
    setError(null)

    try {
      const { data } = await api.get<{ data: ServiceOrder[] }>('/api/service-orders')
      setServiceOrders(data.data)
    } catch (requestError) {
      console.error(requestError)
      setError('Could not load Service Orders. Check that the backend is running and you are logged in.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadOptions() {
    setOptionsLoading(true)

    try {
      const { data } = await api.get<ServiceOrderOptions>('/api/service-orders/options')
      setOptions(data)
    } catch (requestError) {
      console.error(requestError)
      message.error('Could not load item/site options')
    } finally {
      setOptionsLoading(false)
    }
  }

  useEffect(() => {
    loadServiceOrders()
  }, [])

  async function openCreateModal() {
    form.setFieldsValue({ status: 'Released' })
    setModalOpen(true)

    if (!options.items.length || !options.sites.length) {
      await loadOptions()
    }
  }

  async function handleCreate(values: ServiceOrderFormValues) {
    setCreating(true)

    try {
      const payload = {
        service_order_no: values.service_order_no.trim(),
        status: values.status,
        item_code: values.item_code,
        serial_number: values.serial_number?.trim() || null,
        description: values.description?.trim() || null,
        project_site: values.project_site,
      }
      const { data } = await api.post<{ data: ServiceOrder }>('/api/service-orders', payload)

      setServiceOrders((currentOrders) => [data.data, ...currentOrders])
      form.resetFields()
      setModalOpen(false)
      message.success('Service order created successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create service order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Service Orders</h3>
          <p className="mt-1 text-sm text-slate-500">Operational equipment tasks by item and site</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {serviceOrders.length} Orders
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Order No</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Serial Number</th>
                <th className="px-5 py-3 font-semibold">Description</th>
                <th className="px-5 py-3 font-semibold">Site</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {serviceOrders.map((order) => (
                <tr className="hover:bg-slate-50" key={order.id}>
                  <td className="px-5 py-4 font-semibold text-slate-800">{order.service_order_no}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-800">
                      {order.item_name ?? order.item_code}
                    </div>
                    <div className="text-xs text-slate-500">{order.item_code}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{order.serial_number ?? '-'}</td>
                  <td className="max-w-xl px-5 py-4 text-slate-600">{order.description ?? '-'}</td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-800">{order.project_site}</div>
                    <div className="text-xs text-slate-500">{order.project_name ?? '-'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title="Service order actions"
                        type="button"
                      >
                        <MoreVertical size={20} />
                      </button>
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
        title="Add Service Order"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
        >
          <Form.Item
            label="Order No"
            name="service_order_no"
            rules={[{ required: true, message: 'Order No is required' }]}
          >
            <Input placeholder="Example: SO-1007" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Status is required' }]}
          >
            <Select
              options={[
                { label: 'Released', value: 'Released' },
                { label: 'Pending', value: 'Pending' },
                { label: 'Completed', value: 'Completed' },
              ]}
              placeholder="Select status"
            />
          </Form.Item>

          <Form.Item
            label="Item"
            name="item_code"
            rules={[{ required: true, message: 'Item is required' }]}
          >
            <Select
              loading={optionsLoading}
              optionFilterProp="label"
              options={options.items.map((item) => ({
                label: `${item.item_code} - ${item.item_name}`,
                value: item.item_code,
              }))}
              placeholder="Select item"
              showSearch
            />
          </Form.Item>

          <Form.Item label="Serial Number" name="serial_number">
            <Input placeholder="Example: SN-DTR-25-001" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Enter task description" rows={3} />
          </Form.Item>

          <Form.Item
            label="Site"
            name="project_site"
            rules={[{ required: true, message: 'Site is required' }]}
          >
            <Select
              loading={optionsLoading}
              optionFilterProp="label"
              options={options.sites.map((site) => ({
                label: `${site.site_code} - ${site.project_name}`,
                value: site.site_code,
              }))}
              placeholder="Select site"
              showSearch
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
