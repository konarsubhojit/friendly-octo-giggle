// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminBulkActionBar } from '@/features/admin/components/AdminBulkActionBar'
import type {
  BulkAction,
  BulkResult,
} from '@/features/admin/components/resource-list-definition'

/**
 * FR-H04 / T049: bulk-action progress, success, and failure must be
 * announced to assistive technology via a live region — verified here for
 * the shared `AdminBulkActionBar` consumed by the orders screen (T045/T048).
 */
describe('AdminBulkActionBar live-region announcements', () => {
  const baseSelection = {
    scope: 'loaded_page' as const,
    rowIds: ['ORD1', 'ORD2'],
  }

  it('announces in-progress and success outcomes via an aria-live region', async () => {
    let resolveApply: (result: BulkResult) => void = () => {}
    const action: BulkAction = {
      key: 'mark_shipped',
      label: 'Mark as shipped',
      onApply: () =>
        new Promise<BulkResult>((resolve) => {
          resolveApply = resolve
        }),
    }

    render(
      <AdminBulkActionBar
        actions={[action]}
        selection={baseSelection}
        selectedCount={2}
      />
    )

    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveTextContent('')

    fireEvent.click(screen.getByRole('button', { name: 'Mark as shipped' }))

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent(/mark as shipped: in progress/i)
    })

    await act(async () => {
      resolveApply({ succeeded: ['ORD1', 'ORD2'], failed: [] })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent(
        /mark as shipped: completed successfully for 2 record/i
      )
    })
  })

  it('announces partial-failure outcomes via the live region', async () => {
    const action: BulkAction = {
      key: 'cancel',
      label: 'Cancel',
      onApply: () =>
        Promise.resolve({
          succeeded: ['ORD1'],
          failed: [{ rowId: 'ORD2', reason: 'Already shipped' }],
        }),
    }

    render(
      <AdminBulkActionBar
        actions={[action]}
        selection={baseSelection}
        selectedCount={2}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /cancel: 1 succeeded, 1 failed/i
      )
    })
  })
})
