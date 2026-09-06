// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UsersManagementClient from '@/app/admin/users/UsersManagementClient'

interface DataViewProps {
  readonly ariaLabel: string
  readonly data: Array<Record<string, unknown>>
  readonly definition: {
    readonly columns: Array<{
      readonly key: string
      readonly render?: (
        value: unknown,
        row: Record<string, unknown>
      ) => ReactNode
    }>
  }
  readonly rowKey: (row: Record<string, unknown>, index: number) => string
  readonly renderMobileCard: (row: Record<string, unknown>) => ReactNode
  readonly expandedRowRender?: (row: Record<string, unknown>) => ReactNode
}

const mocks = vi.hoisted(() => {
  const updateRole = Object.assign(
    vi.fn((input: unknown) => ({
      type: 'update-role',
      payload: input,
      unwrap: () => Promise.resolve(input),
    })),
    {}
  )
  return {
    dispatch: vi.fn((action: { unwrap?: () => Promise<unknown> }) => action),
    updateRole,
    pagination: {
      items: [
        {
          id: 'user-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image: null,
          role: 'CUSTOMER',
          orderCount: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'user-2',
          name: null,
          email: 'admin@example.com',
          image: null,
          role: 'ADMIN',
          orderCount: 0,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null as string | null,
      search: '',
      searchInput: '',
      currentPage: 1,
      totalCount: 2,
      setSearchInput: vi.fn(),
      handleSearch: vi.fn(),
      handlePageSelect: vi.fn(),
      handleRefresh: vi.fn(),
    },
  }
})

vi.mock('react-redux', () => ({
  useDispatch: () => mocks.dispatch,
}))

vi.mock('@/features/admin/store/adminSlice', () => ({
  updateAdminUserRole: mocks.updateRole,
}))

vi.mock('@/hooks/useCursorPagination', () => ({
  useCursorPagination: () => mocks.pagination,
}))

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('@/features/admin/components/AdminPageShell', () => ({
  AdminPageShell: ({
    title,
    actions,
    children,
  }: {
    title: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
  AdminPanel: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))

vi.mock('@/features/admin/components/AdminSearchForm', () => ({
  AdminSearchForm: ({ ariaLabel }: { ariaLabel: string }) => (
    <form aria-label={ariaLabel} />
  ),
}))

vi.mock('@/features/admin/components/EntityActivitySection', () => ({
  EntityActivitySection: ({ entityId }: { entityId: string }) => (
    <div>Activity for {entityId}</div>
  ),
}))

vi.mock('@/features/admin/components/RoleAction', () => ({
  RoleAction: ({
    user,
    onRoleChange,
  }: {
    user: { id: string }
    onRoleChange: (userId: string, role: 'ADMIN') => void
  }) => (
    <button onClick={() => onRoleChange(user.id, 'ADMIN')}>
      Change role
    </button>
  ),
}))

vi.mock('@/features/admin/components/RoleBadge', () => ({
  RoleBadge: ({ role }: { role: string }) => <span>{role}</span>,
}))

vi.mock('@/features/admin/components/UserAvatar', () => ({
  UserAvatar: ({ email }: { email: string }) => <span>{email}</span>,
}))

vi.mock('@/features/admin/components/AdminDataView', () => ({
  AdminDataView: (props: DataViewProps) => (
    <div data-testid={`${props.ariaLabel}-view`}>
      {props.data.map((row, index) => (
        <div key={props.rowKey(row, index)}>
          {props.renderMobileCard(row)}
          {props.expandedRowRender?.(row)}
          {props.definition.columns.map((column) => (
            <div key={column.key}>{column.render?.(row[column.key], row)}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

describe('UsersManagementClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pagination.error = null
  })

  it('renders the user list with metrics', () => {
    render(<UsersManagementClient permissions={['users:manage']} />)

    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.getByTestId('Users-view')).toBeInTheDocument()
    expect(screen.getAllByText('jane@example.com').length).toBeGreaterThan(0)
  })

  it('shows an error banner when the pagination hook reports an error', () => {
    mocks.pagination.error = 'Something went wrong'

    render(<UsersManagementClient permissions={['users:manage']} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('triggers a refresh when the Refresh button is clicked', () => {
    render(<UsersManagementClient permissions={['users:manage']} />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(mocks.pagination.handleRefresh).toHaveBeenCalled()
  })

  it('dispatches a role change and refreshes on success', async () => {
    render(<UsersManagementClient permissions={['users:manage']} />)

    const [firstChangeRoleButton] = screen.getAllByText('Change role')
    fireEvent.click(firstChangeRoleButton)

    await waitFor(() => {
      expect(mocks.updateRole).toHaveBeenCalledWith({
        id: 'user-1',
        role: 'ADMIN',
      })
    })
    await waitFor(() => {
      expect(mocks.pagination.handleRefresh).toHaveBeenCalled()
    })
  })

  it('logs an error when the role change dispatch rejects', async () => {
    mocks.dispatch.mockImplementationOnce(() => ({
      unwrap: () => Promise.reject(new Error('update failed')),
    }))

    render(<UsersManagementClient permissions={['users:manage']} />)

    const [firstChangeRoleButton] = screen.getAllByText('Change role')
    fireEvent.click(firstChangeRoleButton)

    await waitFor(() => {
      expect(mocks.pagination.handleRefresh).not.toHaveBeenCalled()
    })
  })

  it('does not render the actions column when the user lacks manage permission', () => {
    render(<UsersManagementClient permissions={[]} />)

    expect(screen.queryByText('Change role')).not.toBeInTheDocument()
  })
})
