import { Alert, Button, Form, Input, Modal, Select, Spin, message } from 'antd'
import { MoreVertical, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../services/api'

type ResponsibilityRow = {
  id: string
  project_code: string
  project_description: string | null
  responsibility_code: string
  description: string
  valid_to: string
  end_date: string
}

type ResponsibilityFormValues = {
  project_code: string
  responsibility_code: string
  description: string
  valid_to: string
  end_date: string
}

type ResponsibilityOptions = {
  projects: Array<{
    project_code: string
    project_description: string
  }>
}

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function ResponsibilityMaster() {
  const [form] = Form.useForm<ResponsibilityFormValues>()
  const [responsibilities, setResponsibilities] = useState<ResponsibilityRow[]>([])
  const [options, setOptions] = useState<ResponsibilityOptions>({ projects: [] })
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadResponsibilities() {
    setLoading(true)
    setError(null)

    try {
      const { data } = await api.get<{ data: ResponsibilityRow[] }>('/api/responsibilities')
      setResponsibilities(data.data)
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
      message.error('Could not load project options')
    } finally {
      setOptionsLoading(false)
    }
  }

  useEffect(() => {
    loadResponsibilities()
  }, [])

  async function openCreateModal() {
    setModalOpen(true)

    if (!options.projects.length) {
      await loadOptions()
    }
  }

  async function handleCreate(values: ResponsibilityFormValues) {
    setCreating(true)

    try {
      const payload = {
        project_code: values.project_code,
        responsibility_code: values.responsibility_code.trim(),
        description: values.description.trim(),
        valid_to: values.valid_to,
        end_date: values.end_date,
      }
      const { data } = await api.post<{ data: ResponsibilityRow }>('/api/responsibilities', payload)

      setResponsibilities((currentRows) => [data.data, ...currentRows])
      form.resetFields()
      setModalOpen(false)
      message.success('Responsibility created successfully')
    } catch (requestError: any) {
      console.error(requestError)
      message.error(requestError.response?.data?.message ?? 'Failed to create responsibility')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Responsibility Master</h3>
          <p className="mt-1 text-sm text-slate-500">Project roles and operational ownership periods</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {responsibilities.length} Responsibilities
          </span>
          <Button icon={<Plus size={16} />} onClick={openCreateModal} type="primary">
            Add Responsibility
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
                <th className="px-5 py-3 font-semibold">Project</th>
                <th className="px-5 py-3 font-semibold">Project Desc</th>
                <th className="px-5 py-3 font-semibold">Responsibility</th>
                <th className="px-5 py-3 font-semibold">Description</th>
                <th className="px-5 py-3 font-semibold">Valid To</th>
                <th className="px-5 py-3 font-semibold">End Date</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {responsibilities.map((responsibility) => (
                <tr className="hover:bg-slate-50" key={responsibility.id}>
                  <td className="px-5 py-4 font-semibold text-slate-800">{responsibility.project_code}</td>
                  <td className="px-5 py-4 text-slate-600">{responsibility.project_description ?? '-'}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{responsibility.responsibility_code}</td>
                  <td className="px-5 py-4 text-slate-600">{responsibility.description}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(responsibility.valid_to)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(responsibility.end_date)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        title="Responsibility actions"
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

          {!responsibilities.length && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No responsibilities found.
            </div>
          )}
        </div>
      )}

      <Modal
        confirmLoading={creating}
        okText="Create Responsibility"
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        open={modalOpen}
        title="Add Responsibility"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item
            label="Project"
            name="project_code"
            rules={[{ required: true, message: 'Project is required' }]}
          >
            <Select
              loading={optionsLoading}
              optionFilterProp="label"
              options={options.projects.map((project) => ({
                label: `${project.project_code} - ${project.project_description}`,
                value: project.project_code,
              }))}
              placeholder="Select project"
              showSearch
            />
          </Form.Item>

          <Form.Item
            label="Responsibility"
            name="responsibility_code"
            rules={[{ required: true, message: 'Responsibility code is required' }]}
          >
            <Input placeholder="Example: HOP" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Description is required' }]}
          >
            <Input placeholder="Example: HO Purchase Head" />
          </Form.Item>

          <Form.Item
            label="Valid To"
            name="valid_to"
            rules={[{ required: true, message: 'Valid To is required' }]}
          >
            <Input type="date" />
          </Form.Item>

          <Form.Item
            label="End Date"
            name="end_date"
            rules={[{ required: true, message: 'End Date is required' }]}
          >
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
