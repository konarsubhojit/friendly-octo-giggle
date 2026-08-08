import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { drizzleDb } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { isValidCurrencyCode } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'
import {
  ChatRequestSchema,
  type ChatMessage,
  type RequestIdentity,
} from './chat-types'
import { MAX_GUEST_ID_LENGTH, MAX_INPUT_MESSAGE_CHARS } from './chat-constants'
import { sanitizePromptText } from './chat-prompt'
import { resolveThreadId } from './chat-history'

export type PreparedRequest = {
  identity: RequestIdentity
  persistHistory: boolean
  threadId: string
  sanitizedMessages: ChatMessage[]
}

export type PrepareRequestResult =
  | { ok: true; prepared: PreparedRequest }
  | { ok: false; error: string }

export const resolveRequestIdentity = async (
  request: NextRequest
): Promise<RequestIdentity> => {
  const session = await auth()
  const sessionUserId =
    typeof session?.user?.id === 'string' ? session.user.id.trim() : ''
  if (sessionUserId) {
    return { userId: sessionUserId, isAuthenticated: true }
  }

  const rawClientId =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  const guestId = createHash('sha256')
    .update(rawClientId)
    .digest('hex')
    .slice(0, MAX_GUEST_ID_LENGTH)

  return {
    userId: `guest:${guestId}`,
    isAuthenticated: false,
  }
}

export const resolveCurrencyForUser = async (
  userId: string
): Promise<CurrencyCode> => {
  const userRecord = await drizzleDb.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { currencyPreference: true },
  })
  if (
    userRecord?.currencyPreference &&
    isValidCurrencyCode(userRecord.currencyPreference)
  ) {
    return userRecord.currencyPreference
  }
  return 'INR'
}

export const parseAndValidateRequest = async (
  request: NextRequest,
  productId: string
): Promise<PrepareRequestResult> => {
  const body = await request.json()
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: 'Invalid request body' }

  const identity = await resolveRequestIdentity(request)

  if (
    parsed.data.messages.some(
      (message) =>
        message.text.trim().length === 0 ||
        message.text.length > MAX_INPUT_MESSAGE_CHARS
    )
  ) {
    return {
      ok: false,
      error: `Each message must be between 1 and ${MAX_INPUT_MESSAGE_CHARS} characters`,
    }
  }

  const sanitizedMessages = parsed.data.messages.map((message) => ({
    ...message,
    text: sanitizePromptText(message.text),
  }))
  if (sanitizedMessages.some((message) => message.text.length === 0)) {
    return { ok: false, error: 'Messages must include meaningful text' }
  }

  return {
    ok: true,
    prepared: {
      identity,
      persistHistory:
        identity.isAuthenticated && (parsed.data.persistHistory ?? false),
      threadId: resolveThreadId(parsed.data.threadId, productId),
      sanitizedMessages,
    },
  }
}
