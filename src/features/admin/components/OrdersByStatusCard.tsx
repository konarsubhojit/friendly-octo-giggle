'use client'

interface OrdersByStatusCardProps {
  readonly ordersByStatus: Record<string, number>
}

export function OrdersByStatusCard({
  ordersByStatus,
}: OrdersByStatusCardProps) {
  const entries = Object.entries(ordersByStatus).sort(
    ([, leftCount], [, rightCount]) => rightCount - leftCount
  )
  const totalOrders = entries.reduce((total, [, count]) => total + count, 0)

  if (entries.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Orders by status
        </p>
        <p className="mt-2 text-sm text-slate-500">No active orders yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Orders by status
          </p>
          <p className="mt-1 text-sm text-slate-500">
            A quick view of the current fulfilment mix.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-950">
          {totalOrders} active orders
        </p>
      </div>

      <ul className="space-y-3">
        {entries.map(([status, count]) => {
          const share = totalOrders > 0 ? (count / totalOrders) * 100 : 0

          return (
            <li key={status} className="rounded-2xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">{status}</span>
                <span className="text-slate-500">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  style={{ width: `${Math.max(share, count > 0 ? 8 : 0)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
