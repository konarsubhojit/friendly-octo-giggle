// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { RoleAction } from '@/features/admin/components/RoleAction'

vi.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" className={size} />
  ),
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

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Change User Role')).toBeInTheDocument()
    expect(
      screen.getByText(/Change John Doe's role from "Customer" to "Admin"/)
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
        /Change john@example.com's role from "Customer" to "Admin"/
      )
    ).toBeInTheDocument()
  })

  it('calls onRoleChange when confirming role change with typed confirmation', () => {
    render(
      <RoleAction
        user={mockUser}
        isUpdating={false}
        onRoleChange={mockOnRoleChange}
      />
    )

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'ADMIN' } })

    // AdminConfirmDialog requires typing the confirmation phrase
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CHANGE ROLE' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmButton).not.toBeDisabled()
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

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
      screen.getByText(/Change John Doe's role from "Admin" to "Customer"/)
    ).toBeInTheDocument()

    // Type confirmation and confirm
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CHANGE ROLE' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    fireEvent.click(confirmButton)

    expect(mockOnRoleChange).toHaveBeenCalledWith('user123', 'CUSTOMER')
  })
})
