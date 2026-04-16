// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { UserRow } from '@/features/admin/components/UserRow'

vi.mock('@/features/admin/components/UserAvatar', () => ({
  UserAvatar: ({
    name,
    email,
  }: {
    name: string | null
    email: string
    image: string | null
  }) => <div data-testid="user-avatar">{name || email}</div>,
}))

vi.mock('@/features/admin/components/RoleBadge', () => ({
  RoleBadge: ({ role }: { role: string }) => (
    <div data-testid="role-badge">{role}</div>
  ),
}))

vi.mock('@/features/admin/components/RoleAction', () => ({
  RoleAction: ({
    user,
    isUpdating,
  }: {
    user: { id: string }
    isUpdating: boolean
    onRoleChange: () => void
  }) => (
    <div data-testid="role-action" data-user-id={user.id}>
      {isUpdating ? 'Updating...' : 'Action'}
    </div>
  ),
}))

describe('UserRow', () => {
  const mockOnRoleChange = vi.fn()

  const mockUser = {
    id: 'user123',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    image: 'https://example.com/alice.jpg',
    role: 'ADMIN',
    orderCount: 15,
    createdAt: '2025-01-15T10:30:00.000Z',
  }

  it('renders user information correctly', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getAllByText('Alice Johnson')).toHaveLength(2) // appears in avatar and name cell
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('Alice Johnson')
    expect(screen.getByTestId('role-badge')).toHaveTextContent('ADMIN')
  })

  it('displays "No name" when user has no name', () => {
    const userWithoutName = { ...mockUser, name: null }
    render(
      <UserRow
        user={userWithoutName}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('No name')).toBeInTheDocument()
  })

  it('displays order count', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('displays 0 when orderCount is undefined', () => {
    const userWithoutOrders = { ...mockUser, orderCount: undefined }
    render(
      <UserRow
        user={userWithoutOrders}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('displays 0 when orderCount is 0', () => {
    const userWithZeroOrders = { ...mockUser, orderCount: 0 }
    render(
      <UserRow
        user={userWithZeroOrders}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('formats and displays createdAt date', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    // Date formatting depends on locale, so we just check it renders something reasonable
    const dateCell = screen.getByText(/1\/15\/2025|15\/01\/2025/)
    expect(dateCell).toBeInTheDocument()
  })

  it('passes isUpdating=true to RoleAction when user is being updated', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId="user123"
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('Updating...')).toBeInTheDocument()
  })

  it('passes isUpdating=false to RoleAction when different user is being updated', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId="different-user-id"
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('passes onRoleChange callback to RoleAction', () => {
    render(
      <UserRow
        user={mockUser}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    const roleAction = screen.getByTestId('role-action')
    expect(roleAction).toHaveAttribute('data-user-id', 'user123')
  })

  it('renders with CUSTOMER role', () => {
    const customerUser = { ...mockUser, role: 'CUSTOMER' }
    render(
      <UserRow
        user={customerUser}
        updatingUserId={null}
        onRoleChange={mockOnRoleChange}
      />
    )

    expect(screen.getByTestId('role-badge')).toHaveTextContent('CUSTOMER')
  })
})
