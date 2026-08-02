import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import CouponsClient from '@/features/admin/components/CouponsClient'
import {
  serializeCoupon,
  serializeRedemptionSummary,
} from '@/features/admin/services/coupon-admin'
import { formatMoneyValue } from '@/lib/money'

export default async function AdminCouponsPage() {
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect('/auth/signin')
    }
    redirect('/admin')
  }

  const [couponRows, redemptionRows] = await Promise.all([
    db.coupons.findAll(),
    db.coupons.redemptionSummary(),
  ])

  const coupons = couponRows.map(serializeCoupon)
  const redemptions = redemptionRows.map(serializeRedemptionSummary)

  const activeCount = coupons.filter((coupon) => coupon.isActive).length
  const totalRedemptions = redemptions.reduce(
    (sum, row) => sum + row.redemptionCount,
    0
  )
  const totalDiscount = redemptions.reduce(
    (sum, row) => sum + row.totalDiscount,
    0
  )

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Coupons' }]}
      eyebrow="Promotions"
      title="Coupons & Promotions"
      description="Create, scope, cap and expire discount codes, and review how they are being redeemed."
      metrics={[
        {
          label: 'Active coupons',
          value: String(activeCount),
          hint: `${coupons.length} total`,
          tone: 'sky',
        },
        {
          label: 'Redemptions',
          value: String(totalRedemptions),
          hint: 'Across all coupons.',
          tone: 'emerald',
        },
        {
          label: 'Discount given',
          value: formatMoneyValue(totalDiscount),
          hint: 'Sum of applied discounts.',
          tone: 'amber',
        },
      ]}
    >
      <AdminPanel title="" description="">
        <CouponsClient
          initialCoupons={coupons}
          initialRedemptions={redemptions}
        />
      </AdminPanel>
    </AdminPageShell>
  )
}
