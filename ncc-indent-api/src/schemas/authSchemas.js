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
