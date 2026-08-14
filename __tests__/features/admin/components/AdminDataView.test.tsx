// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminDataView } from '@/features/admin/components/AdminDataView'

const row = { id: 'ORD123', customer: 'Asha', total: '₹950' }
const columns = [
  { key: 'id', header: 'Order ID' },
  { key: 'customer', header: 'Customer' },
] as const

describe('AdminDataView', () => {
  it('renders the Zenput table on desktop', () => {
    render(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[row]}
        rowKey={(item) => item.id}
        renderMobileCard={(item) => <p>Mobile {item.customer}</p>}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Mobile Asha')).not.toBeInTheDocument()
  })

  it('renders readable cards instead of a table on mobile', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[row]}
        rowKey={(item) => item.id}
        renderMobileCard={(item) => <p>Mobile {item.customer}</p>}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Mobile Asha')).toBeInTheDocument()
    })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('renders the loading state with skeleton copy', () => {
    render(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[] as (typeof row)[]}
        rowKey={(item) => item.id}
        renderMobileCard={() => null}
        listState={{ status: 'loading' }}
      />
    )

    expect(screen.getByLabelText('Orders loading')).toBeInTheDocument()
  })

  it('renders distinct empty and filtered-empty messages', () => {
    const { rerender } = render(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[] as (typeof row)[]}
        rowKey={(item) => item.id}
        renderMobileCard={() => null}
        listState={{ status: 'empty', message: 'No orders yet.' }}
      />
    )

    expect(screen.getByText('No orders yet.')).toBeInTheDocument()

    rerender(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[] as (typeof row)[]}
        rowKey={(item) => item.id}
        renderMobileCard={() => null}
        listState={{
          status: 'filtered-empty',
          message: 'No orders match the current filters.',
        }}
      />
    )

    expect(
      screen.getByText('No orders match the current filters.')
    ).toBeInTheDocument()
  })

  it('renders the failed state with a retry control', () => {
    const onRetry = vi.fn()

    render(
      <AdminDataView
        ariaLabel="Orders"
        columns={[...columns]}
        data={[] as (typeof row)[]}
        rowKey={(item) => item.id}
        renderMobileCard={() => null}
        listState={{
          status: 'error',
          message: 'Orders failed to load.',
          onRetry,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
