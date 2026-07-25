// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import AdminProductEditFormPage from '@/app/admin/products/[id]/edit/page'

const mockRedirect = vi.fn()
const mockNotFound = vi.fn()

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  redirect: (href: string) => mockRedirect(href),
  notFound: () => mockNotFound(),
}))

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { role: 'ADMIN' } }),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      products: {
        findFirst: async () => ({
          id: 'prd-1',
          name: 'Rose Box',
          description: 'Gift-ready floral arrangement',
          image: 'https://example.com/rose-box.jpg',
          images: [],
          category: 'Gifts',
          deletedAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-10T00:00:00.000Z'),
          variants: [
            {
              id: 'var-1',
              productId: 'prd-1',
              sku: null,
              image: null,
              images: [],
              price: 100,
              stock: 5,
              deletedAt: null,
              createdAt: new Date('2026-03-03T00:00:00.000Z'),
              updatedAt: new Date('2026-03-09T00:00:00.000Z'),
            },
          ],
        }),
      },
    },
  },
}))

vi.mock('@/features/admin/components/ProductEditPageForm', () => ({
  default: ({ product }: { product: { name: string } }) => (
    <div>Product form: {product.name}</div>
  ),
}))

vi.mock('@/features/admin/components/VariantList', () => ({
  default: ({
    initialVariants,
  }: {
    initialVariants: Array<{ id: string }>
  }) => <div>Variant workspace: {initialVariants.length}</div>,
}))

describe('AdminProductEditFormPage', () => {
  it('renders a unified editing workspace with product and variant tools', async () => {
    render(
      await AdminProductEditFormPage({
        params: Promise.resolve({ id: 'prd-1' }),
      })
    )

    expect(
      screen.getByRole('heading', {
        name: 'Edit Product',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Product form: Rose Box')).toBeInTheDocument()
    expect(screen.getByText('Variant workspace: 1')).toBeInTheDocument()
    expect(screen.getByText('Variants')).toBeInTheDocument()
    expect(screen.getByText('In stock')).toBeInTheDocument()
  })
})
