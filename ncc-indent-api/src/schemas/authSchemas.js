import { z } from 'zod'

export const loginSchema = z.object({
  body: z.object({
    login_name: z.string().trim().min(1),
    password: z.string().min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})
