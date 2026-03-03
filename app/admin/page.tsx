'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SalesData {
  totalRevenue: number;
  totalOrders: number;
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  monthOrders: number;
  lastMonthRevenue: number;
  lastMonthOrders: number;
  ordersByStatus: Record<string, number>;
  topProducts: { name: string; totalQuantity: number; totalRevenue: number }[];
  totalCustomers: number;
}

export default function AdminDashboard() {
  const [sales, setSales] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/sales');
        const data = await res.json();
        if (res.ok && data.success) {
          setSales(data.data.sales);
        } else {
          setError('Failed to load sales data');
        }
      } catch (err) {
        console.error('Sales data fetch error:', err);
        setError('Failed to load sales data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <p className="text-gray-600">Loading sales data...</p>
      </main>
    );
  }

  if (error || !sales) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
        <p className="text-red-600">{error ?? 'Failed to load sales data'}</p>
      </main>
    );
  }

  const summaryCards = [
    { label: 'Total Revenue', value: formatPrice(sales.totalRevenue) },
    { label: "Today's Revenue", value: formatPrice(sales.todayRevenue) },
    { label: "This Month's Revenue", value: formatPrice(sales.monthRevenue) },
    { label: 'Total Orders', value: String(sales.totalOrders) },
    { label: 'Total Customers', value: String(sales.totalCustomers) },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-lg shadow-md">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}

        {/* Orders by Status card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-sm text-gray-500 mb-2">Orders by Status</p>
          {Object.keys(sales.ordersByStatus).length === 0 ? (
            <p className="text-gray-400 text-sm">No orders yet</p>
          ) : (
            <ul className="space-y-1">
              {Object.entries(sales.ordersByStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between text-sm">
                  <span className="capitalize text-gray-700">{status}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top 5 Selling Products */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Selling Products</h3>
        {sales.topProducts.length === 0 ? (
          <p className="text-gray-400 text-sm">No product sales yet</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-sm font-medium text-gray-500">Product</th>
                <th className="pb-2 text-sm font-medium text-gray-500 text-right">Qty Sold</th>
                <th className="pb-2 text-sm font-medium text-gray-500 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sales.topProducts.map((product) => (
                <tr key={product.name} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-sm text-gray-900">{product.name}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{product.totalQuantity}</td>
                  <td className="py-2 text-sm text-gray-900 text-right">{formatPrice(product.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/products" className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Products</h3>
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-600">Manage products, inventory, and pricing</p>
        </Link>

        <Link href="/admin/orders" className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Orders</h3>
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-600">View and manage customer orders</p>
        </Link>

        <Link href="/admin/users" className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Users</h3>
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-gray-600">Manage user roles and permissions</p>
        </Link>
      </div>
    </main>
  );
}
