import { env } from '../config/env.js'

let transporterPromise = null

export async function sendMail({ html, subject, text, to }) {
  if (!to) {
    console.warn('Indent notification skipped: no recipient email configured.')
    return { skipped: true, reason: 'missing_recipient' }
  }

  if (!env.smtpHost || !env.smtpFrom) {
    console.warn('Indent notification skipped: SMTP_HOST and SMTP_FROM/SMTP_USER are required.')
    return { skipped: true, reason: 'missing_smtp_config' }
  }

  const transporter = await getTransporter()

  if (!transporter) {
    return { skipped: true, reason: 'missing_mail_dependency' }
  }

  return transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html,
  })
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then((module) => {
        const nodemailer = module.default ?? module
        return nodemailer.createTransport({
          host: env.smtpHost,
          port: env.smtpPort,
          secure: env.smtpSecure,
          auth: env.smtpUser && env.smtpPass
            ? {
                user: env.smtpUser,
                pass: env.smtpPass,
              }
            : undefined,
        })
      })
      .catch((error) => {
        console.warn('Indent notification skipped: install nodemailer to enable SMTP email.', error.message)
        return null
      })
  }

  return transporterPromise
}
