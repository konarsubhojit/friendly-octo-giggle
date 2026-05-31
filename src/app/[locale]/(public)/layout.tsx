import HeaderWrapper from '@/components/layout/HeaderWrapper'

/**
 * Layout for the public-facing storefront route group.
 *
 * This group mounts the public site header and the `<main>` landmark that the
 * skip-link in the locale layout targets. It contains every storefront route
 * (home, shop, products, cart, checkout, account, auth, etc.) except the
 * `/admin` section, which has its own chrome and intentionally does NOT render
 * the public `HeaderWrapper`.
 *
 * Route groups (folders wrapped in parentheses) do not add a URL segment, so
 * URLs are unchanged by the existence of this folder.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <HeaderWrapper />
      <main id="main-content" className="relative">
        {children}
      </main>
    </>
  )
}
