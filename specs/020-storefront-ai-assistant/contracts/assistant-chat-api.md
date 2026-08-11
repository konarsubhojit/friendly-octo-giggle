# Contract: Catalog-Wide Assistant Chat API (NEW)

`POST /api/ai/assistant/chat`

This is the new, product-independent entry point for User Story 1 (catalog-wide discovery),
User Story 2 (comparison/constrained recommendation), and — for authenticated shoppers — User
Story 3 (order questions). It shares its request/response shape with the existing
`POST /api/ai/products/[id]/chat` (see [product-chat-api.md](./product-chat-api.md)) because both
are adapters over the same `chat-engine.ts`.

## Request

```http
POST /api/ai/assistant/chat
Content-Type: application/json
```

```ts
{
  messages: Array<{ role: 'user' | 'assistant'; text: string }>, // min 1
  persistHistory?: boolean,   // ignored (forced false) for unauthenticated callers
  threadId?: string,          // ^[a-zA-Z0-9:_-]+$, max 80 chars; defaults to `catalog-{guest|user-scoped-default}`
}
```

Validation identical to the existing `ChatRequestSchema`:
- Each `messages[i].text` MUST be 1–`MAX_INPUT_MESSAGE_CHARS` (500) characters after
  sanitization (`sanitizePromptText`); otherwise `400`.
- `messages` MUST have at least one entry; otherwise `400`.

## Authentication

- No authentication required to call this route (guests may use catalog discovery and
  comparison). Order-status questions from a guest are answered entirely within the model's text
  response as "sign in to check your orders" — the `get_order_status` tool is never invoked for
  an unauthenticated identity (see [data-model.md](../data-model.md), AssistantIdentity).
- Session identity is resolved server-side via `resolveRequestIdentity(request)` — the same
  function the anchored route already uses. No identity may be supplied by the client.

## Behavior

1. Resolve identity (`resolveRequestIdentity`) and preferred currency
   (`resolveCurrencyForUser` for authenticated users, `'INR'` for guests).
2. Load and merge persisted history (authenticated + `persistHistory: true` only), enforcing
   `MAX_CONVERSATION_TURNS`.
3. Run `detectBlockedPrompt` on the latest user message; `400` if blocked (jailbreak/off-domain).
4. Check `aiConfig.enabled`; `503` if the AI provider is unavailable (FR-013).
5. Enforce daily request/token quotas via `enforceQuotas`, keyed by the same `userId` as the
   anchored route (shared budget across both surfaces, R8). `429` on exhaustion.
6. For single-turn, cache-eligible requests, check the response cache under
   `surface = 'catalog'` (D3); return the cached answer immediately if present.
7. Otherwise, call the model with the four `functionDeclarations` from `chat-tools.ts` and no
   anchor product. Execute up to `MAX_TOOL_CALLS_PER_TURN` tool calls
   (`search_catalog`, `get_product_details`, `compare_products`, `get_order_status`), then stream
   the model's final answer.
8. Background (`waitUntil`): record usage, write the surface-scoped cache entry, persist history
   if applicable, log `ai_chat_request` / `ai_chat_usage` / `ai_chat_tool_call` business events.

## Response

Identical shape to the anchored route:

- **200**, `Content-Type: text/plain; charset=utf-8`, a token stream body. If `persistHistory`
  was honored, header `X-AI-Thread-ID: {threadId}` is present.
- **200** (cache hit, single-turn only): `{ "text": string, "threadId"?: string }` JSON body.
- **400**: invalid request body, blocked prompt, or conversation-turn limit exceeded.
- **429**: daily request/token/advanced-feature quota exceeded.
- **503**: AI features currently unavailable (`aiConfig.enabled === false`) or advanced features
  disabled while the turn requires them.

## Guardrails asserted by this contract (traceable to spec Functional Requirements)

| Guarantee                                                                 | FR      |
| -------------------------------------------------------------------------- | ------- |
| Every product claim is grounded in a tool result; no invented products      | FR-002  |
| Soft-deleted/unpublished products never appear in tool results              | FR-003  |
| Only the four declared tools are ever offered to the model                  | FR-004  |
| Every tool argument is Zod-validated before execution                       | FR-005  |
| `get_order_status` requires authentication and is scoped server-side        | FR-006  |
| No tool performs a mutation                                                 | FR-007  |
| No response discloses an exact stock count                                  | FR-008  |
| Guest conversations are never persisted; guest id stays one-way hashed      | FR-009  |
| Retrieved content is treated as untrusted and cannot alter instructions     | FR-010  |
| Tool-calling depth and per-turn tokens are bounded                          | FR-011  |
| Semantic retrieval falls back to Upstash then DB search                     | FR-012  |
| AI-provider unavailability degrades to conventional search, no error page   | FR-013  |
| Strict `/api/ai` rate limiting applies (via existing proxy prefix match)    | FR-014  |
| Logs/metrics exclude raw guest ids, credentials, and prompt PII             | FR-015  |
| Model config is Edge-Config-driven with hardcoded defaults                  | FR-016  |

## Example exchange

Request:
```json
{ "messages": [{ "role": "user", "text": "I need a waterproof jacket under 3000 rupees" }] }
```

Tool calls the model may issue: `search_catalog({ query: "waterproof jacket", maxPriceInDisplayCurrency: 3000 })`.

Response (streamed): a short answer citing 1–3 real, in-catalog products with links, or "I
couldn't find a waterproof jacket under ₹3,000 in the catalog right now" if `search_catalog`
returns no candidates (User Story 1, Acceptance Scenario 3).
