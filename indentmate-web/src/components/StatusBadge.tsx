import { Tag } from 'antd'
import type { IndentStatus } from '../types/indent'

const statusColor: Record<IndentStatus, string> = {
  Pending: 'processing',
  PendingSync: 'blue',
  Approved: 'success',
  Rejected: 'error',
}

export default function StatusBadge({ status }: { status: IndentStatus }) {
  return <Tag color={statusColor[status]}>{status === 'PendingSync' ? 'Pending Sync' : status}</Tag>
}
