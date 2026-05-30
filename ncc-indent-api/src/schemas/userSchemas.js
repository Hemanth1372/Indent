import { z } from 'zod'

export const createUserSchema = z.object({
  body: z.object({
    login_name: z.string().trim().min(1).max(50),
    employee_name: z.string().trim().min(2).max(100),
    employee_id_str: z.string().trim().max(50).optional(),
    primary_role: z.string().trim().max(50).optional(),
    password: z.string().min(8).max(128).optional(),
    is_active: z.boolean().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const updateUserStatusSchema = z.object({
  body: z.object({
    is_active: z.boolean(),
  }),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})

export const changeUserPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(6).max(128),
  }),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({}).optional(),
})

export const syncUserPinSchema = z.object({
  body: z.object({
    login_name: z.string().trim().min(1).max(50),
    employee_name: z.string().trim().min(1).max(100).optional(),
    current_pin: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const lookupUserSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    loginName: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})
