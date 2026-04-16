// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileSection } from '@/app/account/ProfileSection'

vi.mock('@/components/ui/Card', () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/DynamicForm', () => ({
  DynamicForm: ({
    onSubmit,
    onCancel,
    submitLabel,
  }: {
    onSubmit: (values: Record<string, string>) => Promise<string | undefined>
    onCancel: () => void
    submitLabel: string
  }) => {
    const [error, setError] = React.useState<string | null>(null)
    return (
      <form
        data-testid="dynamic-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await onSubmit({
            name: 'Updated Name',
            email: 'updated@test.com',
            phoneNumber: '+1234567890',
          })
          if (result) setError(result)
        }}
      >
        {error && <div data-testid="form-error">{error}</div>}
        <button type="submit">{submitLabel}</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
    )
  },
}))

const mockProfile = {
  id: 'usr1234',
  name: 'Alice',
  email: 'alice@test.com',
  phoneNumber: '+1234567890',
  image: null,
  role: 'USER',
  hasPassword: true,
  currencyPreference: 'INR',
  createdAt: '2025-01-15T00:00:00.000Z',
}

describe('ProfileSection', () => {
  const onProfileUpdated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders profile information in read mode', () => {
    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )
    expect(screen.getByText('Profile Information')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('+1234567890')).toBeInTheDocument()
    expect(screen.getByText(/January 15, 2025/)).toBeInTheDocument()
  })

  it('shows "Not set" for null name and phone', () => {
    const profileNoName = { ...mockProfile, name: null, phoneNumber: null }
    render(
      <ProfileSection
        profile={profileNoName}
        onProfileUpdated={onProfileUpdated}
      />
    )
    const notSetElements = screen.getAllByText('Not set')
    expect(notSetElements).toHaveLength(2)
  })

  it('switches to edit mode when Edit button is clicked', () => {
    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
  })

  it('switches back to read mode when Cancel is clicked', () => {
    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('dynamic-form')).not.toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows success message after successful profile update', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    )

    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(
        screen.getByText('Profile updated successfully.')
      ).toBeInTheDocument()
    })
    expect(onProfileUpdated).toHaveBeenCalled()
  })

  it('returns error string when profile update fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Email already taken' }),
      })
    )

    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'Email already taken'
      )
    })
  })

  it('returns error string on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    render(
      <ProfileSection
        profile={mockProfile}
        onProfileUpdated={onProfileUpdated}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }))
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeInTheDocument()
    })
  })
})
