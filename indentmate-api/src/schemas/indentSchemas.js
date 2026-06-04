import { z } from 'zod'

const indentStatusSchema = z.enum(['Pending', 'Approved', 'Rejected', 'Issued'])

const adminIndentBodySchema = z.object({
  project_code: z.string().trim().min(1).max(50),
  delivery_location: z.string().trim().min(1).max(80),
  requirement_type: z.string().trim().min(1).max(80),
  item_code: z.string().trim().min(1).max(50),
  make: z.string().trim().max(120).optional().nullable(),
  required_qty: z.coerce.number().positive(),
  uom: z.string().trim().min(1).max(50),
  remarks: z.string().trim().max(2000).optional().nullable(),
})

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
    locationId: z.string().trim().max(80).optional().nullable(),
    uom: z.string().trim().min(1).max(50),
    requestedQty: z.coerce.number().positive(),
    remarks: z.string().trim().max(2000).optional().nullable(),
  }).passthrough()).min(1),
}).passthrough()

export const createIndentSchema = z.object({
  body: z.union([adminIndentBodySchema, mobileIndentBodySchema]),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
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
