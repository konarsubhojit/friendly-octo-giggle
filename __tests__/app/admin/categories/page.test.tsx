import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import AdminCategoriesPage from '@/app/admin/categories/page'

let mockCategories = [
  {
    id: 'cat-1',
    name: 'Bouquets',
    slug: 'bouquets',
    sortOrder: 1,
    createdAt: new Date('2026-03-10T00:00:00.000Z'),
    updatedAt: new Date('2026-03-11T00:00:00.000Z'),
    deletedAt: null,
  },
  {
    id: 'cat-2',
    name: 'Wearables',
    slug: 'wearables',
    sortOrder: 2,
    createdAt: new Date('2026-03-12T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    deletedAt: null,
  },
]

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(mockCategories),
        }),
      }),
    }),
  },
}))

vi.mock('@/features/admin/components/CategoriesClient', () => ({
  default: ({
    initialCategories,
  }: {
    initialCategories: Array<{ id: string; name: string }>
  }) => <div>Categories client: {initialCategories.length}</div>,
}))

describe('AdminCategoriesPage', () => {
  it('renders the upgraded admin shell with serialized categories', async () => {
    render(await AdminCategoriesPage())

    expect(
      screen.getByRole('heading', {
        name: 'Category Management',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Active categories')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Categories client: 2')).toBeInTheDocument()
  })
})
