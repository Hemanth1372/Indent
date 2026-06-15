import { z } from 'zod'

const indentStatusSchema = z.enum([
  'Draft',
  'PendingSync',
  'Created',
  'Pending',
  'PendingApproval',
  'ApprovalPending',
  'Approved',
  'Issue',
  'PartiallyIssued',
  'Issued',
  'Completed',
  'Rejected',
])

const adminIndentBodySchema = z.object({
  project_code: z.string().trim().min(1).max(50),
  app_request_id: z.string().trim().max(80).optional().nullable(),
  source_warehouse: z.string().trim().max(100).optional().nullable(),
  source_location: z.string().trim().max(100).optional().nullable(),
  delivery_location: z.string().trim().min(1).max(80),
  requirement_type: z.string().trim().min(1).max(80),
  indent_type: z.string().trim().max(80).optional().nullable(),
  to_entity_type: z.string().trim().max(80).optional().nullable(),
  to_entity_id: z.string().trim().max(120).optional().nullable(),
  approver_email: z.string().trim().email().max(255).optional().nullable(),
  approver_name: z.string().trim().max(150).optional().nullable(),
  item_code: z.string().trim().min(1).max(50),
  item_description: z.string().trim().max(300).optional().nullable(),
  make: z.string().trim().max(120).optional().nullable(),
  required_qty: z.coerce.number().positive(),
  issued_qty: z.coerce.number().nonnegative().optional(),
  uom: z.string().trim().min(1).max(50),
  work_type: z.string().trim().max(80).optional().nullable(),
  activity_code: z.string().trim().max(100).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
})

const syncIndentBodySchema = z.object({
  app_request_id: z.string().trim().min(1).max(80),
  project_code: z.string().trim().min(1).max(50),
  source_warehouse: z.string().trim().max(100).optional().nullable(),
  source_location: z.string().trim().max(100).optional().nullable(),
  delivery_location: z.string().trim().min(1).max(100),
  requirement_type: z.string().trim().min(1).max(80),
  indent_type: z.string().trim().max(80).optional().nullable(),
  engineerId: z.string().trim().max(50).optional().nullable(),
  engineerType: z.string().trim().max(20).optional().nullable(),
  orderNo: z.string().trim().max(80).optional().nullable(),
  orderType: z.string().trim().max(80).optional().nullable(),
  equipmentDisplay: z.string().trim().max(200).optional().nullable(),
  status: z.string().trim().max(50).optional().nullable(),
  items: z.array(z.object({
    item_code: z.string().trim().min(1).max(100),
    materialCode: z.string().trim().max(100).optional().nullable(),
    materialDesc: z.string().trim().max(300).optional().nullable(),
    make: z.string().trim().max(120).optional().nullable(),
    workType: z.string().trim().max(80).optional().nullable(),
    activityId: z.string().trim().max(100).optional().nullable(),
    locationId: z.string().trim().max(100).optional().nullable(),
    uom: z.string().trim().min(1).max(50),
    required_qty: z.coerce.number().positive(),
    requestedQty: z.coerce.number().positive().optional(),
    remarks: z.string().trim().max(2000).optional().nullable(),
    attachmentUrl: z.string().trim().max(2000).optional().nullable(),
  }).passthrough()).min(1),
}).passthrough()

const mobileIndentBodySchema = z.object({
  requestNo: z.string().trim().min(1).max(80).optional(),
  projectId: z.string().trim().min(1).max(50),
  warehouseId: z.string().trim().max(80).optional().nullable(),
  indentType: z.string().trim().min(1).max(80),
  engineerType: z.string().trim().max(20).optional().nullable(),
  orderNo: z.string().trim().max(80).optional().nullable(),
  orderType: z.string().trim().max(80).optional().nullable(),
  equipmentDisplay: z.string().trim().max(200).optional().nullable(),
  items: z.array(z.object({
    materialCode: z.string().trim().min(1).max(50),
    materialDesc: z.string().trim().max(300).optional().nullable(),
    workType: z.string().trim().max(80).optional().nullable(),
    activityId: z.string().trim().max(100).optional().nullable(),
    locationId: z.string().trim().max(80).optional().nullable(),
    uom: z.string().trim().min(1).max(50),
    requestedQty: z.coerce.number().positive(),
    issuedQty: z.coerce.number().nonnegative().optional(),
    remarks: z.string().trim().max(2000).optional().nullable(),
    attachmentUrl: z.string().trim().max(2000).optional().nullable(),
  }).passthrough()).min(1),
}).passthrough()

export const createIndentSchema = z.object({
  body: z.union([syncIndentBodySchema, adminIndentBodySchema, mobileIndentBodySchema]),
  params: z.object({}).optional(),
  query: z.object({
    wait_for_email: z.enum(['true', 'false']).optional(),
  }).optional(),
})

export const updateIndentStatusSchema = z.object({
  body: z.object({
    status: indentStatusSchema,
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})

export const indentIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})
