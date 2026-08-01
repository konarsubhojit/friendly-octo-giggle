import { cron } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import { logBusinessEvent } from '@/lib/logger'

type ExchangeRateApiResponse = {
  result: string
  base_code: string
  conversion_rates: Record<string, number>
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'] as const

/**
 * Three retries. The route this replaces had none, so a single transient 502
 * from the upstream provider cost a full day of stale rates.
 */
export const EXCHANGE_RATE_RETRIES = 3

const getUtcDateString = (): string => new Date().toISOString().slice(0, 10)

const secondsUntilMidnightUtc = (): number => {
  const now = new Date()
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

const fetchAndNormaliseRates = async (): Promise<Record<string, number>> => {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY
  if (!apiKey) {
    throw new Error('Exchange rate API key not configured')
  }

  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`
  )
  if (!res.ok) {
    throw new Error(`External API responded with status ${res.status}`)
  }

  const data = (await res.json()) as ExchangeRateApiResponse
  if (data.result !== 'success') {
    throw new Error('Exchange rate API returned an error response')
  }

  const inrRate = data.conversion_rates['INR']
  if (inrRate == null || inrRate === 0) {
    throw new Error(
      'Exchange rate API response is missing a valid INR conversion rate'
    )
  }

  const rates: Record<string, number> = { INR: 1 }
  for (const code of SUPPORTED_CURRENCIES) {
    const raw = data.conversion_rates[code]
    if (raw != null) {
      rates[code] = raw / inrRate
    }
  }

  return rates
}

/**
 * Warm the daily exchange-rate cache before the traffic that needs it arrives.
 *
 * Prices are stored in one currency and converted at display time, so a cold
 * cache means the first shopper of the day pays the upstream API's latency.
 */
export const refreshExchangeRatesFunction = inngest.createFunction(
  {
    id: 'refresh-exchange-rates',
    name: 'Refresh exchange rates',
    triggers: [cron('0 3 * * *')],
    retries: EXCHANGE_RATE_RETRIES,
  },
  async ({ step }) => {
    if (!process.env.EXCHANGE_RATE_API_KEY) {
      // Not a failure: the app falls back to its static rate table, and
      // retrying cannot conjure a key.
      return { refreshed: false, reason: 'api-key-missing' as const }
    }

    const date = getUtcDateString()

    const rates = await step.run('fetch-exchange-rates', () =>
      getCachedData(
        CACHE_KEYS.EXCHANGE_RATES_BY_DATE(date),
        secondsUntilMidnightUtc(),
        fetchAndNormaliseRates,
        300
      )
    )

    await step.score('score-rates-refreshed', {
      name: SCORE_NAMES.exchangeRatesRefreshed,
      value: Object.keys(rates).length > 1,
    })

    logBusinessEvent({
      event: 'cron_exchange_rates_refreshed',
      details: { currencies: Object.keys(rates), date },
      success: true,
    })

    return { refreshed: true, date, currencies: Object.keys(rates) }
  }
)
