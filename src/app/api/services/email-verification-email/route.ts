import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-utils'
import { getQStashReceiver } from '@/lib/qstash'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'

const EmailVerificationEventSchema = z.object({
  type: z.literal('auth.email_verification_requested'),
  data: z.object({
    to: z.email(),
    customerName: z.string().min(1),
    verifyUrl: z.url(),
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
  } catch (error) {
    logger.warn({ messageId, err: error }, 'qstash_signature_invalid')
    return apiError('Invalid signature', 401)
  }
}

const createEmailVerificationEmail = ({
  customerName,
  verifyUrl,
}: {
  customerName: string
  verifyUrl: string
}) => {
  const safeName = escapeHtml(customerName)
  const safeUrl = escapeHtml(verifyUrl)

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;">
      <h2 style="margin:0 0 16px;">Verify your email</h2>
      <p style="margin:0 0 16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;">
        Thanks for creating your account. Please verify your email address to activate sign-in.
      </p>
      <p style="margin:0 0 20px;">
        <a
          href="${safeUrl}"
          style="display:inline-block;background:#b83060;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;"
        >
          Verify email
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
        This link expires in 30 minutes and can be used only once.
      </p>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        If you didn't create this account, you can safely ignore this email.
      </p>
    </div>
  `

  const text = `Hi ${customerName},\n\nThanks for creating your account.\nPlease verify your email address using this link (valid for 30 minutes):\n${verifyUrl}\n\nIf you didn't create this account, you can safely ignore this email.`

  return {
    subject: 'Verify your email address',
    html,
    text,
  }
}

export async function POST(request: NextRequest) {
  const messageId = request.headers.get('Upstash-Message-Id') ?? undefined
  const bodyText = await request.text()

  const signatureError = await verifyQStashSignature(
    request,
    bodyText,
    messageId
  )
  if (signatureError) {
    return signatureError
  }

  let rawBody: unknown
  try {
    rawBody = JSON.parse(bodyText)
  } catch (error) {
    logger.warn(
      { messageId, err: error },
      'email_verification_payload_invalid_json'
    )
    return apiError('Invalid payload', 400)
  }

  const parseResult = EmailVerificationEventSchema.safeParse(rawBody)
  if (!parseResult.success) {
    return apiError('Invalid payload', 400)
  }

  const event = parseResult.data
  const message = createEmailVerificationEmail({
    customerName: event.data.customerName,
    verifyUrl: event.data.verifyUrl,
  })

  await sendEmail({
    to: event.data.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })

  return apiSuccess({ sent: true })
}
