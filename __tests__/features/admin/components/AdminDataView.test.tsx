// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { AdminDataView } from '@/features/admin/components/AdminDataView'

const row = { id: 'ORD123', customer: 'Asha', total: '₹950' }
const columns = [
  { key: 'id', header: 'Order ID' },
  { key: 'customer', header: 'Customer' },
]

describe('AdminDataView', () => {
  it('renders the Zenput table on desktop', () => {
    render(
      <AdminDataView
        ariaLabel="Orders"
        columns={columns}
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
        columns={columns}
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
})
