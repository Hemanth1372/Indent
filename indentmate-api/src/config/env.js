import 'dotenv/config'

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET']

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

function firstConfiguredValue(value, fallback) {
  return String(value ?? fallback ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean) ?? ''
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  appBaseUrl: firstConfiguredValue(process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN, 'http://localhost:5173'),
  indentApproverEmail: process.env.INDENT_APPROVER_EMAIL ?? '',
  indentApproverName: process.env.INDENT_APPROVER_NAME ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
}
