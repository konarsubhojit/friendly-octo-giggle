"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/contexts/CurrencyContext";
import { OrdersByStatusCard } from "@/components/admin/OrdersByStatusCard";
import { TopProductsTable } from "@/components/admin/TopProductsTable";

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
  topProducts: {
    productId: string;
    name: string;
    totalQuantity: number;
    totalRevenue: number;
  }[];
  totalCustomers: number;
}

const NAV_CARDS = [
  {
    href: "/admin/products",
    title: "Products",
    description: "Manage products, inventory, and pricing",
    color: "text-blue-600",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    href: "/admin/orders",
    title: "Orders",
    description: "View and manage customer orders",
    color: "text-green-600",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage user roles and permissions",
    color: "text-purple-600",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
];

const AdminDashboard = () => {
  const [sales, setSales] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/sales");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setSales(data.data.sales);
          } else {
            setError("Failed to load sales data");
          }
        } else {
          setError("Failed to load sales data");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sales data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Loading sales data...
        </p>
      </main>
    );
  }

  if (error || !sales) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Dashboard
        </h2>
        <p className="text-red-600">{error ?? "Failed to load sales data"}</p>
      </main>
    );
  }

  const summaryCards = [
    { label: "Total Revenue", value: formatPrice(sales.totalRevenue) },
    { label: "Today's Revenue", value: formatPrice(sales.todayRevenue) },
    { label: "This Month's Revenue", value: formatPrice(sales.monthRevenue) },
    { label: "Total Orders", value: String(sales.totalOrders) },
    { label: "Total Customers", value: String(sales.totalCustomers) },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dashboard
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {card.value}
            </p>
          </div>
        ))}
        <OrdersByStatusCard ordersByStatus={sales.ordersByStatus} />
      </div>

      {/* Top 5 Selling Products */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 5 Selling Products
        </h3>
        <TopProductsTable
          products={sales.topProducts}
          formatPrice={formatPrice}
        />
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {card.title}
              </h3>
              <svg
                className={`w-8 h-8 ${card.color}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={card.icon}
                />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
};
export default AdminDashboard;
