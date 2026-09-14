/**
 * Platform analytics mount point.
 *
 * Renders Vercel Analytics + Speed Insights only when the `analytics`
 * capability resolves to `vercel` (the default on Vercel, inferred from the
 * `VERCEL` env var). Off-Vercel deployments render nothing. The Vercel
 * packages are imported dynamically so they are not pulled into the bundle
 * graph that actually executes when the provider is `none` — only this
 * module ever imports them.
 */

import { getProvider } from '@/lib/providers/resolution'

export default async function PlatformAnalytics() {
  if (getProvider('analytics') !== 'vercel') {
    return null
  }

  const [{ Analytics }, { SpeedInsights }] = await Promise.all([
    import('@vercel/analytics/next'),
    import('@vercel/speed-insights/next'),
  ])

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
