'use client';

import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '@/lib/types';

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/orders');
      
      if (!res.ok) {
        throw new Error('Failed to load orders');
      }
      
      const data = await res.json();
      setOrders(data.data?.orders || data.orders || []);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Unable to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    setError('');

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update order status');
      }

      await loadOrders();
    } catch (err) {
      console.error('Error updating order:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case OrderStatus.PROCESSING:
        return 'bg-blue-100 text-blue-800';
      case OrderStatus.SHIPPED:
        return 'bg-purple-100 text-purple-800';
      case OrderStatus.DELIVERED:
        return 'bg-green-100 text-green-800';
      case OrderStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = filter === 'ALL' 
    ? orders 
    : orders.filter(order => order.status === filter);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
          <p className="text-gray-600 mt-2">View and manage all customer orders</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {(['ALL', ...Object.values(OrderStatus)] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {status}
            {status === 'ALL' && ` (${orders.length})`}
            {status !== 'ALL' && ` (${orders.filter(o => o.status === status).length})`}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">No items found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  {updatingOrderId === order.id ? (
                    <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={updatingOrderId !== null}
                    >
                      {Object.values(OrderStatus).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Customer</h4>
                  <p className="text-sm">{order.customerName}</p>
                  <p className="text-sm text-gray-600">{order.customerEmail}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Shipping Address</h4>
                  <p className="text-sm text-gray-600">{order.customerAddress}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Items ({order.items.length})</h4>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        {item.variation && (
                          <p className="text-xs text-blue-600">
                            {item.variation.designName} ({item.variation.name})
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between items-center">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-xl text-gray-900">
                    ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
