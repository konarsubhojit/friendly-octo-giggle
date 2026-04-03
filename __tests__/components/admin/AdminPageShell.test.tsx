import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('AdminPageShell', () => {
  it('renders breadcrumbs, hero content, metrics, and nested panels', () => {
    render(
      <AdminPageShell
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Products', href: '/admin/products' },
          { label: 'Overview' },
        ]}
        eyebrow="Catalog operations"
        title="Product management with faster inventory triage."
        description="Search the catalog, spot stock risks, and jump into product detail or creation flows without losing context."
        actions={<button type="button">Add Product</button>}
        metrics={[
          {
            label: 'Catalog size',
            value: '24',
            hint: 'Total products matching the current query.',
            tone: 'sky',
          },
          {
            label: 'Low stock',
            value: '3',
            hint: 'Products with five or fewer units.',
            tone: 'amber',
          },
        ]}
      >
        <AdminPanel
          title="Catalog results"
          description="Browse the current result set."
        >
          <p>Panel content</p>
        </AdminPanel>
      </AdminPageShell>
    )

    expect(
      screen.getByRole('heading', {
        name: 'Product management with faster inventory triage.',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Catalog operations')).toBeInTheDocument()
    expect(screen.getByText('Catalog size')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Product' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin'
    )
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/admin/products'
    )
    expect(
      screen.getByRole('heading', { name: 'Catalog results' })
    ).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('omits the metric grid when no metrics are provided', () => {
    render(
      <AdminPageShell
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        title="User management"
        description="Manage access."
      >
        <div>User content</div>
      </AdminPageShell>
    )

    expect(screen.getByText('User content')).toBeInTheDocument()
    expect(screen.queryByText('Catalog size')).not.toBeInTheDocument()
  })
})
