import Link from '@/components/ui/LocaleLink'

interface BreadcrumbNavProps {
  readonly productName: string
}

export const BreadcrumbNav = ({ productName }: BreadcrumbNavProps) => (
  <nav className="mb-6 text-sm">
    <div className="inline-flex items-center gap-1 px-4 py-2 bg-[var(--surface)]/90 backdrop-blur-sm rounded-full border border-[var(--border-warm)] shadow-warm">
      <Link
        href="/shop"
        className="text-[var(--foreground)] font-medium hover:text-[var(--accent-rose)] transition-colors"
      >
        Shop
      </Link>
      <span className="mx-1 text-[var(--accent-warm)] font-bold">/</span>
      <span className="text-[var(--foreground)] font-semibold">
        {productName}
      </span>
    </div>
  </nav>
)
