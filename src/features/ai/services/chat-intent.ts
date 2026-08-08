import { convertPriceToINR } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'
import type { IntentSignals } from './chat-types'

const DELIVERY_INFO_PATTERNS = [
  /\b(delivery|deliver|shipping|arrive|eta|estimate)\b/i,
]

const RECOMMENDATION_PATTERNS = [
  /\b(recommend|suggest|best|good option|top pick)\b/i,
  /\b(under|below|less than)\b.{0,12}\b[$₹€£]?\s*\d+/i,
]

const COMPARISON_PATTERNS = [
  /\bcompare\b/i,
  /\b(vs|versus)\b/i,
  /\bdifference between\b/i,
]

const REVIEW_SUMMARY_PATTERNS = [
  /\b(review|reviews|rating|ratings|feedback|customers?\s+say)\b/i,
]

const ORDER_STATUS_PATTERNS = [
  /\bwhere\s+is\s+my\s+order\b/i,
  /\border\s+status\b/i,
  /\btrack(?:ing)?\s+my\s+order\b/i,
]

const BUDGET_PATTERN =
  /\b(?:under|below|less than|up to)\s*(?:([$₹€£])\s*)?(\d+(?:\.\d{1,2})?)\s*([$₹€£])?/i

export const ORDER_ID_PATTERN = /\b[A-Za-z0-9]{7,10}\b/

const JAILBREAK_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior)\s+(instructions|rules)\b/i,
  /\b(system\s*prompt|developer\s*message|jailbreak|bypass\s+safety)\b/i,
  /\b(reveal|show|print|dump)\b.{0,40}\b(prompt|instructions|hidden\s+rules)\b/i,
  /\b(act\s+as|pretend\s+to\s+be)\b.{0,30}\b(system|developer|dan)\b/i,
]

const OFF_DOMAIN_PATTERNS = [
  /\b(write|generate|create)\b.{0,30}\b(code|script|sql|program|regex|essay|poem)\b/i,
  /\b(solve|calculate)\b.{0,20}\b(math|equation|homework)\b/i,
  /\b(weather\s+(today|tomorrow|in)\b|forecast|temperature\s+in)\b/i,
  /\b(latest\s+news|headlines|politics|election)\b/i,
  /\bmedical\s+advice|diagnose|prescription|legal\s+advice\b/i,
]

const normalizePolicyText = (
  text: string
): { normalized: string; compact: string } => {
  const normalized = text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F]|[\uFE00-\uFE0F]/g, '')
    .toLowerCase()
    .replace(/[013457]/g, (char) => {
      const map: Record<string, string> = {
        '0': 'o',
        '1': 'i',
        '3': 'e',
        '4': 'a',
        '5': 's',
        '7': 't',
      }
      return map[char] ?? char
    })
    .replace(/\s+/gu, ' ')
    .trim()
  return {
    normalized,
    compact: normalized.replace(/[^a-z]/g, ''),
  }
}

export const detectIntentSignals = (text: string): IntentSignals => ({
  wantsComparison: COMPARISON_PATTERNS.some((pattern) => pattern.test(text)),
  wantsRecommendation: RECOMMENDATION_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
  wantsDeliveryInfo: DELIVERY_INFO_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
  wantsOrderStatus: ORDER_STATUS_PATTERNS.some((pattern) => pattern.test(text)),
  wantsReviewSummary: REVIEW_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(text)
  ),
})

export const usesAnyAdvancedIntent = (intents: IntentSignals): boolean =>
  intents.wantsComparison ||
  intents.wantsRecommendation ||
  intents.wantsDeliveryInfo ||
  intents.wantsOrderStatus ||
  intents.wantsReviewSummary

export const detectBlockedPrompt = (text: string): string | null => {
  const { normalized, compact } = normalizePolicyText(text)
  if (
    JAILBREAK_PATTERNS.some(
      (pattern) => pattern.test(normalized) || pattern.test(compact)
    )
  ) {
    return 'Prompt contains disallowed instructions.'
  }
  if (
    OFF_DOMAIN_PATTERNS.some(
      (pattern) => pattern.test(normalized) || pattern.test(compact)
    )
  ) {
    return 'Only product-related questions are allowed.'
  }
  return null
}

const detectCurrencyFromSymbol = (
  symbol: string | undefined,
  fallbackCurrency: CurrencyCode
): CurrencyCode => {
  switch (symbol) {
    case '$':
      return 'USD'
    case '€':
      return 'EUR'
    case '£':
      return 'GBP'
    case '₹':
      return 'INR'
    default:
      return fallbackCurrency
  }
}

export const parseBudgetInINR = (
  text: string,
  fallbackCurrency: CurrencyCode
): number | null => {
  const match = new RegExp(BUDGET_PATTERN).exec(text)
  if (!match) return null
  const raw = Number(match[2])
  if (!Number.isFinite(raw) || raw <= 0) return null

  const symbol = match[1] ?? match[3]
  const detectedCurrency = detectCurrencyFromSymbol(symbol, fallbackCurrency)

  return convertPriceToINR(raw, detectedCurrency)
}
