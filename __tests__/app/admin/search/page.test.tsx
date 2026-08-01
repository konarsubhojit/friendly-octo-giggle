// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import AdminSearchPage from '@/app/admin/search/page'

const mockRequireAdminPermission = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/services/admin-page-auth', () => ({
  requireAdminPermission: (permission: string, callbackUrl?: string) =>
    mockRequireAdminPermission(permission, callbackUrl),
}))

const isSearchAvailable = vi.fn()
const areOrdersSearchControlsAvailable = vi.fn()

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/search', () => ({
  isSearchAvailable: () => isSearchAvailable(),
}))

vi.mock('@/features/orders/services/orders-search-index', () => ({
  areOrdersSearchControlsAvailable: () => areOrdersSearchControlsAvailable(),
}))

vi.mock('@/features/admin/components/SearchReindexClient', () => ({
  default: ({
    productsConfigured,
    ordersConfigured,
  }: {
    productsConfigured: boolean
    ordersConfigured: boolean
  }) => (
    <div>
      Search reindex client: products{' '}
      {productsConfigured ? 'configured' : 'missing'}, orders{' '}
      {ordersConfigured ? 'configured' : 'missing'}
    </div>
  ),
}))

describe('AdminSearchPage', () => {
  it('enforces the system:manage admin permission', async () => {
    isSearchAvailable.mockReturnValue(true)
    areOrdersSearchControlsAvailable.mockReturnValue(true)

    render(await AdminSearchPage())

    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      'system:manage',
      '/admin/search'
    )
  })

  it('renders the upgraded page shell for configured search', async () => {
    isSearchAvailable.mockReturnValue(true)
    areOrdersSearchControlsAvailable.mockReturnValue(true)

    render(await AdminSearchPage())

    expect(
      screen.getByRole('heading', {
        name: 'Search Index Management',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Products index')).toBeInTheDocument()
    expect(screen.getAllByText('Configured')).toHaveLength(2)
    expect(
      screen.getByText(
        'Search reindex client: products configured, orders configured'
      )
    ).toBeInTheDocument()
  })

  it('renders the fallback metric state when search is not configured', async () => {
    isSearchAvailable.mockReturnValue(false)
    areOrdersSearchControlsAvailable.mockReturnValue(false)

    render(await AdminSearchPage())

    expect(screen.getAllByText('Missing config')).toHaveLength(2)
    expect(
      screen.getByText(
        'Search reindex client: products missing, orders missing'
      )
    ).toBeInTheDocument()
  })

  it('renders mixed search infrastructure states', async () => {
    isSearchAvailable.mockReturnValue(false)
    areOrdersSearchControlsAvailable.mockReturnValue(true)

    render(await AdminSearchPage())

    expect(screen.getByText('Products index')).toBeInTheDocument()
    expect(screen.getByText('Orders index')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Search reindex client: products missing, orders configured'
      )
    ).toBeInTheDocument()
  })
})
