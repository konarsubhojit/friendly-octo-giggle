'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { DataTableColumn } from 'zenput'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import ReleaseReservationButton from '@/features/admin/components/ReleaseReservationButton'
import {
  createCheckoutRequestsDefinition,
  type CheckoutRequestRow,
} from '@/features/admin/resources/checkout-requests'
import type { AdminCheckoutRequestRecord } from '@/features/cart/services/checkout-service'

interface CheckoutRequestsClientProps {
  readonly records: readonly AdminCheckoutRequestRecord[]
  readonly emptyMessage: string
}

const STATUS_STYLES: Record<AdminCheckoutRequestRecord['status'], string> = {
  PENDING:
    'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30',
  PROCESSING:
    'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/30',
  COMPLETED:
    'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30',
  FAILED:
    'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-300 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/30',
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const formatTimestamp = (value: string) => dateFormatter.format(new Date(value))

const describeReservation = (
  reservation: AdminCheckoutRequestRecord['reservation']
): string => {
  if (!reservation) return 'None'
  if (reservation.heldQuantity === 0) return reservation.status
  return `${reservation.heldQuantity} held`
}

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

export default function CheckoutRequestsClient({
  records,
  emptyMessage,
}: CheckoutRequestsClientProps) {
  const recordById = useMemo(
    () => new Map(records.map((record) => [record.id, record] as const)),
    [records]
  )

  const definition = useMemo(
    () =>
      createCheckoutRequestsDefinition([], {
        onReleaseReservation: () => {},
        onViewOrder: () => {},
      }),
    []
  )

  const rows = useMemo<CheckoutRequestRow[]>(
    () =>
      records.map((record) => ({
        id: record.id,
        customer: record.customerName,
        status: record.status,
        itemCount: String(record.itemCount),
        orderId: record.orderId ?? '',
        error: record.errorMessage ?? '',
        createdAt: formatTimestamp(record.createdAt),
      })),
    [records]
  )

  const mergedColumns = useMemo<DataTableColumn<CheckoutRequestRow>[]>(() => {
    const requestColumn = definition.columns.find((column) => column.key === 'id')
    const customerColumn = definition.columns.find(
      (column) => column.key === 'customer'
    )
    const statusColumn = definition.columns.find(
      (column) => column.key === 'status'
    )
    const itemCountColumn = definition.columns.find(
      (column) => column.key === 'itemCount'
    )
    const createdAtColumn = definition.columns.find(
      (column) => column.key === 'createdAt'
    )

    return [
      {
        ...requestColumn,
        key: 'id',
        header: 'Request',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record) return row.id
          return (
            <div>
              <div className="font-semibold text-slate-950 dark:text-slate-50">
                {record.id}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                User {record.userId}
              </div>
            </div>
          )
        },
      },
      {
        ...customerColumn,
        key: 'customer',
        header: 'Customer',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record) return row.customer
          return (
            <div>
              <div className="font-medium text-slate-950 dark:text-slate-50">
                {record.customerName}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {record.customerEmail}
              </div>
              <div className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                {truncate(record.customerAddress, 72)}
              </div>
            </div>
          )
        },
      },
      {
        ...statusColumn,
        key: 'status',
        header: 'State',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record) return row.status
          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[record.status]}`}
            >
              {record.status}
            </span>
          )
        },
      },
      {
        key: 'reservation',
        header: 'Reservation',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record) return 'None'
          return (
            <div>
              <div className="text-xs font-semibold text-slate-950 dark:text-slate-50">
                {describeReservation(record.reservation)}
              </div>
              {record.reservation?.expiresAt ? (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Expires{' '}
                  <time dateTime={record.reservation.expiresAt}>
                    {formatTimestamp(record.reservation.expiresAt)}
                  </time>
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        ...itemCountColumn,
        key: 'itemCount',
        header: 'Items',
        render: (_value, row) => (
          <span className="font-semibold text-slate-950 dark:text-slate-50">
            {row.itemCount}
          </span>
        ),
      },
      {
        key: 'error',
        header: 'Last Error',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record?.errorMessage) {
            return (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                None
              </span>
            )
          }
          return (
            <span className="max-w-xs text-xs text-rose-700 dark:text-rose-300">
              {truncate(record.errorMessage, 88)}
            </span>
          )
        },
      },
      {
        ...createdAtColumn,
        key: 'createdAt',
        header: 'Created',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          const createdAt = record?.createdAt
          if (!createdAt) return row.createdAt
          return (
            <time
              dateTime={createdAt}
              className="text-xs text-slate-500 dark:text-slate-400"
            >
              {formatTimestamp(createdAt)}
            </time>
          )
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        sticky: 'right',
        render: (_value, row) => {
          const record = recordById.get(row.id)
          if (!record) return null
          return (
            <div className="flex min-w-[10rem] flex-col items-start gap-2">
              {record.orderId ? (
                <Link
                  href={`/admin/orders?search=${record.orderId}`}
                  className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-600 dark:text-sky-300 dark:decoration-sky-600 dark:hover:text-sky-200"
                >
                  {record.orderId}
                </Link>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Not created yet
                </span>
              )}
              {record.reservation && record.reservation.heldQuantity > 0 ? (
                <ReleaseReservationButton
                  checkoutRequestId={record.id}
                  heldQuantity={record.reservation.heldQuantity}
                />
              ) : null}
            </div>
          )
        },
      },
    ]
  }, [definition.columns, recordById])

  return (
    <AdminDataView
      ariaLabel="Checkout requests"
      definition={{ ...definition, columns: mergedColumns }}
      data={rows}
      rowKey={(row) => row.id}
      emptyMessage={emptyMessage}
      renderMobileCard={(row) => {
        const record = recordById.get(row.id)
        if (!record) return null
        return (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-all font-mono text-xs font-semibold text-slate-950 dark:text-slate-50">
                {record.id}
              </p>
              <p className="mt-1 break-words text-sm font-medium text-slate-700 dark:text-slate-200">
                {record.customerName}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                {record.customerEmail}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Order
                  </dt>
                  <dd className="mt-1 break-all text-slate-700 dark:text-slate-200">
                    {record.orderId ?? 'Not created yet'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Reservation
                  </dt>
                  <dd className="mt-1 text-slate-700 dark:text-slate-200">
                    {describeReservation(record.reservation)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Items
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                    {record.itemCount}
                  </dd>
                </div>
              </dl>
              {record.errorMessage ? (
                <p className="mt-3 break-words rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  {truncate(record.errorMessage, 160)}
                </p>
              ) : null}
              <time
                dateTime={record.createdAt}
                className="mt-3 block text-xs text-slate-500 dark:text-slate-400"
              >
                {formatTimestamp(record.createdAt)}
              </time>
            </div>
            <span
              className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[record.status]}`}
            >
              {record.status}
            </span>
          </div>
        )
      }}
    />
  )
}
