import { Button, Typography } from 'antd'
import IndentTable from '../components/IndentTable'
import type { Indent } from '../types/indent'

const indents: Indent[] = [
  {
    indentId: 'IND-1001',
    requestNo: 'REQ-1001',
    engineerId: 'ENG001',
    projectId: 'PRJ-22',
    warehouseId: 'WH-MAT',
    indentType: 'Issue',
    engineerType: 'SIE',
    status: 'Pending',
    createdAt: new Date().toISOString(),
    isSynced: true,
  },
  {
    indentId: 'IND-1002',
    requestNo: 'REQ-1002',
    engineerId: 'ENG014',
    projectId: 'PRJ-18',
    warehouseId: 'WH-VRT',
    indentType: 'IssueReturn',
    engineerType: 'SER',
    status: 'Approved',
    createdAt: new Date().toISOString(),
    isSynced: true,
  },
]

export default function IndentList() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Indents
          </Typography.Title>
          <Typography.Text type="secondary">Review and track material requests</Typography.Text>
        </div>
        <Button type="primary">New Indent</Button>
      </div>

      <IndentTable data={indents} />
    </section>
  )
}
