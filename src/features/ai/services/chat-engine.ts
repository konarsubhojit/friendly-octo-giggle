import type { FunctionCall, Part } from '@google/genai'
import { FunctionCallingConfigMode } from '@google/genai'
import { NextResponse, type NextRequest } from 'next/server'
import { getCachedAiResponse } from '@/lib/ai/ai-cache'
import { buildGenerateConfig, genAI, getAiConfigCached } from '@/lib/ai/gateway'
import { apiError } from '@/lib/api-utils'
import { formatPriceForCurrency, type CurrencyCode } from '@/lib/currency'
import { logBusinessEvent } from '@/lib/logger'
import {
  ADVANCED_DAILY_REQUEST_QUOTA,
  DAILY_REQUEST_QUOTA,
  DAILY_TOKEN_QUOTA,
  MAX_CONVERSATION_TURNS,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_CALLS_PER_TURN,
} from './chat-constants'
import { finalizeCachedAnswer } from './chat-cached-answer'
import { composeConversationMessages } from './chat-history'
import {
  detectBlockedPrompt,
  detectIntentSignals,
  usesAnyAdvancedIntent,
} from './chat-intent'
import {
  buildFunctionDeclarations,
  dispatchToolCall,
  getAssistantTool,
} from './chat-tools'
import {
  estimateTokens,
  sanitizeAssistantOutput,
  toGoogleContents,
} from './chat-prompt'
import { parseAndValidateRequest, resolveCurrencyForUser } from './chat-request'
import { buildStreamReader, scheduleStreamSideEffects } from './chat-stream'
import { enforceQuotas, getDailyUsage, recordDailyUsage } from './chat-usage'
import type { AssistantSurface, AssistantTool, ChatMessage } from './chat-types'

export type RunChatEngineParams = {
  request: NextRequest
  surface: AssistantSurface
  systemPrompt:
    | string
    | ((params: {
        readonly anchorProductId?: string
        readonly currencyCode: CurrencyCode
        readonly formatPrice: (priceInINR: number) => string
        readonly identity: { userId: string; isAuthenticated: boolean }
        readonly intents: ReturnType<typeof detectIntentSignals>
        readonly lastUserText: string
        readonly surface: AssistantSurface
      }) => Promise<string> | string)
  anchorProductId?: string
  toolRegistry?: readonly AssistantTool<unknown>[]
}

const buildFunctionCallParts = (calls: FunctionCall[]): Part[] =>
  calls.map((call) => ({
    functionCall: {
      id: call.id,
      name: call.name,
      args: call.args,
    },
  }))

const createSingleChunkStream = async function* (
  text: string
): AsyncIterable<{ text?: string }> {
  yield { text }
}

const buildChatResponse = (
  readable: ReadableStream<Uint8Array>,
  persistHistory: boolean,
  threadId: string
): Response =>
  new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
      ...(persistHistory ? { 'X-AI-Thread-ID': threadId } : {}),
    },
  })

const createToolExecutionContext = (params: {
  userId: string
  isAuthenticated: boolean
  currencyCode: CurrencyCode
  formatPrice: (priceInINR: number) => string
  anchorProductId?: string
}) => ({
  identity: {
    userId: params.userId,
    isAuthenticated: params.isAuthenticated,
  },
  currencyCode: params.currencyCode,
  formatPrice: params.formatPrice,
  anchorProductId: params.anchorProductId,
})

const runToolCallingLoop = async (params: {
  chatModel: string
  contents: ReturnType<typeof toGoogleContents>
  systemPrompt: string
  maxOutputTokens: number
  maxToolCalls: number
  toolRegistry: readonly AssistantTool<unknown>[]
  toolContext: ReturnType<typeof createToolExecutionContext>
  surface: AssistantSurface
  aiConfig: Awaited<ReturnType<typeof getAiConfigCached>>
}): Promise<string> => {
  const declarations = buildFunctionDeclarations(params.toolRegistry)
  let contents: ChatMessage[] | ReturnType<typeof toGoogleContents> =
    params.contents
  let executedToolCalls = 0
  let finalText = ''
  let functionCallsAllowed = declarations.length > 0

  for (let attempt = 0; attempt <= params.maxToolCalls + 1; attempt += 1) {
    const config = {
      ...buildGenerateConfig(params.aiConfig, params.systemPrompt, {
        tools: declarations,
        functionCallingMode:
          functionCallsAllowed && executedToolCalls < params.maxToolCalls
            ? undefined
            : FunctionCallingConfigMode.NONE,
      }),
      maxOutputTokens: params.maxOutputTokens,
    }

    const response = await genAI.models.generateContent({
      model: params.chatModel,
      contents,
      config,
    })

    const functionCalls = response.functionCalls ?? []
    const remainingToolCalls = params.maxToolCalls - executedToolCalls

    if (
      functionCallsAllowed &&
      functionCalls.length > 0 &&
      remainingToolCalls > 0
    ) {
      const callable = functionCalls.slice(0, remainingToolCalls)
      const functionResponses: Part[] = []

      for (const call of callable) {
        const toolName = typeof call.name === 'string' ? call.name : ''
        const tool = toolName
          ? getAssistantTool(toolName, params.toolRegistry)
          : undefined
        const output = await dispatchToolCall(
          toolName,
          call.args ?? {},
          params.toolContext,
          params.toolRegistry
        )

        executedToolCalls += 1
        functionResponses.push({
          functionResponse: {
            id: call.id,
            name: toolName,
            response: { output },
          },
        })
        logBusinessEvent({
          event: 'ai_chat_tool_call',
          details: {
            surface: params.surface,
            toolName: toolName || 'unknown',
            callCount: executedToolCalls,
          },
          success: Boolean(tool),
        })
      }

      contents = [
        ...contents,
        {
          role: 'model',
          parts: buildFunctionCallParts(callable),
        },
        {
          role: 'user',
          parts: functionResponses,
        },
      ]

      if (executedToolCalls >= params.maxToolCalls) {
        functionCallsAllowed = false
      }
      continue
    }

    finalText = sanitizeAssistantOutput(
      response.text ?? 'I could not find enough information to answer that.'
    )
    break
  }

  return finalText
}

export const runChatEngine = async ({
  request,
  surface,
  systemPrompt,
  anchorProductId,
  toolRegistry = [],
}: RunChatEngineParams): Promise<Response> => {
  const prepared = await parseAndValidateRequest(request, anchorProductId)
  if (!prepared.ok) return apiError(prepared.error, 400)

  const { identity, persistHistory, threadId, sanitizedMessages } =
    prepared.prepared
  const { userId, isAuthenticated } = identity

  const allMessages = await composeConversationMessages(
    sanitizedMessages,
    persistHistory,
    userId,
    surface,
    threadId,
    MAX_CONVERSATION_TURNS * 2
  )

  const conversationTurns = allMessages.filter(
    (message) => message.role === 'user'
  ).length
  if (conversationTurns > MAX_CONVERSATION_TURNS) {
    return apiError(
      `Conversation is limited to ${MAX_CONVERSATION_TURNS} user turns`,
      400
    )
  }

  const lastUserText =
    allMessages.findLast((message) => message.role === 'user')?.text ?? ''
  const blockedReason = detectBlockedPrompt(lastUserText)
  if (blockedReason) return apiError(blockedReason, 400)

  const intents = detectIntentSignals(lastUserText)
  const usesAdvancedFeatures = usesAnyAdvancedIntent(intents)
  const currencyCode = isAuthenticated
    ? await resolveCurrencyForUser(userId)
    : 'INR'
  const formatPrice = (priceInINR: number) =>
    formatPriceForCurrency(priceInINR, currencyCode)

  const aiConfig = await getAiConfigCached()
  if (aiConfig.enabled === false) {
    return apiError('AI features are currently unavailable', 503)
  }
  if (usesAdvancedFeatures && aiConfig.advancedFeaturesEnabled === false) {
    return apiError('Advanced AI features are currently unavailable', 503)
  }

  const chatModel = aiConfig.chatModel
  const resolvedSystemPrompt =
    typeof systemPrompt === 'string'
      ? systemPrompt
      : await systemPrompt({
          anchorProductId,
          currencyCode,
          formatPrice,
          identity,
          intents,
          lastUserText,
          surface,
        })
  const trimmed = allMessages.slice(
    -Math.min(aiConfig.maxHistoryMessages, MAX_CONVERSATION_TURNS * 2)
  )
  const isSingleTurn = trimmed.length === 1
  const estimatedInputTokens = trimmed.reduce(
    (sum, message) => sum + estimateTokens(message.text),
    0
  )
  const reservedTotalTokens = estimatedInputTokens + MAX_OUTPUT_TOKENS

  const dailyUsage = await getDailyUsage(userId)
  const quotaError = await enforceQuotas({
    userId,
    dailyUsage,
    reservedTotalTokens,
    requestQuota: aiConfig.dailyRequestQuota ?? DAILY_REQUEST_QUOTA,
    tokenQuota: aiConfig.dailyTokenQuota ?? DAILY_TOKEN_QUOTA,
    usesAdvancedFeatures,
    advancedQuota:
      aiConfig.advancedFeatureDailyRequestQuota ?? ADVANCED_DAILY_REQUEST_QUOTA,
  })
  if (quotaError) return apiError(quotaError, 429)

  if (isSingleTurn && lastUserText) {
    const cached = await getCachedAiResponse(
      surface,
      lastUserText,
      currencyCode
    )
    if (cached !== null) {
      await finalizeCachedAnswer(cached, {
        surface,
        userId,
        trimmed,
        estimatedInputTokens,
        dailyUsage,
        threadId,
        persistHistory,
        maxHistoryMessages: aiConfig.maxHistoryMessages,
        chatModel,
      })
      return NextResponse.json(
        { text: cached, threadId: persistHistory ? threadId : undefined },
        persistHistory ? { headers: { 'X-AI-Thread-ID': threadId } } : undefined
      )
    }
  }

  await recordDailyUsage(userId, reservedTotalTokens)

  const finalText = await runToolCallingLoop({
    chatModel,
    contents: toGoogleContents(trimmed),
    systemPrompt: resolvedSystemPrompt,
    maxOutputTokens: Math.min(aiConfig.maxResponseTokens, MAX_OUTPUT_TOKENS),
    maxToolCalls: aiConfig.maxToolCallsPerTurn ?? MAX_TOOL_CALLS_PER_TURN,
    toolRegistry,
    toolContext: createToolExecutionContext({
      userId,
      isAuthenticated,
      currencyCode,
      formatPrice,
      anchorProductId,
    }),
    surface,
    aiConfig,
  })

  logBusinessEvent({
    event: 'ai_chat_request',
    details: {
      surface,
      chatModel,
      messageCount: trimmed.length,
    },
    success: true,
  })

  const { readable, fullTextPromise } = buildStreamReader(
    createSingleChunkStream(finalText)
  )
  scheduleStreamSideEffects({
    fullTextPromise,
    surface,
    userId,
    lastUserText,
    currencyCode,
    isSingleTurn,
    persistHistory,
    threadId,
    trimmed,
    estimatedInputTokens,
    reservedTotalTokens,
    dailyUsage,
    maxHistoryMessages: aiConfig.maxHistoryMessages,
  })

  return buildChatResponse(readable, persistHistory, threadId)
}
