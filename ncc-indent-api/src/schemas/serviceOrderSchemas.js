import { z } from 'zod'

const serviceOrderBodySchema = z.object({
  service_order_no: z.string().trim().min(1).max(50),
  status: z.string().trim().min(1).max(50),
  item_code: z.string().trim().min(1).max(50),
  serial_number: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  project_site: z.string().trim().min(1).max(50),
})

export const createServiceOrderSchema = z.object({
  body: serviceOrderBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const updateServiceOrderSchema = z.object({
  body: serviceOrderBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})

export const serviceOrderIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})
