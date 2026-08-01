// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsSection } from '@/app/(public)/account/NotificationsSection'

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
}))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => (
    <div data-testid="alert-banner">{message}</div>
  ),
}))

const defaultPreferences = {
  transactionalEmail: true,
  transactionalPush: false,
  transactionalSms: false,
  marketingEmail: false,
  marketingPush: false,
  marketingSms: false,
}

const settingsResponse = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    preferences: defaultPreferences,
    pushEnabled: true,
    vapidPublicKey: 'public-key',
    ...overrides,
  },
})

describe('NotificationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both preference groups from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => settingsResponse(),
      })
    )

    render(<NotificationsSection />)

    expect(await screen.findByText('Order updates')).toBeInTheDocument()
    expect(screen.getByText('Offers and reminders')).toBeInTheDocument()
    expect(screen.getByLabelText('Order updates: Email')).toBeInTheDocument()
  })

  it('explains when push is not configured for the store', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      serviceWorker: { ready: Promise.resolve({}) },
    })
    vi.stubGlobal('PushManager', class {})

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          settingsResponse({ pushEnabled: false, vapidPublicKey: null }),
      })
    )

    render(<NotificationsSection />)

    expect(
      await screen.findByText(
        'Push notifications are not configured for this store yet.'
      )
    ).toBeInTheDocument()
  })

  it('persists a toggled channel through the API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => settingsResponse() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            preferences: { ...defaultPreferences, marketingEmail: true },
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<NotificationsSection />)

    const marketingEmail = await screen.findByLabelText(
      'Offers and reminders: Email'
    )
    fireEvent.click(marketingEmail)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/notifications',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
    const [, init] = fetchMock.mock.calls[1]
    expect(JSON.parse(init.body as string)).toEqual({ marketingEmail: true })
  })

  it('surfaces an error when the API responds unsuccessfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'boom' }),
      })
    )

    render(<NotificationsSection />)

    expect(
      await screen.findByText('Could not load your notification preferences.')
    ).toBeInTheDocument()
  })

  it('surfaces an error when loading preferences fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    render(<NotificationsSection />)

    expect(
      await screen.findByText('Could not load your notification preferences.')
    ).toBeInTheDocument()
  })
})
