import { Descriptions, Table, Typography } from 'antd'
import { useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import type { IndentItem } from '../types/indent'

const items: IndentItem[] = [
  {
    itemLineId: '1',
    indentId: 'IND-1001',
    materialCode: 'MAT-4402',
    materialDesc: 'Copper cable',
    requestedQty: 120,
    uom: 'MTR',
  },
  {
    itemLineId: '2',
    indentId: 'IND-1001',
    materialCode: 'MAT-1180',
    materialDesc: 'PVC conduit',
    requestedQty: 60,
    uom: 'NOS',
  },
]

export default function IndentDetail() {
  const { indentId } = useParams()

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {indentId}
          </Typography.Title>
          <Typography.Text type="secondary">Indent request details</Typography.Text>
        </div>
        <StatusBadge status="PendingApproval" />
      </div>

      <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 20 }}>
        <Descriptions.Item label="Request No">REQ-1001</Descriptions.Item>
        <Descriptions.Item label="Engineer">ENG001</Descriptions.Item>
        <Descriptions.Item label="Project">PRJ-22</Descriptions.Item>
        <Descriptions.Item label="Warehouse">WH-MAT</Descriptions.Item>
        <Descriptions.Item label="Type">Issue</Descriptions.Item>
        <Descriptions.Item label="Synced">Yes</Descriptions.Item>
      </Descriptions>

      <Table
        rowKey="itemLineId"
        dataSource={items}
        pagination={false}
        columns={[
          { title: 'Material Code', dataIndex: 'materialCode' },
          { title: 'Description', dataIndex: 'materialDesc' },
          { title: 'Qty', dataIndex: 'requestedQty' },
          { title: 'UoM', dataIndex: 'uom' },
        ]}
      />
    </section>
  )
}
