'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { OrderStatus } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
  selectAdminOrders,
  selectAdminOrdersLoading,
  selectAdminError,
} from '@/lib/features/admin/adminSlice';
import type { AppDispatch } from '@/lib/store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminOrderCard } from '@/components/admin/AdminOrderCard';

/**
 * Tracks per-order inline edits for tracking number and shipping provider.
 * Keys are order IDs; values hold the draft field values before saving.
 */
type ShippingEdits = Record<string, { trackingNumber: string; shippingProvider: string }>;

export default function OrdersManagement() {
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const orders = useSelector(selectAdminOrders);
  const loading = useSelector(selectAdminOrdersLoading);
  const error = useSelector(selectAdminError);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [savingShippingId, setSavingShippingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [shippingEdits, setShippingEdits] = useState<ShippingEdits>({});

  useEffect(() => {
    dispatch(fetchAdminOrders());
  }, [dispatch]);

  // --- Helpers ---

  const getShippingEdit = useCallback((orderId: string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
    return shippingEdits[orderId] ?? {
      trackingNumber: order.trackingNumber ?? '',
      shippingProvider: order.shippingProvider ?? '',
    };
  }, [shippingEdits]);

  // Read the current draft from the functional updater to avoid depending on getShippingEdit
  const setShippingField = useCallback((orderId: string, field: 'trackingNumber' | 'shippingProvider', value: string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
    setShippingEdits((prev) => {
      const current = prev[orderId] ?? {
        trackingNumber: order.trackingNumber ?? '',
        shippingProvider: order.shippingProvider ?? '',
      };
      return { ...prev, [orderId]: { ...current, [field]: value } };
    });
  }, []);

  // --- Handlers ---

  const handleStatusChange = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    await dispatch(updateAdminOrderStatus({ id: orderId, status: newStatus }));
    setUpdatingOrderId(null);
  }, [dispatch]);

  const normalizeShippingField = useCallback((value: string | null | undefined): string | null => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, []);

  const handleSaveShipping = useCallback(async (orderId: string, currentStatus: OrderStatus | string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
    const edit = getShippingEdit(orderId, order);
    setSavingShippingId(orderId);
    await dispatch(
      updateAdminOrderStatus({
        id: orderId,
        status: currentStatus,
        trackingNumber: normalizeShippingField(edit.trackingNumber),
        shippingProvider: normalizeShippingField(edit.shippingProvider),
      }),
    );
    // Clear local draft so it re-reads from store on next render
    setShippingEdits((prev) => {
      const { [orderId]: _removed, ...rest } = prev;
      return rest;
    });
    setSavingShippingId(null);
  }, [dispatch, getShippingEdit, normalizeShippingField]);

  const filteredOrders = useMemo(
    () => filter === 'ALL' ? orders : orders.filter(order => order.status === filter),
    [filter, orders],
  );

  // --- Render: Loading ---

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  // --- Render: Main ---

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Order Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage all customer orders</p>
        </div>
        <button
          onClick={() => dispatch(fetchAdminOrders())}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
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
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {status}
            {status === 'ALL' && ` (${orders.length})`}
            {status !== 'ALL' && ` (${orders.filter(o => o.status === status).length})`}
          </button>
        ))}
      </div>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <EmptyState title="No items found" />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              updatingOrderId={updatingOrderId}
              savingShippingId={savingShippingId}
              edit={getShippingEdit(order.id, order)}
              formatPrice={formatPrice}
              onStatusChange={handleStatusChange}
              onShippingFieldChange={setShippingField}
              onSaveShipping={handleSaveShipping}
            />
          ))}
        </div>
      )}
    </main>
  );
}
