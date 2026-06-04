import { z } from 'zod'

export const loginSchema = z.object({
  body: z.object({
    employee_id: z.string().trim().min(1).optional(),
    login_name: z.string().trim().min(1).optional(),
    password: z.string().min(1),
  }).superRefine((body, ctx) => {
    if (!body.employee_id && !body.login_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Employee ID is required',
        path: ['employee_id'],
      })
    }
  }).transform((body) => ({
    ...body,
    login_name: body.employee_id ?? body.login_name,
  })),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const adminForgotPasswordSchema = z.object({
  body: z.object({
    employee_id: z.string().trim().min(1, 'Employee ID is required'),
    password: z.string().trim().regex(/^\d{6}$/, 'Password must be exactly 6 digits'),
    confirm_password: z.string().trim().regex(/^\d{6}$/, 'Confirm password must be exactly 6 digits'),
  }).superRefine((body, ctx) => {
    if (body.password !== body.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both password fields must match',
        path: ['confirm_password'],
      })
    }
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})
