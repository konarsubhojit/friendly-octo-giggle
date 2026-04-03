import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockUseSession = vi.hoisted(() => vi.fn())

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}))

vi.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading…</div>,
}))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => (
    <div data-testid="alert-banner">{message}</div>
  ),
}))

vi.mock('@/components/ui/AuthRequiredState', () => ({
  AuthRequiredState: ({ message }: { message: string }) => (
    <div data-testid="auth-required">{message}</div>
  ),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/GradientHeading', () => ({
  GradientHeading: ({ children }: { children: React.ReactNode }) => (
    <h1 data-testid="gradient-heading">{children}</h1>
  ),
}))

vi.mock('@/app/account/ProfileSection', () => ({
  ProfileSection: ({ profile }: { profile: { name: string } }) => (
    <div data-testid="profile-section">{profile.name}</div>
  ),
}))

vi.mock('@/app/account/PreferencesSection', () => ({
  PreferencesSection: () => <div data-testid="preferences-section" />,
}))

vi.mock('@/app/account/PasswordSection', () => ({
  PasswordSection: () => <div data-testid="password-section" />,
}))

vi.mock('@/app/account/RecentOrdersSection', () => ({
  RecentOrdersSection: () => <div data-testid="recent-orders-section" />,
}))

import AccountClient from '@/app/account/AccountClient'

describe('AccountClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading spinner while auth status is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' })
    render(<AccountClient />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('shows auth required state when unauthenticated', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(<AccountClient />)
    await waitFor(() => {
      expect(screen.getByTestId('auth-required')).toBeInTheDocument()
    })
  })

  it('fetches profile and renders sections when authenticated', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Alice', email: 'alice@test.com' } },
      status: 'authenticated',
    })

    const mockProfile = {
      id: 'usr1234',
      name: 'Alice',
      email: 'alice@test.com',
      phoneNumber: null,
      image: null,
      role: 'USER',
      hasPassword: true,
      currencyPreference: 'INR',
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: mockProfile }),
      })
    )

    render(<AccountClient />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-section')).toBeInTheDocument()
    })

    expect(screen.getByText('My Account')).toBeInTheDocument()
    expect(screen.getByTestId('recent-orders-section')).toBeInTheDocument()
    expect(screen.getByTestId('preferences-section')).toBeInTheDocument()
    expect(screen.getByTestId('password-section')).toBeInTheDocument()
  })

  it('shows social login message when user has no password', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Bob', email: 'bob@test.com' } },
      status: 'authenticated',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: {
            id: 'usr5678',
            name: 'Bob',
            email: 'bob@test.com',
            phoneNumber: null,
            image: null,
            role: 'USER',
            hasPassword: false,
            currencyPreference: 'INR',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        }),
      })
    )

    render(<AccountClient />)

    await waitFor(() => {
      expect(screen.getByText(/social login/i)).toBeInTheDocument()
    })

    expect(screen.queryByTestId('password-section')).not.toBeInTheDocument()
  })

  it('shows error banner when profile fetch fails', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Alice', email: 'alice@test.com' } },
      status: 'authenticated',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false }),
      })
    )

    render(<AccountClient />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-banner')).toBeInTheDocument()
    })
  })

  it('shows error banner when fetch throws', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Alice', email: 'alice@test.com' } },
      status: 'authenticated',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    render(<AccountClient />)

    await waitFor(() => {
      expect(screen.getByTestId('alert-banner')).toBeInTheDocument()
    })
  })
})
