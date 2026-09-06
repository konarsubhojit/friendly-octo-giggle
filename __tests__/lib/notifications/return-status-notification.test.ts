import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveRecipient,
  mockIsChannelEnabled,
  mockDeliverReturnEmail,
  mockSendPushToUser,
} = vi.hoisted(() => ({
  mockResolveRecipient: vi.fn(),
  mockIsChannelEnabled: vi.fn(),
  mockDeliverReturnEmail: vi.fn(),
  mockSendPushToUser: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: vi.fn(),
  sendOrderRefundUpdateEmail: vi.fn(),
  sendOrderStatusUpdateEmail: vi.fn(),
  deliverOrderConfirmationEmail: vi.fn(),
  deliverOrderRefundUpdateEmail: vi.fn(),
  deliverOrderStatusUpdateEmail: vi.fn(),
  deliverReturnStatusUpdateEmail: mockDeliverReturnEmail,
}))

vi.mock('@/features/account/services/notification-preferences', () => ({
  resolveNotificationRecipient: mockResolveRecipient,
  isChannelEnabled: mockIsChannelEnabled,
}))

vi.mock('@/lib/notifications/push', () => ({
  sendPushToUser: mockSendPushToUser,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

import { deliverReturnStatusNotification } from '@/lib/notifications/order-notifications'

const notification = {
  to: 'customer@example.com',
  customerName: 'A. Sharma',
  orderId: 'ORD1234567',
  returnId: 'r7N8p9Q',
  status: 'APPROVED' as const,
  decisionReason: 'Damage confirmed from photos.',
  refundAmount: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveRecipient.mockResolvedValue({
    userId: 'user-1',
    preferences: {},
  })
  mockDeliverReturnEmail.mockResolvedValue({ delivered: true })
  mockSendPushToUser.mockResolvedValue(undefined)
})

describe('deliverReturnStatusNotification', () => {
  it('sends email when the transactional email channel is permitted', async () => {
    mockIsChannelEnabled.mockReturnValue(true)

    const result = await deliverReturnStatusNotification(notification)

    expect(mockDeliverReturnEmail).toHaveBeenCalledWith(notification)
    expect(result.emailSuppressed).toBe(false)
  })

  it('suppresses email when the customer has opted out', async () => {
    // SC-006: status changes reach customers only through channels their
    // preferences permit. Opting out must silence the message, not merely
    // reorder it.
    mockIsChannelEnabled.mockReturnValue(false)

    const result = await deliverReturnStatusNotification(notification)

    expect(mockDeliverReturnEmail).not.toHaveBeenCalled()
    expect(result.emailSuppressed).toBe(true)
  })

  it('treats suppression as a success, not a failure', async () => {
    // A suppressed email must not look like a delivery failure, or the
    // durable step would retry it forever against a preference that will
    // never change on its own.
    mockIsChannelEnabled.mockReturnValue(false)

    const result = await deliverReturnStatusNotification(notification)

    expect(result.emailDelivered).toBe(false)
    expect(result.emailSuppressed).toBe(true)
  })

  it('checks the transactional category, never marketing', async () => {
    // A return update is service communication about a transaction the
    // customer started — gating it on the marketing preference would let a
    // marketing opt-out silence an operational message.
    mockIsChannelEnabled.mockReturnValue(true)

    await deliverReturnStatusNotification(notification)

    expect(mockIsChannelEnabled).toHaveBeenCalledWith(
      expect.anything(),
      'transactional',
      'email'
    )
  })

  it('sends push only when that channel is permitted too', async () => {
    mockIsChannelEnabled.mockImplementation(
      (_prefs: unknown, _category: unknown, channel: string) =>
        channel === 'email'
    )

    await deliverReturnStatusNotification(notification)

    expect(mockSendPushToUser).not.toHaveBeenCalled()
  })

  it('does not let a push failure break email delivery', async () => {
    mockIsChannelEnabled.mockReturnValue(true)
    mockSendPushToUser.mockRejectedValue(new Error('push gone'))

    const result = await deliverReturnStatusNotification(notification)

    expect(result.emailDelivered).toBe(true)
  })
})
