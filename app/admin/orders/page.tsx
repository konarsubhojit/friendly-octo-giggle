'use client';

import { useState, useEffect } from 'react';
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
import { Badge, orderStatusVariant } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

/**
 * Tracks per-order inline edits for tracking number and shipping provider.
 * Keys are order IDs; values hold the draft field values before saving.
 */
type ShippingEdits = Record<string, { trackingNumber: string; shippingProvider: string }>;

// Shared order types (mirrored from adminSlice internals)
interface AdminOrderItem {
  id: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: { id: string; name: string; image: string };
  variation?: { id: string; name: string; priceModifier: number } | null;
}
interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  createdAt: string;
  items: AdminOrderItem[];
}

// --- AdminOrderCard: extracted to reduce JSX depth (JS-0415) ---
interface AdminOrderCardProps {
  readonly order: AdminOrder;
  readonly updatingOrderId: string | null;
  readonly savingShippingId: string | null;
  readonly edit: { trackingNumber: string; shippingProvider: string };
  readonly formatPrice: (amount: number) => string;
  readonly onStatusChange: (orderId: string, status: OrderStatus) => void;
  readonly onShippingFieldChange: (
    orderId: string,
    field: 'trackingNumber' | 'shippingProvider',
    value: string,
    order: AdminOrder,
  ) => void;
  readonly onSaveShipping: (orderId: string, status: string, order: AdminOrder) => void;
}

function AdminOrderCard({
  order,
  updatingOrderId,
  savingShippingId,
  edit,
  formatPrice,
  onStatusChange,
  onShippingFieldChange,
  onSaveShipping,
}: AdminOrderCardProps) {
  const hasTracking = Boolean(order.trackingNumber || order.shippingProvider);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderStatus;
    if (newStatus !== order.status) {
      setPendingStatus(newStatus);
    }
  };

  const handleConfirmStatus = () => {
    if (pendingStatus) {
      onStatusChange(order.id, pendingStatus);
      setPendingStatus(null);
    }
  };

  const handleCancelStatus = () => setPendingStatus(null);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      {/* Status change confirmation dialog */}
      <ConfirmDialog
        isOpen={pendingStatus !== null}
        title="Change Order Status"
        message={`Update this order from "${order.status}" to "${pendingStatus ?? ''}"?`}
        confirmLabel="Yes, update"
        variant="warning"
        loading={updatingOrderId === order.id}
        onConfirm={handleConfirmStatus}
        onCancel={handleCancelStatus}
      />

      {/* Order Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg">
            {hasTracking && <span role="img" aria-label="Tracking info available" title="Tracking info available" className="mr-1">📦</span>}
            Order #{order.id.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(order.createdAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={orderStatusVariant(order.status)}>
            {order.status}
          </Badge>
          {updatingOrderId === order.id ? (
            <LoadingSpinner size="h-5 w-5" />
          ) : (
            <select
              value={order.status}
              onChange={handleSelectChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={updatingOrderId !== null}
              aria-label={`Change status for order ${order.id}`}
            >
              {Object.values(OrderStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Customer + Shipping Address */}
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

      {/* Shipping Info: Tracking Number + Provider */}
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Shipping Information</h4>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor={`tracking-${order.id}`} className="block text-xs text-gray-500 mb-1">
              Tracking Number
            </label>
            <input
              id={`tracking-${order.id}`}
              type="text"
              value={edit.trackingNumber}
              onChange={(e) => onShippingFieldChange(order.id, 'trackingNumber', e.target.value, order)}
              placeholder="e.g. 1Z999AA10123456784"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor={`provider-${order.id}`} className="block text-xs text-gray-500 mb-1">
              Shipping Provider
            </label>
            <input
              id={`provider-${order.id}`}
              type="text"
              value={edit.shippingProvider}
              onChange={(e) => onShippingFieldChange(order.id, 'shippingProvider', e.target.value, order)}
              placeholder="e.g. FedEx, UPS, USPS"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => onSaveShipping(order.id, order.status, order)}
            disabled={savingShippingId === order.id}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 transition whitespace-nowrap"
          >
            {savingShippingId === order.id ? 'Saving…' : 'Save Shipping'}
          </button>
        </div>
      </div>

      {/* Order Items */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Items ({order.items.length})</h4>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.product?.name || 'Unknown Product'}</p>
                {item.variation && (
                  <p className="text-xs text-blue-600">{item.variation.name}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatPrice(item.price)} × {item.quantity}
                </p>
                {item.customizationNote && (
                  <p className="text-xs text-amber-700 bg-amber-50 inline-block mt-1 px-2 py-0.5 rounded">
                    ✏️ {item.customizationNote}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between items-center">
          <span className="font-bold text-lg">Total</span>
          <span className="font-bold text-xl text-gray-900">{formatPrice(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}


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

  const getShippingEdit = (orderId: string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
    return shippingEdits[orderId] ?? {
      trackingNumber: order.trackingNumber ?? '',
      shippingProvider: order.shippingProvider ?? '',
    };
  };

  const setShippingField = (orderId: string, field: 'trackingNumber' | 'shippingProvider', value: string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
    const current = getShippingEdit(orderId, order);
    setShippingEdits((prev) => ({
      ...prev,
      [orderId]: { ...current, [field]: value },
    }));
  };

  // --- Handlers ---

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    await dispatch(updateAdminOrderStatus({ id: orderId, status: newStatus }));
    setUpdatingOrderId(null);
  };

  const normalizeShippingField = (value: string | null | undefined): string | null => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const handleSaveShipping = async (orderId: string, currentStatus: OrderStatus | string, order: { trackingNumber?: string | null; shippingProvider?: string | null }) => {
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
  };

  const filteredOrders = filter === 'ALL'
    ? orders
    : orders.filter(order => order.status === filter);

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
          <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
          <p className="text-gray-600 mt-2">View and manage all customer orders</p>
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
                : 'bg-white text-gray-700 hover:bg-gray-100'
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
