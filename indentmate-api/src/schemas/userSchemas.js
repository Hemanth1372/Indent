import { z } from 'zod'

export const SYSTEM_ROLES = [
  'HO Purchase Head (HOP)',
  'Accounts Incharge (ACI)',
  'AMD 2nd Level (AM2)',
  'AMD Head (AMD)',
  'AMD PR Assigner (APA)',
  'AMD Project Co-ordinator (APC)',
  'AMD procurement lead (APL)',
  'HO procurement (HOL)',
  'Human Resource Incharge (HRI)',
  'Project Coordinator (PRC)',
  'Project Incharge (PRI)',
  'Division / Region Commercial Head (RCH)',
  'RO Incharge (ROI)',
  'RO procurement (ROL)',
  'RO Purchase Head (ROP)',
  'Division / Region Technical Head (RTH)',
  'RWS In-charge (RWI)',
  'Site procurement (SPL)',
  'Director (DIR)',
  'EXECUTIVE DIRECTOR (EXD)',
  'PR Assigner (PUA)',
  'QS Engineer (QSE)',
  'Site Engineer (SIE)',
  'F&A Head (AFH)',
  'Department Head (DPH)',
  'Procurement Incharge (PUI)',
  'Director Projects (DP)',
  'Division Accounts Coordinator (DAC)',
]

const roleSchema = z.enum(SYSTEM_ROLES)
const nullableDateSchema = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
)

export const createUserSchema = z.object({
  body: z.object({
    employee_id: z.string().trim().min(1).max(50),
    employee_name: z.string().trim().min(2).max(150),
    project_id: z.string().trim().min(1).max(50),
    project_description: z.string().trim().min(1).max(255),
    responsibility: roleSchema,
    valid_from: nullableDateSchema,
    valid_to: nullableDateSchema,
    manual_status: z.enum(['Active', 'Inactive']).optional(),
    password: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
})

export const updateUserStatusSchema = z.object({
  body: z.object({
    manual_status: z.enum(['Active', 'Inactive']),
  }),
  params: z.object({
    employeeId: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})

export const updateUserRoleSchema = z.object({
  body: z.object({
    responsibility: roleSchema,
  }),
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const changeUserPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
  }),
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const deleteUserSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
})

export const syncUserPinSchema = z.object({
  body: z.object({
    employee_id: z.string().trim().min(1).max(50).optional(),
    login_name: z.string().trim().min(1).max(50).optional(),
    employee_name: z.string().trim().min(1).max(100).optional(),
    current_pin: z.string().trim().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
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

export const lookupUserSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    loginName: z.string().trim().min(1).max(50),
  }),
  query: z.object({}).optional(),
})
