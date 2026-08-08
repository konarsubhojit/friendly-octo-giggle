import { countDistinct, max, sql } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { productAffinityScores } from '@/lib/schema'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import {
  AFFINITY_WINDOW_DAYS,
  MIN_SUPPORT,
} from '@/features/recommendations/constants'

export interface AffinityStatus {
  /** When the most recent scoring run wrote its rows; null if never run. */
  readonly lastComputedAt: string | null
  readonly pairCount: number
  readonly anchorCount: number
  readonly windowDays: number
  readonly minSupport: number
}

/**
 * Summarise the state of the affinity table for the admin surface.
 *
 * The two aggregates are the expensive part and the job runs once a day, so a
 * minute of staleness costs nothing and spares a full table scan per page
 * load.
 */
export const getAffinityStatus = async (): Promise<AffinityStatus> => {
  const snapshot = await getCachedData(
    CACHE_KEYS.RECOMMENDATIONS_STATUS,
    CACHE_TTL.RECOMMENDATIONS_STATUS,
    async () => {
      const [row] = await drizzleDb
        .select({
          lastComputedAt: max(productAffinityScores.computedAt),
          pairCount: sql<number>`cast(count(*) as int)`,
          anchorCount: countDistinct(productAffinityScores.anchorProductId),
        })
        .from(productAffinityScores)

      return {
        lastComputedAt: row?.lastComputedAt
          ? new Date(row.lastComputedAt).toISOString()
          : null,
        pairCount: Number(row?.pairCount ?? 0),
        anchorCount: Number(row?.anchorCount ?? 0),
      }
    },
    CACHE_TTL.RECOMMENDATIONS_STATUS
  )

  return {
    ...snapshot,
    windowDays: AFFINITY_WINDOW_DAYS,
    minSupport: MIN_SUPPORT,
  }
}
