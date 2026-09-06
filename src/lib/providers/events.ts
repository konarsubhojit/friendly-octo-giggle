/**
 * Structured provider lifecycle events.
 *
 * Provider availability changes are the thing on-call needs to see first when
 * a self-hosted deployment starts behaving differently from a managed one, so
 * they are emitted as four named events with a fixed field set rather than as
 * ad-hoc log lines. Fields are provider *decisions* only — a reason string is
 * expected to describe a failure class, never to carry a credential.
 */

import { logger } from '@/lib/logger'
import type { ProviderCapability, ProviderName } from './types'

export const PROVIDER_EVENTS = {
  unavailable: 'provider_unavailable',
  fallback: 'provider_fallback',
  degraded: 'provider_degraded',
  recovered: 'provider_recovered',
} as const

export type ProviderEventName =
  (typeof PROVIDER_EVENTS)[keyof typeof PROVIDER_EVENTS]

interface ProviderEventBase {
  readonly capability: ProviderCapability
  readonly provider: ProviderName
  /** Failure class, e.g. `'connection_refused'`. Never a credential. */
  readonly reason?: string
}

export interface ProviderFallbackEvent extends ProviderEventBase {
  readonly fallbackProvider: ProviderName
}

export interface ProviderDegradedEvent extends ProviderEventBase {
  /** What the application stops doing while degraded, e.g. `'cache_bypass'`. */
  readonly impact: string
}

export const logProviderUnavailable = (event: ProviderEventBase): void => {
  logger.error(
    { type: PROVIDER_EVENTS.unavailable, ...event },
    `Provider unavailable: ${event.capability}/${event.provider}`
  )
}

export const logProviderFallback = (event: ProviderFallbackEvent): void => {
  logger.warn(
    { type: PROVIDER_EVENTS.fallback, ...event },
    `Provider fallback: ${event.capability}/${event.provider} → ${event.fallbackProvider}`
  )
}

export const logProviderDegraded = (event: ProviderDegradedEvent): void => {
  logger.warn(
    { type: PROVIDER_EVENTS.degraded, ...event },
    `Provider degraded: ${event.capability}/${event.provider} (${event.impact})`
  )
}

export const logProviderRecovered = (event: ProviderEventBase): void => {
  logger.info(
    { type: PROVIDER_EVENTS.recovered, ...event },
    `Provider recovered: ${event.capability}/${event.provider}`
  )
}
