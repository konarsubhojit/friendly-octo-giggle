import { escapeHtml } from '@/lib/email/templates'

export interface AuthEmailMessage {
  readonly subject: string
  readonly html: string
  readonly text: string
}

interface AuthActionEmailInput {
  readonly heading: string
  readonly greetingName: string
  readonly intro: string
  readonly ctaLabel: string
  readonly ctaUrl: string
  readonly disclaimer: string
  readonly subject: string
  readonly textBody: string
}

/**
 * Shared shell for the two account-security emails.
 *
 * Verification and password reset were byte-for-byte identical apart from four
 * strings, duplicated across two QStash worker routes. Collapsing them means a
 * styling or copy fix can no longer land in one and miss the other.
 */
const renderAuthActionEmail = ({
  heading,
  greetingName,
  intro,
  ctaLabel,
  ctaUrl,
  disclaimer,
  subject,
  textBody,
}: AuthActionEmailInput): AuthEmailMessage => {
  const safeName = escapeHtml(greetingName)
  const safeUrl = escapeHtml(ctaUrl)

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;">
      <h2 style="margin:0 0 16px;">${heading}</h2>
      <p style="margin:0 0 16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;">
        ${intro}
      </p>
      <p style="margin:0 0 20px;">
        <a
          href="${safeUrl}"
          style="display:inline-block;background:#b83060;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;"
        >
          ${ctaLabel}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
        This link expires in 30 minutes and can be used only once.
      </p>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        ${disclaimer}
      </p>
    </div>
  `

  return { subject, html, text: textBody }
}

export const createEmailVerificationEmail = ({
  customerName,
  verifyUrl,
}: {
  customerName: string
  verifyUrl: string
}): AuthEmailMessage =>
  renderAuthActionEmail({
    heading: 'Verify your email',
    greetingName: customerName,
    intro:
      'Thanks for creating your account. Please verify your email address to activate sign-in.',
    ctaLabel: 'Verify email',
    ctaUrl: verifyUrl,
    disclaimer:
      "If you didn't create this account, you can safely ignore this email.",
    subject: 'Verify your email address',
    textBody: `Hi ${customerName},\n\nThanks for creating your account.\nPlease verify your email address using this link (valid for 30 minutes):\n${verifyUrl}\n\nIf you didn't create this account, you can safely ignore this email.`,
  })

export const createPasswordResetEmail = ({
  customerName,
  resetUrl,
}: {
  customerName: string
  resetUrl: string
}): AuthEmailMessage =>
  renderAuthActionEmail({
    heading: 'Reset your password',
    greetingName: customerName,
    intro:
      'We received a request to reset your password. Use the button below to choose a new password.',
    ctaLabel: 'Reset password',
    ctaUrl: resetUrl,
    disclaimer: "If you didn't request this, you can safely ignore this email.",
    subject: 'Reset your password',
    textBody: `Hi ${customerName},\n\nWe received a request to reset your password.\nUse this link to set a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
  })
