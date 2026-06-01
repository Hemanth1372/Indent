import { Alert, Button, Form, Input, Modal, Spin, Switch, message } from 'antd'
import { MoreVertical, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api'

type FieldType = 'text' | 'textarea' | 'boolean'

type MasterField = {
  key: string
  label: string
  required?: boolean
  type?: FieldType
}

type MasterConfig = {
  title: string
  subtitle: string
  countLabel: string
  fields: MasterField[]
  columns: MasterField[]
}

const masterConfigs: Record<string, MasterConfig> = {
  'project-master': {
    title: 'Project Master',
    subtitle: 'Project site codes, descriptions, and address references',
    countLabel: 'Projects',
    fields: [
      { key: 'site_code', label: 'Project', required: true },
      { key: 'project_name', label: 'Project Description', required: true },
      { key: 'address_code', label: 'Address Code Project' },
      { key: 'address_description', label: 'Address Code Description', type: 'textarea' },
      { key: 'location', label: 'Location' },
      { key: 'status', label: 'Status' },
    ],
    columns: [
      { key: 'site_code', label: 'Project' },
      { key: 'project_name', label: 'Project Description' },
      { key: 'address_code', label: 'Address Code' },
      { key: 'address_description', label: 'Address Description' },
      { key: 'status', label: 'Status' },
    ],
  },
  'activity-master': {
    title: 'Activity Master',
    subtitle: 'Execution activities and work authorization details',
    countLabel: 'Activities',
    fields: [
      { key: 'activity_code', label: 'Activity', required: true },
      { key: 'description', label: 'Activity Description', required: true },
      { key: 'activity_type', label: 'Activity Type' },
      { key: 'critical_capacity_type', label: 'Critical Capacity Type' },
      { key: 'work_auth_status', label: 'Work Auth. Status' },
      { key: 'resource_required', label: 'Resource Required' },
    ],
    columns: [
      { key: 'activity_code', label: 'Activity' },
      { key: 'description', label: 'Activity Description' },
      { key: 'activity_type', label: 'Activity Type' },
      { key: 'critical_capacity_type', label: 'Critical Capacity Type' },
      { key: 'work_auth_status', label: 'Work Auth. Status' },
      { key: 'resource_required', label: 'Resource Required' },
    ],
  },
  'location-master': {
    title: 'Location Master',
    subtitle: 'Location codes and descriptions',
    countLabel: 'Locations',
    fields: [
      { key: 'location_code', label: 'Location', required: true },
      { key: 'description', label: 'Location Description', required: true },
    ],
    columns: [
      { key: 'location_code', label: 'Location' },
      { key: 'description', label: 'Location Description' },
    ],
  },
  'item-master': {
    title: 'Item Master',
    subtitle: 'Purchase items available by project site',
    countLabel: 'Items',
    fields: [
      { key: 'site_code', label: 'Site' },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_name', label: 'Item Description', required: true },
      { key: 'purchase_unit', label: 'Purchase Unit' },
      { key: 'item_type', label: 'Item Type' },
    ],
    columns: [
      { key: 'site_code', label: 'Site' },
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_name', label: 'Item Description' },
      { key: 'purchase_unit', label: 'Purchase Unit' },
      { key: 'item_type', label: 'Item Type' },
    ],
  },
  'business-partner-master': {
    title: 'Business Partner Master',
    subtitle: 'Vendors, contractors, and project business partners',
    countLabel: 'Business Partners',
    fields: [
      { key: 'project_code', label: 'Project' },
      { key: 'location_code', label: 'Location' },
      { key: 'location_description', label: 'Location Description' },
      { key: 'activity_code', label: 'Activity' },
      { key: 'activity_description', label: 'Activity Description' },
      { key: 'business_partner_code', label: 'Business Partner', required: true },
      { key: 'bp_name', label: 'BP Name', required: true },
    ],
    columns: [
      { key: 'project_code', label: 'Project' },
      { key: 'location_code', label: 'Location' },
      { key: 'activity_code', label: 'Activity' },
      { key: 'business_partner_code', label: 'Business Partner' },
      { key: 'bp_name', label: 'BP Name' },
    ],
  },
  'warehouse-master': {
    title: 'Warehouse Master',
    subtitle: 'Warehouses and virtual warehouse mapping by site',
    countLabel: 'Warehouses',
    fields: [
      { key: 'warehouse_code', label: 'Warehouse', required: true },
      { key: 'description', label: 'Warehouse Description', required: true },
      { key: 'site_code', label: 'Site' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'material_warehouse', label: 'Material Warehouse' },
      { key: 'virtual_warehouse', label: 'Virtual Warehouse' },
      { key: 'is_virtual', label: 'Virtual', type: 'boolean' },
    ],
    columns: [
      { key: 'warehouse_code', label: 'Warehouse' },
      { key: 'description', label: 'Warehouse Description' },
      { key: 'site_code', label: 'Site' },
      { key: 'site_description', label: 'Site Description' },
      { key: 'material_warehouse', label: 'Material Warehouse' },
      { key: 'virtual_warehouse', label: 'Virtual Warehouse' },
      { key: 'is_virtual', label: 'Virtual', type: 'boolean' },
    ],
  },
  'warehouse-bin-master': {
    title: 'Warehouse Bin Master',
    subtitle: 'Storage locations and warehouse bins',
    countLabel: 'Bins',
    fields: [
      { key: 'warehouse_code', label: 'Warehouse', required: true },
      { key: 'description', label: 'Warehouse Description', required: true },
    ],
    columns: [
      { key: 'warehouse_code', label: 'Warehouse' },
      { key: 'description', label: 'Warehouse Description' },
    ],
  },
  'delivery-point-master': {
    title: 'Delivery Point Master',
    subtitle: 'Delivery points linked to project address codes',
    countLabel: 'Delivery Points',
    fields: [
      { key: 'address_code', label: 'Address Code', required: true },
      { key: 'address_description', label: 'Address Code Description' },
      { key: 'delivery_point_code', label: 'Delivery Point', required: true },
      { key: 'description', label: 'Description', required: true },
    ],
    columns: [
      { key: 'address_code', label: 'Address Code' },
      { key: 'address_description', label: 'Address Code Description' },
      { key: 'delivery_point_code', label: 'Delivery Point' },
      { key: 'description', label: 'Description' },
    ],
  },
}

type MasterRecord = Record<string, unknown>

function displayValue(record: MasterRecord, field: MasterField) {
  const value = record[field.key]

  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return value === null || value === undefined || value === '' ? '-' : String(value)
}

export default function GenericMasterPage() {
  const { masterKey = '' } = useParams()
  const config = useMemo(() => masterConfigs[masterKey], [masterKey])
  const [form] = Form.useForm()
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadRecords() {
    if (!config) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data } = await api.get<{ data: MasterRecord[] }>(`/api/master-data/${masterKey}`)
      setRecords(data.data)
    } catch (requestError) {
      console.error(requestError)
      setError(`Could not load ${config.title}. Check that the backend is running and you are logged in.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [masterKey])

  async function handleCreate(values: MasterRecord) {
    setCreating(true)

    try {
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value,
        ]),
      )
      const { data } = await api.post<{ data: MasterRecord }>(`/api/master-data/${masterKey}`, payload)

      setRecords((currentRecords) => [data.data, ...currentRecords])
      form.resetFields()
      setModalOpen(false)
      message.success(`${config.title} record created successfully`)
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? `Failed to create ${config.title} record`)
    } finally {
      setCreating(false)
    }
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Master Not Found</h3>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {records.length} {config.countLabel}
          </span>
          <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)} type="primary">
            Add {config.title.replace(' Master', '')}
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
                    <td className="px-5 py-4 text-slate-700" key={column.key}>
                      {displayValue(record, column)}
                    </td>
                  ))}
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title={`${config.title} actions`}
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

          {!records.length && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No records found.
            </div>
          )}
        </div>
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
        title={`Add ${config.title}`}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          {config.fields.map((field) => (
            <Form.Item
              key={field.key}
              label={field.label}
              name={field.key}
              rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
              valuePropName={field.type === 'boolean' ? 'checked' : undefined}
            >
              {field.type === 'textarea' ? (
                <Input.TextArea rows={3} />
              ) : field.type === 'boolean' ? (
                <Switch />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </section>
  )
}
