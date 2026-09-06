import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSendWithRetry,
  mockDeliverEmail,
  mockMailerSendSend,
  mockCreateTransport,
  mockSmtpSendMail,
} = vi.hoisted(() => ({
  mockSendWithRetry: vi.fn(),
  mockDeliverEmail: vi.fn(),
  mockMailerSendSend: vi.fn(),
  mockCreateTransport: vi.fn(),
  mockSmtpSendMail: vi.fn(),
}))

vi.mock('@/lib/email/retry', () => ({
  sendWithRetry: mockSendWithRetry,
}))

vi.mock('@/lib/email/providers', () => ({
  deliverEmail: mockDeliverEmail,
}))

vi.mock('mailersend', () => ({
  MailerSend: vi.fn().mockImplementation(() => ({
    email: { send: mockMailerSendSend },
  })),
  EmailParams: vi.fn().mockImplementation(() => {
    const builder = {
      setFrom: vi.fn(),
      setTo: vi.fn(),
      setReplyTo: vi.fn(),
      setSubject: vi.fn(),
      setHtml: vi.fn(),
      setText: vi.fn(),
    }
    builder.setFrom.mockReturnValue(builder)
    builder.setTo.mockReturnValue(builder)
    builder.setReplyTo.mockReturnValue(builder)
    builder.setSubject.mockReturnValue(builder)
    builder.setHtml.mockReturnValue(builder)
    builder.setText.mockReturnValue(builder)
    return builder
  }),
  Sender: vi.fn(),
  Recipient: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/email/failed-emails', () => ({
  saveFailedEmail: vi.fn().mockResolvedValue('mock-id'),
}))

import { escapeHtml } from '@/lib/email'

describe('lib/email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTransport.mockReturnValue({ sendMail: mockSmtpSendMail })
  })

  describe('escapeHtml', () => {
    it('escapes &, <, >, ", and \'', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b')
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
      expect(escapeHtml("it's")).toBe('it&#39;s')
    })

    it('returns unchanged string when no special chars', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
    })
  })

  describe('sendOrderConfirmationEmail', () => {
    it('calls sendWithRetry with correct recipient and subject', async () => {
      vi.resetModules()
      const { sendOrderConfirmationEmail } = await import('@/lib/email')

      sendOrderConfirmationEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        totalAmount: '$42.00',
        items: [{ name: 'Widget', quantity: 1, price: '$42.00' }],
        shippingAddress: '123 Main St',
      })

      expect(mockSendWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: expect.stringContaining('ABC1234'),
        }),
        expect.objectContaining({
          emailType: 'order_confirmation',
          referenceId: 'abc1234',
        })
      )
    })

    it('includes order items in the email body', async () => {
      vi.resetModules()
      const { sendOrderConfirmationEmail } = await import('@/lib/email')

      sendOrderConfirmationEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        totalAmount: '$42.00',
        items: [
          {
            name: 'SuperWidget',
            quantity: 2,
            price: '$21.00',
            variant: 'Red',
          },
        ],
        shippingAddress: '123 Main St',
      })

      const [msg] = mockSendWithRetry.mock.calls[0] as [
        { html: string; text: string },
        unknown,
      ]
      expect(msg.html).toContain('SuperWidget')
      expect(msg.text).toContain('SuperWidget')
    })

    it('includes shipping address in the email body', async () => {
      vi.resetModules()
      const { sendOrderConfirmationEmail } = await import('@/lib/email')

      sendOrderConfirmationEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        totalAmount: '$42.00',
        items: [{ name: 'Widget', quantity: 1, price: '$42.00' }],
        shippingAddress: '456 Elm Avenue',
      })

      const [msg] = mockSendWithRetry.mock.calls[0] as [
        { html: string; text: string },
        unknown,
      ]
      expect(msg.html).toContain('456 Elm Avenue')
    })

    it('returns void (fire-and-forget)', async () => {
      vi.resetModules()
      const { sendOrderConfirmationEmail } = await import('@/lib/email')

      const result = sendOrderConfirmationEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        totalAmount: '$42.00',
        items: [{ name: 'Widget', quantity: 1, price: '$42.00' }],
        shippingAddress: '123 Main St',
      })

      expect(result).toBeUndefined()
    })
  })

  describe('sendOrderStatusUpdateEmail', () => {
    it('calls sendWithRetry for SHIPPED with tracking number', async () => {
      vi.resetModules()
      const { sendOrderStatusUpdateEmail } = await import('@/lib/email')

      sendOrderStatusUpdateEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        status: 'SHIPPED',
        trackingNumber: 'TRK123456',
        shippingProvider: 'FedEx',
      })

      const [msg] = mockSendWithRetry.mock.calls[0] as [
        { html: string; text: string },
        unknown,
      ]
      expect(msg.html).toContain('TRK123456')
    })

    it('calls sendWithRetry for DELIVERED with correct subject', async () => {
      vi.resetModules()
      const { sendOrderStatusUpdateEmail } = await import('@/lib/email')

      sendOrderStatusUpdateEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        status: 'DELIVERED',
      })

      expect(mockSendWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Delivered'),
        }),
        expect.objectContaining({
          emailType: 'order_status_update',
          referenceId: 'abc1234',
        })
      )
    })

    it('calls sendWithRetry for CANCELLED', async () => {
      vi.resetModules()
      const { sendOrderStatusUpdateEmail } = await import('@/lib/email')

      sendOrderStatusUpdateEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        status: 'CANCELLED',
      })

      expect(mockSendWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@test.com' }),
        expect.objectContaining({ emailType: 'order_status_update' })
      )
    })

    it('returns void (fire-and-forget)', async () => {
      vi.resetModules()
      const { sendOrderStatusUpdateEmail } = await import('@/lib/email')

      const result = sendOrderStatusUpdateEmail({
        to: 'user@test.com',
        customerName: 'Jane',
        orderId: 'abc1234',
        status: 'SHIPPED',
      })

      expect(result).toBeUndefined()
    })
  })

  it('delivers each durable email template through the provider', async () => {
    mockDeliverEmail.mockResolvedValue({ provider: 'smtp', messageId: 'sent' })
    vi.resetModules()
    const email = await import('@/lib/email')

    await email.deliverOrderConfirmationEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      orderId: 'abc1234',
      totalAmount: '₹42.00',
      items: [{ name: 'Widget', quantity: 1, price: '₹42.00' }],
      shippingAddress: '123 Main St',
    })
    await email.deliverOrderStatusUpdateEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      orderId: 'abc1234',
      status: 'SHIPPED',
    })
    await email.deliverOrderRefundUpdateEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      orderId: 'abc1234',
      status: 'PROCESSED',
      refundAmount: '₹42.00',
      isPartial: false,
    })
    await email.deliverReturnStatusUpdateEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      orderId: 'abc1234',
      returnId: 'return1',
      status: 'APPROVED',
    })
    await email.deliverAbandonedCartReminderEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      cartUrl: 'https://example.test/cart',
      items: [{ name: 'Widget', quantity: 1, price: '₹42.00' }],
      reminderNumber: 1,
    })

    expect(mockDeliverEmail).toHaveBeenCalledTimes(5)
    expect(mockDeliverEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: expect.any(String),
      })
    )
  })

  it('queues refund and abandoned-cart email templates with retry metadata', async () => {
    vi.resetModules()
    const { sendAbandonedCartReminderEmail, sendOrderRefundUpdateEmail } =
      await import('@/lib/email')

    sendOrderRefundUpdateEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      orderId: 'abc1234',
      status: 'PENDING',
      refundAmount: '₹21.00',
      isPartial: true,
    })
    sendAbandonedCartReminderEmail({
      to: 'user@test.com',
      customerName: 'Jane',
      cartId: 'cart123',
      cartUrl: 'https://example.test/cart',
      items: [{ name: 'Widget', quantity: 1, price: '₹42.00' }],
      reminderNumber: 2,
    })

    expect(mockSendWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com' }),
      { emailType: 'order_refund_update', referenceId: 'abc1234' }
    )
    expect(mockSendWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.com' }),
      { emailType: 'abandoned_cart_reminder', referenceId: 'cart123' }
    )
  })
})
