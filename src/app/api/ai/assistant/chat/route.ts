import { type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { logError } from '@/lib/logger'
import { runChatEngine } from '@/features/ai/services/chat-engine'
import { buildCatalogSystemPrompt } from '@/features/ai/services/chat-prompt'
import { assistantToolRegistry } from '@/features/ai/services/chat-tools'

export const POST = async (request: NextRequest) => {
  try {
    return await runChatEngine({
      request,
      surface: 'catalog',
      systemPrompt: buildCatalogSystemPrompt(),
      toolRegistry: assistantToolRegistry,
    })
  } catch (error) {
    logError({
      error,
      context: 'ai_assistant_chat',
    })
    return handleApiError(error)
  }
}
