import { describe, expect, it, vi } from 'vitest'

const persistMessagesMock = vi.hoisted(() => vi.fn())
const recordDailyUsageMock = vi.hoisted(() => vi.fn())
const logBusinessEventMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/ai/services/chat-history', () => ({
  persistMessages: persistMessagesMock,
}))

vi.mock('@/features/ai/services/chat-usage', () => ({
  recordDailyUsage: recordDailyUsageMock,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: logBusinessEventMock,
}))

import { finalizeCachedAnswer } from '@/features/ai/services/chat-cached-answer'
import { buildAiCacheKey } from '@/lib/ai/ai-cache'

describe('chat-cached-answer', () => {
  it('keeps product and catalog cache spaces disjoint', () => {
    expect(buildAiCacheKey('catalog', 'What is this?', 'INR')).not.toBe(
      buildAiCacheKey('product:abc1234', 'What is this?', 'INR')
    )
  })

  it('persists cached history under the resolved surface', async () => {
    await finalizeCachedAnswer('Cached answer', {
      surface: 'catalog',
      userId: 'user-1',
      trimmed: [{ role: 'user', text: 'Hi' }],
      estimatedInputTokens: 2,
      dailyUsage: { requests: 0, tokens: 0 },
      threadId: 'catalog-user-scoped-default',
      persistHistory: true,
      maxHistoryMessages: 10,
      chatModel: 'gemini-test',
    })

    expect(recordDailyUsageMock).toHaveBeenCalledWith('user-1', 6)
    expect(persistMessagesMock).toHaveBeenCalledWith(
      'user-1',
      'catalog',
      'catalog-user-scoped-default',
      [
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Cached answer' },
      ]
    )
    expect(logBusinessEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ai_chat_request',
        details: expect.objectContaining({ surface: 'catalog', cached: true }),
      })
    )
  })
})
