import { z } from 'zod'

const indentStatusSchema = z.enum(['Pending', 'Approved', 'Rejected', 'Issued'])

export const createIndentSchema = z.object({
  body: z.object({
    project_code: z.string().trim().min(1).max(50),
    delivery_location: z.string().trim().min(1).max(80),
    requirement_type: z.string().trim().min(1).max(80),
    item_code: z.string().trim().min(1).max(50),
    make: z.string().trim().max(120).optional().nullable(),
    required_qty: z.coerce.number().positive(),
    uom: z.string().trim().min(1).max(50),
    remarks: z.string().trim().max(2000).optional().nullable(),
  }),
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
