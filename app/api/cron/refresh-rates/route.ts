import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getCachedData } from "@/lib/redis";
import { CACHE_KEYS } from "@/lib/cache";
import { logBusinessEvent, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

type ExchangeRateApiResponse = {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
};

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"] as const;

const isVercelCron = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  }
  return request.headers.get("user-agent")?.startsWith("vercel-cron") ?? false;
};

const getUtcDateString = (): string => new Date().toISOString().slice(0, 10);

const secondsUntilMidnightUtc = (): number => {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};

const fetchAndNormaliseRates = async (): Promise<Record<string, number>> => {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error("Exchange rate API key not configured");
  }

  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/INR`,
  );
  if (!res.ok) {
    throw new Error(`External API responded with status ${res.status}`);
  }

  const data = (await res.json()) as ExchangeRateApiResponse;
  if (data.result !== "success") {
    throw new Error("Exchange rate API returned an error response");
  }

  const inrRate = data.conversion_rates["INR"];
  if (inrRate == null || inrRate === 0) {
    throw new Error(
      "Exchange rate API response is missing a valid INR conversion rate",
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
};

export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) {
    return apiError("Unauthorized", 401);
  }

  if (!process.env.EXCHANGE_RATE_API_KEY) {
    return apiError("Exchange rate API key not configured", 503);
  }

  try {
    const cacheKey = CACHE_KEYS.EXCHANGE_RATES_BY_DATE(getUtcDateString());
    const ttl = secondsUntilMidnightUtc();

    const rates = await getCachedData(
      cacheKey,
      ttl,
      fetchAndNormaliseRates,
      300,
    );

    logBusinessEvent({
      event: "cron_exchange_rates_refreshed",
      details: { currencies: Object.keys(rates), date: getUtcDateString() },
      success: true,
    });

    return apiSuccess({ rates, refreshedAt: new Date().toISOString() });
  } catch (error) {
    logError({ error, context: "cron_exchange_rates" });
    return apiError("Exchange rate refresh failed", 500);
  }
};
