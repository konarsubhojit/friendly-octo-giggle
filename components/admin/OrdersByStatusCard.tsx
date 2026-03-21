'use client';

interface OrdersByStatusCardProps {
  readonly ordersByStatus: Record<string, number>;
}

export const OrdersByStatusCard = ({ ordersByStatus }: OrdersByStatusCardProps) => {
  if (Object.keys(ordersByStatus).length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Orders by Status</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Orders by Status</p>
      <ul className="space-y-1">
        {Object.entries(ordersByStatus).map(([status, count]) => (
          <li key={status} className="flex justify-between text-sm">
            <span className="capitalize text-gray-700 dark:text-gray-300">{status}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
