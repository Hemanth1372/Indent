import { z } from 'zod'

const dateString = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const responsibilityBodySchema = z.object({
  project_code: z.string().trim().min(1).max(50),
  responsibility_code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(200),
  valid_to: dateString,
  end_date: dateString,
})

export const createResponsibilitySchema = z.object({
  body: responsibilityBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const updateResponsibilitySchema = z.object({
  body: responsibilityBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})

export const responsibilityIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})
