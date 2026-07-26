import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendOrderConfirmationEmail = vi.hoisted(() => vi.fn())
const mockSendOrderStatusUpdateEmail = vi.hoisted(() => vi.fn())
const mockResolveRecipient = vi.hoisted(() => vi.fn())
const mockSendPushToUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/email', () => ({
  sendOrderConfirmationEmail: mockSendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail: mockSendOrderStatusUpdateEmail,
}))
vi.mock('@/lib/notifications/push', () => ({
  sendPushToUser: mockSendPushToUser,
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/features/account/services/notification-preferences', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/account/services/notification-preferences')
  >('@/features/account/services/notification-preferences')
  return {
    isChannelEnabled: actual.isChannelEnabled,
    resolveNotificationRecipient: mockResolveRecipient,
  }
})

import {
  notifyOrderConfirmation,
  notifyOrderStatusUpdate,
} from '@/lib/notifications/order-notifications'

const confirmation = {
  to: 'customer@example.com',
  customerName: 'Asha',
  orderId: 'ord12345',
  totalAmount: '₹1,200.00',
  shippingAddress: '42 MG Road',
  items: [],
}

const statusUpdate = {
  to: 'customer@example.com',
  customerName: 'Asha',
  orderId: 'ord12345',
  status: 'SHIPPED',
  trackingNumber: 'TRK1',
  shippingProvider: 'BlueDart',
}

const preferences = (overrides: Record<string, boolean> = {}) => ({
  transactionalEmail: true,
  transactionalPush: false,
  transactionalSms: false,
  marketingEmail: false,
  marketingPush: false,
  marketingSms: false,
  ...overrides,
})

describe('order notification dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendPushToUser.mockResolvedValue(1)
  })

  it('sends the confirmation email when transactional email is enabled', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: 'user-1',
      preferences: preferences(),
    })
    await notifyOrderConfirmation(confirmation)
    expect(mockSendOrderConfirmationEmail).toHaveBeenCalledOnce()
    expect(mockSendPushToUser).not.toHaveBeenCalled()
  })

  it('suppresses the confirmation email when the user opted out', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: 'user-1',
      preferences: preferences({ transactionalEmail: false }),
    })
    await notifyOrderConfirmation(confirmation)
    expect(mockSendOrderConfirmationEmail).not.toHaveBeenCalled()
  })

  it('sends push for confirmations when the user opted in', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: 'user-1',
      preferences: preferences({ transactionalPush: true }),
    })
    await notifyOrderConfirmation(confirmation)
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ url: '/orders/ord12345' })
    )
  })

  it('suppresses the status email when the user opted out', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: 'user-1',
      preferences: preferences({ transactionalEmail: false }),
    })
    await notifyOrderStatusUpdate(statusUpdate)
    expect(mockSendOrderStatusUpdateEmail).not.toHaveBeenCalled()
  })

  it('includes tracking details in the status push payload', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: 'user-1',
      preferences: preferences({ transactionalPush: true }),
    })
    await notifyOrderStatusUpdate(statusUpdate)
    const [, payload] = mockSendPushToUser.mock.calls[0]
    expect(payload.title).toBe('Your order has shipped')
    expect(payload.body).toContain('TRK1')
  })

  it('never pushes to guests without a user account', async () => {
    mockResolveRecipient.mockResolvedValue({
      userId: null,
      preferences: preferences({ transactionalPush: true }),
    })
    await notifyOrderStatusUpdate(statusUpdate)
    expect(mockSendPushToUser).not.toHaveBeenCalled()
    expect(mockSendOrderStatusUpdateEmail).toHaveBeenCalledOnce()
  })
})
