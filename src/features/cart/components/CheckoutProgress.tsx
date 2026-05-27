import Link from 'next/link'

type CheckoutStep = 'cart' | 'shipping' | 'review' | 'confirmation'

const steps: Array<{ id: CheckoutStep; label: string; href: string }> = [
  { id: 'cart', label: 'Cart', href: '/cart' },
  { id: 'shipping', label: 'Shipping', href: '/checkout/shipping' },
  { id: 'review', label: 'Review', href: '/checkout/review' },
  { id: 'confirmation', label: 'Confirmation', href: '/checkout/confirmation' },
]

interface CheckoutProgressProps {
  currentStep: CheckoutStep
}

export const CheckoutProgress = ({ currentStep }: CheckoutProgressProps) => {
  const activeIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <nav aria-label="Checkout progress" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isComplete = index < activeIndex
          const className = isActive
            ? 'bg-[var(--accent-rose)] text-white'
            : isComplete
              ? 'bg-[var(--accent-blush)] text-[var(--foreground)]'
              : 'bg-[var(--surface-raised)] text-[var(--text-muted)]'

          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-[var(--text-muted)]" aria-hidden="true">
                  →
                </span>
              ) : null}
              {isComplete ? (
                <Link
                  href={step.href}
                  className={`rounded-full px-3 py-1 font-medium ${className}`}
                >
                  {step.label}
                </Link>
              ) : (
                <span
                  className={`rounded-full px-3 py-1 font-medium ${className}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {step.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
