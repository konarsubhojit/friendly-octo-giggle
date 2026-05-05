// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { OrderListCard } from '@/features/orders/components/OrderListCard'

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (n: number) => `$${n.toFixed(2)}` }),
}))

describe('OrderListCard', () => {
  it('shows product names, thumbnails, total price, and item count', () => {
    render(
      <OrderListCard
        order={{
          id: 'ord5678',
          status: 'SHIPPED',
          createdAt: '2026-03-18T08:00:00.000Z',
          totalAmount: 220,
          items: [
            {
              quantity: 1,
              product: { name: 'Rose Gift Box', image: '/rose.jpg' },
              variant: null,
            },
            {
              quantity: 2,
              product: { name: 'Lily Vase', image: '/lily.jpg' },
              variant: null,
            },
            {
              quantity: 1,
              product: { name: 'Tulip Candle', image: '/tulip.jpg' },
              variant: null,
            },
          ],
        }}
      />
    )

    expect(
      screen.getByText('Rose Gift Box, Lily Vase and 1 more')
    ).toBeInTheDocument()
    expect(screen.getByText('4 items')).toBeInTheDocument()
    expect(screen.getByText('$220.00')).toBeInTheDocument()
  })
})
