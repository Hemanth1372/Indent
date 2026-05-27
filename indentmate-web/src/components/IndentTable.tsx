import { Table } from 'antd'
import { Link } from 'react-router-dom'
import type { Indent } from '../types/indent'
import StatusBadge from './StatusBadge'

type IndentTableProps = {
  data: Indent[]
  loading?: boolean
}

export default function IndentTable({ data, loading }: IndentTableProps) {
  return (
    <Table
      rowKey="indentId"
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 10 }}
      columns={[
        {
          title: 'Request No',
          dataIndex: 'requestNo',
          render: (value: string, record) => (
            <Link to={`/indents/${record.indentId}`}>{value}</Link>
          ),
        },
        { title: 'Engineer', dataIndex: 'engineerId' },
        { title: 'Project', dataIndex: 'projectId' },
        { title: 'Warehouse', dataIndex: 'warehouseId' },
        { title: 'Type', dataIndex: 'indentType' },
        {
          title: 'Status',
          dataIndex: 'status',
          render: (status: Indent['status']) => <StatusBadge status={status} />,
        },
      ]}
    />
  )
}
