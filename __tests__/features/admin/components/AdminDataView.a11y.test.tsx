// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminDataView } from '@/features/admin/components/AdminDataView'

const row = { id: 'ORD123', customer: 'Asha', total: '₹950' }

describe('AdminDataView accessibility', () => {
  it('exposes accessible controls for selection, filter chips, and bulk actions', () => {
    const onRemoveFilter = vi.fn()
    const onClearFilters = vi.fn()

    render(
      <AdminDataView
        ariaLabel="Orders"
        data={[row]}
        rowKey={(item) => item.id}
        renderMobileCard={() => null}
        definition={{
          resource: 'orders',
          columns: [
            { key: 'customer', header: 'Customer' },
            { key: 'total', header: 'Total' },
          ],
          filters: [],
          searchable: true,
          rowActions: () => [],
          bulkActions: [],
          exportable: false,
          emptyMessage: 'No orders',
          filteredEmptyMessage: 'No matching orders',
        }}
        filterChips={[{ key: 'status', label: 'Status', value: 'PROCESSING' }]}
        onRemoveFilter={onRemoveFilter}
        onClearFilters={onClearFilters}
        renderBulkActionBar={({ selectedRowIds }) => (
          <div>
            <span>{selectedRowIds.length} selected</span>
            <button type="button">Mark shipped</button>
          </div>
        )}
      />
    )

    fireEvent.click(screen.getByLabelText(/select row ord123/i))

    expect(
      screen.getByLabelText(/select all orders on this page/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /remove status filter/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /clear all/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /mark shipped/i })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove status filter/i }))
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))

    expect(onRemoveFilter).toHaveBeenCalledWith('status')
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
