'use client'

import CartGlyph from '@/components/icons/CartGlyph'
import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

interface ErrorProps {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function CartError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Error Loading Cart"
      fallbackMessage="Failed to load your shopping cart"
      icon={
        <CartGlyph className="inline-block h-[2.8rem] w-[2.8rem] shrink-0 text-[var(--accent-sage)]" />
      }
      secondaryHref="/products"
      secondaryLabel="Continue shopping"
    />
  )
}
