import { Tag } from 'antd'
import type { IndentStatus } from '../types/indent'

const statusColor: Record<IndentStatus, string> = {
  Created: 'default',
  PendingApproval: 'processing',
  Approved: 'success',
  Rejected: 'error',
}

export default function StatusBadge({ status }: { status: IndentStatus }) {
  return <Tag color={statusColor[status]}>{status}</Tag>
}
