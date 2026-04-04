import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PasswordSection } from '@/app/account/PasswordSection'

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
            currentPassword: 'OldPass1!',
            newPassword: 'NewPass1!',
            confirmNewPassword: 'NewPass1!',
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

describe('PasswordSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders password heading and description in read mode', () => {
    render(<PasswordSection />)
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByText(/Your password is set/)).toBeInTheDocument()
  })

  it('shows Change Password button in read mode', () => {
    render(<PasswordSection />)
    expect(
      screen.getByRole('button', { name: /change password/i })
    ).toBeInTheDocument()
  })

  it('switches to edit mode when Change Password is clicked', () => {
    render(<PasswordSection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    expect(screen.queryByText(/Your password is set/)).not.toBeInTheDocument()
  })

  it('switches back to read mode when Cancel is clicked', () => {
    render(<PasswordSection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('dynamic-form')).not.toBeInTheDocument()
    expect(screen.getByText(/Your password is set/)).toBeInTheDocument()
  })

  it('shows success message after successful password change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    )

    render(<PasswordSection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    fireEvent.click(screen.getByText('Change Password'))

    await waitFor(() => {
      expect(
        screen.getByText('Password changed successfully.')
      ).toBeInTheDocument()
    })
  })

  it('returns error string when password change fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Current password incorrect' }),
      })
    )

    render(<PasswordSection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    fireEvent.click(screen.getByText('Change Password'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'Current password incorrect'
      )
    })
  })

  it('returns error string on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    render(<PasswordSection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    fireEvent.click(screen.getByText('Change Password'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeInTheDocument()
    })
  })
})
