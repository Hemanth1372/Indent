export type IndentStatus = 'Created' | 'PendingApproval' | 'Approved' | 'Rejected'

export type Indent = {
  indentId: string
  requestNo: string
  engineerId: string
  projectId: string
  warehouseId: string
  indentType: 'Issue' | 'IssueReturn'
  engineerType: 'SIE' | 'SER'
  status: IndentStatus
  createdAt: string
  submittedAt?: string
  isSynced: boolean
}

export type IndentItem = {
  itemLineId: string
  indentId: string
  materialCode: string
  materialDesc: string
  requestedQty: number
  uom: string
}
