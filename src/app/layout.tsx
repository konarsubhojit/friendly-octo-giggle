// Root layout is a thin passthrough. The locale-aware `<html>`/`<body>` shell
// lives in `src/app/[locale]/layout.tsx` so the root layout no longer needs to
// call `headers()` — that previously opted every route into dynamic rendering
// and blocked ISR / route-segment caching.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
