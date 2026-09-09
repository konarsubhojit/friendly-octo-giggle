import { NextResponse } from 'next/server'
import { getProviderSummary } from '@/lib/providers/resolution'

/**
 * Liveness + provider-readiness probe.
 *
 * Always returns HTTP 200 — the process itself is up — but `status` reports
 * `degraded` when a provider was *explicitly* selected without the
 * credentials it requires (an inferred or defaulted provider can never
 * produce an issue; see `src/lib/providers/resolution.ts`). The body carries
 * only capability/provider names, how each was chosen, and whether it is
 * configured — never a URL, token, or other credential-bearing value.
 */
export function GET() {
  const { providers, issues, deprecatedAliases } = getProviderSummary()

  return NextResponse.json(
    {
      status: issues.length === 0 ? 'ok' : 'degraded',
      providers,
      deprecatedAliases,
    },
    { status: 200 }
  )
}
