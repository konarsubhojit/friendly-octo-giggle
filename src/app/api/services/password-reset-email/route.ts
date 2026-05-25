import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getQStashReceiver } from '@/lib/qstash'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'

const PasswordResetEventSchema = z.object({
  type: z.literal('password.reset_requested'),
  data: z.object({
    to: z.email(),
    customerName: z.string().min(1),
    resetUrl: z.url(),
  }),
})

const verifyQStashSignature = async (
  request: NextRequest,
  bodyText: string,
  messageId: string | undefined
) => {
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    return null
  }

  const signature = request.headers.get('Upstash-Signature')
  if (!signature) {
    logger.warn({ messageId }, 'qstash_signature_invalid')
    return apiError('Invalid signature', 401)
  }

  try {
    await getQStashReceiver().verify({ signature, body: bodyText })
    return null
  } catch {
    logger.warn({ messageId }, 'qstash_signature_invalid')
    return apiError('Invalid signature', 401)
  }
}

const createPasswordResetEmail = ({
  customerName,
  resetUrl,
}: {
  customerName: string
  resetUrl: string
}) => {
  const safeName = escapeHtml(customerName)
  const safeUrl = escapeHtml(resetUrl)

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;">
      <h2 style="margin:0 0 16px;">Reset your password</h2>
      <p style="margin:0 0 16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;">
        We received a request to reset your password. Use the button below to choose a new password.
      </p>
      <p style="margin:0 0 20px;">
        <a
          href="${safeUrl}"
          style="display:inline-block;background:#b83060;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;"
        >
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
        This link expires in 30 minutes and can be used only once.
      </p>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `

  const text = `Hi ${customerName},\n\nWe received a request to reset your password.\nUse this link to set a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`

  return {
    subject: 'Reset your password',
    html,
    text,
  }
}

export async function POST(request: NextRequest) {
  const messageId = request.headers.get('Upstash-Message-Id') ?? undefined
  const bodyText = await request.text()

  const signatureError = await verifyQStashSignature(request, bodyText, messageId)
  if (signatureError) {
    return signatureError
  }

  let rawBody: unknown
  try {
    rawBody = JSON.parse(bodyText)
  } catch {
    return apiError('Invalid payload', 400)
  }

  const parseResult = PasswordResetEventSchema.safeParse(rawBody)
  if (!parseResult.success) {
    return apiError('Invalid payload', 400)
  }

  const event = parseResult.data
  const message = createPasswordResetEmail({
    customerName: event.data.customerName,
    resetUrl: event.data.resetUrl,
  })

  await sendEmail({
    to: event.data.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })

  return apiSuccess({ sent: true })
}

