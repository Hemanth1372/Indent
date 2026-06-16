import { z } from 'zod'

const optionalDateString = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional(),
)

const responsibilityBodySchema = z.object({
  employee_id: z.string().trim().min(1).max(50),
  employee_name: z.string().trim().min(1).max(150),
  project_id: z.string().trim().min(1).max(50),
  project_description: z.string().trim().min(1).max(255),
  responsibility: z.string().trim().min(1).max(255),
  valid_from: optionalDateString,
  valid_to: optionalDateString,
  password_hash: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
  password: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
})

const userMasterBodySchema = z.object({
  employee_id: z.string().trim().min(1).max(50),
  employee_name: z.string().trim().min(1).max(150),
  password_hash: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
  password: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
})

const userProjectAssignmentBodySchema = z.object({
  project_id: z.string().trim().min(1).max(50),
  project_description: z.string().trim().min(1).max(255),
  responsibility: z.string().trim().min(1).max(255),
  valid_from: optionalDateString,
  valid_to: optionalDateString,
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
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const createUserMasterSchema = z.object({
  body: userMasterBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const updateUserMasterSchema = z.object({
  body: userMasterBodySchema.omit({ employee_id: true }).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  }),
  params: z.object({
    employeeId: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})

export const updateUserMasterStatusSchema = z.object({
  body: z.object({
    manual_status: z.enum(['Active', 'Inactive']),
  }),
  params: z.object({
    employeeId: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})

export const createUserProjectAssignmentSchema = z.object({
  body: userProjectAssignmentBodySchema,
  params: z.object({
    employeeId: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})

export const updateResponsibilityStatusSchema = z.object({
  body: z.object({
    manual_status: z.enum(['Active', 'Inactive']),
  }),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const changeResponsibilityPasswordSchema = z.object({
  body: z.object({
    password_hash: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
  }),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const changeResponsibilityRoleSchema = z.object({
  body: z.object({
    responsibility: z.string().trim().min(1).max(255),
  }),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const responsibilityIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})
