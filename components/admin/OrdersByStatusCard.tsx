'use client';

interface OrdersByStatusCardProps {
  readonly ordersByStatus: Record<string, number>;
}

export function OrdersByStatusCard({ ordersByStatus }: OrdersByStatusCardProps) {
  if (Object.keys(ordersByStatus).length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-sm text-gray-500 mb-2">Orders by Status</p>
        <p className="text-gray-400 text-sm">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <p className="text-sm text-gray-500 mb-2">Orders by Status</p>
      <ul className="space-y-1">
        {Object.entries(ordersByStatus).map(([status, count]) => (
          <li key={status} className="flex justify-between text-sm">
            <span className="capitalize text-gray-700">{status}</span>
            <span className="font-semibold text-gray-900">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
