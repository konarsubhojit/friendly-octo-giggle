// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminActivityPanel } from '@/features/admin/components/AdminActivityPanel'

describe('AdminActivityPanel', () => {
  it('renders actor, role, timestamp, and before/after changes', () => {
    render(
      <AdminActivityPanel
        entries={[
          {
            id: 'log1',
            entity: 'order',
            entityId: 'ORD123',
            action: 'status_change',
            actor: { userId: 'support-1', role: 'SUPPORT' },
            changes: [{ field: 'status', before: 'PROCESSING', after: 'SHIPPED' }],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
      />
    )

    expect(screen.getByText('status_change')).toBeInTheDocument()
    expect(screen.getByText(/support-1/)).toBeInTheDocument()
    expect(screen.getByText(/\(SUPPORT\)/)).toBeInTheDocument()
    expect(screen.getByText('Before:')).toBeInTheDocument()
    expect(screen.getByText('After:')).toBeInTheDocument()
  })

  it('loads more entries when a next cursor exists', () => {
    const onLoadMore = vi.fn()

    render(
      <AdminActivityPanel
        entries={[
          {
            id: 'log1',
            entity: 'order',
            entityId: 'ORD123',
            action: 'status_change',
            actor: { userId: 'support-1', role: 'SUPPORT' },
            changes: [{ field: 'status', before: 'PROCESSING', after: 'SHIPPED' }],
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
        nextCursor="cursor-1"
        onLoadMore={onLoadMore}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /load more activity/i }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })
})
