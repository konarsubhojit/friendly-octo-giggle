import { auth } from '@/lib/auth'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import OrdersClient from '@/app/orders/OrdersClient'

export const dynamic = 'force-dynamic'
export default async function OrdersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/orders"
            message="Please sign in to view your orders."
          />
        </main>
      </div>
    )
  }

  return <OrdersClient />
}
