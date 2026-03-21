import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { getCachedData } from '@/lib/redis';
import { CACHE_KEYS } from '@/lib/cache';
import { logError } from '@/lib/logger';

type ExchangeRateApiResponse = {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
};

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

/** Signals that the external exchange-rate API returned an unexpected response. */
class UpstreamApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamApiError';
  }
}

/** Returns today's date as a UTC string "YYYY-MM-DD", used as the cache key suffix. */
const getUtcDateString = (): string => {
  return new Date().toISOString().slice(0, 10);
}

/** Seconds remaining until the next UTC midnight — the natural TTL for daily rates. */
const secondsUntilMidnightUtc = (): number => {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Fetch raw rates from the external API and normalise them to an INR base.
 *
 * The API is called with `/latest/INR`, so `base_code` will normally be "INR"
 * and `conversion_rates.INR === 1`. We still normalise defensively so the
 * function is correct for any base returned by the API (e.g. the docs sample
 * uses USD as base). Normalisation formula:
 *
 *   rate(INR → code) = conversion_rates[code] / conversion_rates[INR]
 *
 * When base_code is INR: conversion_rates.INR = 1, so the formula is a no-op.
 * When base_code is USD: conversion_rates.INR = ~91.87, which yields the
 *   correct 1/91.87 rate for USD.
 */
const fetchAndNormaliseRates = async (): Promise<Record<string, number>> => {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error('Exchange rate API key not configured');
  }

  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`,
  );
  if (!res.ok) {
    throw new UpstreamApiError(`External API responded with status ${res.status}`);
  }

  const data = (await res.json()) as ExchangeRateApiResponse;
  if (data.result !== 'success') {
    throw new UpstreamApiError('Exchange rate API returned an error response');
  }

  // Denominator: how many units of the API's base equal 1 INR.
  // If base is already INR this is 1; otherwise we cross-divide.
  const inrRate = data.conversion_rates['INR'];
  if (inrRate == null || inrRate === 0) {
    throw new UpstreamApiError(
      'Exchange rate API response is missing a valid INR conversion rate',
    );
  }

  const rates: Record<string, number> = { INR: 1 };
  for (const code of SUPPORTED_CURRENCIES) {
    const raw = data.conversion_rates[code];
    if (raw != null && inrRate !== 0) {
      rates[code] = raw / inrRate;
    }
  }

  return rates;
}

export const GET = async () => {
  if (!process.env.EXCHANGE_RATE_API_KEY) {
    return apiError('Exchange rate API key not configured', 503);
  }

  try {
    const cacheKey = CACHE_KEYS.EXCHANGE_RATES_BY_DATE(getUtcDateString());
    const ttl = secondsUntilMidnightUtc();

    // getCachedData falls back to a direct fetch when Redis is unavailable
    const rates = await getCachedData(
      cacheKey,
      ttl,
      fetchAndNormaliseRates,
      300, // serve stale up to 5 min past midnight while the first request of the day refetches
    );

    return apiSuccess({ rates });
  } catch (error) {
    if (error instanceof UpstreamApiError) {
      logError({ error, context: 'exchange_rates' });
      return apiError(error.message, 502);
    }
    return handleApiError(error);
  }
}
