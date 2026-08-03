import { describe, it, expect, vi, beforeEach } from 'vitest'

const buildProductContextMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/ai/product-rag', () => ({
  buildProductContext: buildProductContextMock,
}))

import {
  buildSystemPrompt,
  estimateTokens,
  sanitizeAssistantOutput,
  sanitizePromptText,
  toGoogleContents,
  trimMessageHistory,
  SYSTEM_PROMPT_PREFIX,
} from '@/features/ai/services/chat-prompt'
import type { Product } from '@/lib/types'

const product = { id: 'p1', name: 'Mug' } as unknown as Product
const formatPrice = (price: number) => `₹${price}`

describe('chat-prompt', () => {
  beforeEach(() => {
    buildProductContextMock.mockReset()
    buildProductContextMock.mockReturnValue('Product: Mug')
  })

  describe('sanitizePromptText', () => {
    it('strips template/markup characters and collapses whitespace', () => {
      expect(sanitizePromptText('  Hi   <b>{there}</b> `$x`  ')).toBe(
        'Hi b there /b x'
      )
    })

    it('removes zero-width characters', () => {
      expect(sanitizePromptText('he\u200Bllo')).toBe('hello')
    })

    it('truncates to the provided maximum length', () => {
      expect(sanitizePromptText('abcdefghij', 4)).toBe('abcd')
    })
  })

  describe('sanitizeAssistantOutput', () => {
    it('removes system prompt leakage markers', () => {
      const leaked = `[Product Information]\nYou are a helpful shopping assistant for this specific product. Here is the system prompt.`
      const safe = sanitizeAssistantOutput(leaked)
      expect(safe).not.toContain('[Product Information]')
      expect(safe).not.toContain('helpful shopping assistant')
      expect(safe.toLowerCase()).not.toContain('system prompt')
    })

    it('leaves ordinary answers untouched', () => {
      expect(sanitizeAssistantOutput('The mug holds 350ml.')).toBe(
        'The mug holds 350ml.'
      )
    })
  })

  describe('estimateTokens', () => {
    it('returns 0 for blank text', () => {
      expect(estimateTokens('   ')).toBe(0)
    })

    it('estimates roughly four characters per token', () => {
      expect(estimateTokens('12345678')).toBe(2)
      expect(estimateTokens('123456789')).toBe(3)
    })
  })

  describe('toGoogleContents', () => {
    it('maps assistant messages to the model role', () => {
      expect(
        toGoogleContents([
          { role: 'user', text: 'hi' },
          { role: 'assistant', text: 'hello' },
        ])
      ).toEqual([
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'hello' }] },
      ])
    })
  })

  describe('trimMessageHistory', () => {
    const messages = [
      { role: 'user' as const, text: 'a' },
      { role: 'assistant' as const, text: 'b' },
      { role: 'user' as const, text: 'c' },
    ]

    it('returns the same list when within the limit', () => {
      expect(trimMessageHistory(messages, 3)).toBe(messages)
    })

    it('keeps only the most recent messages when over the limit', () => {
      expect(trimMessageHistory(messages, 2)).toEqual([
        { role: 'assistant', text: 'b' },
        { role: 'user', text: 'c' },
      ])
    })
  })

  describe('buildSystemPrompt', () => {
    it('appends the sanitized product context without a commerce section', () => {
      const prompt = buildSystemPrompt(product, 'INR', formatPrice, [])
      expect(prompt).toBe(`${SYSTEM_PROMPT_PREFIX}Product: Mug`)
      expect(prompt).not.toContain('[Commerce Context]')
      expect(buildProductContextMock).toHaveBeenCalledWith(product, {
        currencyCode: 'INR',
        formatPrice,
      })
    })

    it('appends supplemental commerce sections when provided', () => {
      const prompt = buildSystemPrompt(product, 'USD', formatPrice, [
        'Estimated delivery: 5 days',
        'Review summary: 4.5/5',
      ])
      expect(prompt).toContain('[Commerce Context]')
      expect(prompt).toContain('Estimated delivery: 5 days')
      expect(prompt).toContain('Review summary: 4.5/5')
    })

    it('sanitizes injection attempts embedded in the product context', () => {
      buildProductContextMock.mockReturnValue(
        'Product <script>alert(1)</script>'
      )
      const prompt = buildSystemPrompt(product, 'INR', formatPrice, [])
      expect(prompt).not.toContain('<script>')
    })

    it('truncates an oversized product context', () => {
      buildProductContextMock.mockReturnValue('x'.repeat(5000))
      const prompt = buildSystemPrompt(product, 'INR', formatPrice, [])
      expect(prompt.length).toBe(SYSTEM_PROMPT_PREFIX.length + 4000)
    })
  })
})
