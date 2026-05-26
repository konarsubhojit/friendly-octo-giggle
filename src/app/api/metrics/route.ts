import { NextResponse } from 'next/server'
import { renderPrometheusMetrics } from '@/lib/metrics'

export function GET() {
  return new NextResponse(renderPrometheusMetrics(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
