import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminNavLinks } from '@/features/admin/components/AdminNavLinks'

// Mock the database
vi.mock('@/lib/db', () => ({
  drizzleDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}))

// Mock the client component
vi.mock('@/features/admin/components/AdminNavLinksClient', () => ({
  AdminNavLinksClient: ({ failedEmailCount }: { failedEmailCount: number }) => (
    <div data-testid="admin-nav-links-client">
      <span data-testid="failed-email-count">{failedEmailCount}</span>
    </div>
  ),
}))

describe('AdminNavLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render AdminNavLinksClient with failed email count', async () => {
    const { drizzleDb } = await import('@/lib/db')

    vi.mocked(drizzleDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      }),
    } as never)

    const Component = await AdminNavLinks()
    render(Component)

    expect(screen.getByTestId('admin-nav-links-client')).toBeInTheDocument()
    expect(screen.getByTestId('failed-email-count')).toHaveTextContent('5')
  })

  it('should handle zero failed emails', async () => {
    const { drizzleDb } = await import('@/lib/db')

    vi.mocked(drizzleDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 0 }]),
      }),
    } as never)

    const Component = await AdminNavLinks()
    render(Component)

    expect(screen.getByTestId('failed-email-count')).toHaveTextContent('0')
  })

  it('should handle database errors gracefully', async () => {
    const { drizzleDb } = await import('@/lib/db')

    vi.mocked(drizzleDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      }),
    } as never)

    const Component = await AdminNavLinks()
    render(Component)

    // Should default to 0 on error
    expect(screen.getByTestId('failed-email-count')).toHaveTextContent('0')
  })

  it('should handle empty result array', async () => {
    const { drizzleDb } = await import('@/lib/db')

    vi.mocked(drizzleDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const Component = await AdminNavLinks()
    render(Component)

    expect(screen.getByTestId('failed-email-count')).toHaveTextContent('0')
  })
})
