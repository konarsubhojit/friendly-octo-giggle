import { render, screen } from '@testing-library/react';
import { OrderListCard } from '@/components/orders/OrderListCard';

describe('OrderListCard', () => {
  it('shows up to two product names and hides total pricing in the list view', () => {
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
              variation: null,
            },
            {
              quantity: 2,
              product: { name: 'Lily Vase', image: '/lily.jpg' },
              variation: null,
            },
            {
              quantity: 1,
              product: { name: 'Tulip Candle', image: '/tulip.jpg' },
              variation: null,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText('Rose Gift Box, Lily Vase and 1 more'),
    ).toBeInTheDocument();
    expect(screen.getByText('4 items')).toBeInTheDocument();
    expect(screen.getByText('Open the order to review pricing, shipping address, and full item details.')).toBeInTheDocument();
    expect(screen.queryByText('$220.00')).not.toBeInTheDocument();
  });
});