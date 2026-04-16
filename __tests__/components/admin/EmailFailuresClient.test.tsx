// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmailFailuresClient } from '@/features/admin/components/EmailFailuresClient'

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{message}</span>
    </div>
  ),
}))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => (
    <div data-testid="alert-banner">{message}</div>
  ),
}))

const mockRecords = [
  {
    id: 'fail1',
    recipientEmail: 'user@test.com',
    subject: 'Order Confirmation',
    emailType: 'order_confirmation',
    referenceId: 'ORDabc1234',
    attemptCount: 3,
    lastError: 'SMTP timeout',
    isRetriable: true,
    status: 'failed',
    errorHistory: [],
    createdAt: new Date('2025-01-01'),
    lastAttemptedAt: new Date('2025-01-02'),
    sentAt: null,
  },
  {
    id: 'fail2',
    recipientEmail: 'admin@test.com',
    subject: 'Password Reset',
    emailType: 'password_reset',
    referenceId: 'ORDdef5678',
    attemptCount: 1,
    lastError: null,
    isRetriable: true,
    status: 'pending',
    errorHistory: [],
    createdAt: new Date('2025-01-03'),
    lastAttemptedAt: null,
    sentAt: null,
  },
  {
    id: 'sent1',
    recipientEmail: 'done@test.com',
    subject: 'Shipped',
    emailType: 'order_shipped',
    referenceId: 'ORDghi9012',
    attemptCount: 1,
    lastError: null,
    isRetriable: false,
    status: 'sent',
    errorHistory: [],
    createdAt: new Date('2025-01-04'),
    lastAttemptedAt: null,
    sentAt: new Date('2025-01-04'),
  },
]

describe('EmailFailuresClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders empty state when no records', () => {
    render(<EmailFailuresClient initialRecords={[]} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No failed emails')).toBeInTheDocument()
  })

  it('renders table with records', () => {
    render(<EmailFailuresClient initialRecords={mockRecords} />)
    expect(screen.getByText('user@test.com')).toBeInTheDocument()
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    expect(screen.getByText('done@test.com')).toBeInTheDocument()
    expect(screen.getByText('SMTP timeout')).toBeInTheDocument()
  })

  it('shows Retry button for non-sent records only', () => {
    render(<EmailFailuresClient initialRecords={mockRecords} />)
    const retryButtons = screen.getAllByText('Retry')
    expect(retryButtons).toHaveLength(2)
  })

  it('does not show Retry button for sent records', () => {
    render(<EmailFailuresClient initialRecords={[mockRecords[2]]} />)
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  it('retries an email and removes it on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { results: [{ success: true }] },
        }),
      })
    )

    render(<EmailFailuresClient initialRecords={[mockRecords[0]]} />)
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.queryByText('user@test.com')).not.toBeInTheDocument()
    })
  })

  it('shows error banner when retry fails with API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Server error' }),
      })
    )

    render(<EmailFailuresClient initialRecords={[mockRecords[0]]} />)
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('alert-banner')).toHaveTextContent(
        'Server error'
      )
    })
  })

  it('shows error banner when retry result indicates failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { results: [{ success: false, error: 'Bounce' }] },
        }),
      })
    )

    render(<EmailFailuresClient initialRecords={[mockRecords[0]]} />)
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('alert-banner')).toHaveTextContent('Bounce')
    })
  })

  it('shows error banner on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure'))
    )

    render(<EmailFailuresClient initialRecords={[mockRecords[0]]} />)
    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('alert-banner')).toHaveTextContent(
        'Network failure'
      )
    })
  })

  it('shows Retrying button text while retrying', async () => {
    let resolvePromise: (value: unknown) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingPromise))

    render(<EmailFailuresClient initialRecords={[mockRecords[0]]} />)
    fireEvent.click(screen.getByText('Retry'))

    expect(screen.getByText('Retrying…')).toBeInTheDocument()

    resolvePromise!({
      ok: true,
      json: async () => ({
        success: true,
        data: { results: [{ success: true }] },
      }),
    })

    await waitFor(() => {
      expect(screen.queryByText('Retrying…')).not.toBeInTheDocument()
    })
  })

  it('renders status badges with correct text', () => {
    render(<EmailFailuresClient initialRecords={mockRecords} />)
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('sent')).toBeInTheDocument()
  })

  it('shows dash for null lastError', () => {
    render(<EmailFailuresClient initialRecords={[mockRecords[1]]} />)
    const dashElements = screen.getAllByText('—')
    expect(dashElements.length).toBeGreaterThanOrEqual(1)
  })
})
