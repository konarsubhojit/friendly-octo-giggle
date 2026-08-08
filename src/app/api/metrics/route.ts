import { NextResponse, connection } from 'next/server'
import { renderPrometheusMetrics } from '@/lib/metrics'

/**
 * Prometheus scrape endpoint.
 *
 * The counters live in this process's memory and change on every request, so
 * the handler must never be prerendered — a build-time snapshot would report
 * zeros for the lifetime of the deployment. Under Cache Components that is
 * declared with `connection()` rather than the removed
 * `export const dynamic = 'force-dynamic'`.
 */
export async function GET() {
  await connection()

  return new NextResponse(renderPrometheusMetrics(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
