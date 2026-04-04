import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { RoleAction } from '@/features/admin/components/RoleAction'

vi.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" className={size} />
  ),
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    isOpen,
    title,
    message,
    confirmLabel,
    variant,
    loading,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean
    title: string
    message: string
    confirmLabel: string
    variant: string
    loading: boolean
    onConfirm: () => void
    onCancel: () => void
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog" data-variant={variant}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}))

describe('RoleAction', () => {
  const mockOnRoleChange = vi.fn()

  const mockUser = {
    id: 'user123',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'CUSTOMER' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading spinner when isUpdating is true', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={true}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders select dropdown with current user role', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox', {
      name: /Change role for John Doe/i,
    })
    expect(select).toHaveValue('CUSTOMER')
  })

  it('shows confirm dialog when changing role', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ADMIN' } })

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText('Change User Role')).toBeInTheDocument()
    expect(
      screen.getByText(/Change John Doe's role from "CUSTOMER" to "ADMIN"/)
    ).toBeInTheDocument()
  })

  it('uses email when name is null in confirm dialog', () => {
    const userWithoutName = { ...mockUser, name: null }
    render(
      <RoleAction
        user={userWithoutName}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ADMIN' } })

    expect(
      screen.getByText(
        /Change john@example.com's role from "CUSTOMER" to "ADMIN"/
      )
    ).toBeInTheDocument()
  })

  it('calls onRoleChange when confirming role change', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ADMIN' } })

    const confirmButton = screen.getByText('Yes, change role')
    fireEvent.click(confirmButton)

    expect(mockOnRoleChange).toHaveBeenCalledWith('user123', 'ADMIN')
  })

  it('closes dialog when canceling role change', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ADMIN' } })

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('does not show dialog when selecting the same role', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'CUSTOMER' } })

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('handles ADMIN user changing to CUSTOMER', () => {
    const adminUser = { ...mockUser, role: 'ADMIN' as const }
    render(
      <RoleAction
        user={adminUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('ADMIN')

    fireEvent.change(select, { target: { value: 'CUSTOMER' } })

    expect(
      screen.getByText(/Change John Doe's role from "ADMIN" to "CUSTOMER"/)
    ).toBeInTheDocument()

    const confirmButton = screen.getByText('Yes, change role')
    fireEvent.click(confirmButton)

    expect(mockOnRoleChange).toHaveBeenCalledWith('user123', 'CUSTOMER')
  })
})
