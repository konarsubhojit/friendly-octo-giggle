// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminExportControl } from '@/features/admin/components/AdminExportControl'

/**
 * FR-H04 / T049: CSV export progress, completion, and failure must be
 * announced to assistive technology via a live region — verified here for
 * the shared `AdminExportControl` wired into the orders screen (T048).
 */
describe('AdminExportControl live-region announcements', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('announces completion of a successful export', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob(['id'], { type: 'text/csv' })),
    } as unknown as Response)

    render(
      <AdminExportControl
        exportUrl="/api/admin/export/orders"
        filenameFallback="orders.csv"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() => {
      const progress = screen.getByText('Export complete.')
      expect(progress).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('announces a failed export via role="alert"', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      blob: () => Promise.resolve(new Blob()),
    } as unknown as Response)

    render(
      <AdminExportControl
        exportUrl="/api/admin/export/orders"
        filenameFallback="orders.csv"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /export failed with status 500/i
      )
    })
  })
})
