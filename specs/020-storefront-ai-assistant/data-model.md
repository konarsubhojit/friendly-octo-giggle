# Data Model: Storefront AI Assistant

No new database tables, columns, or migrations are introduced by this feature. Every entity
below is a **runtime/type-level construct**, not persisted schema, matching the spec's Key
Entities section. This document defines their shapes, invariants, and where they live in code.

## Entity: AssistantTool

A server-defined, Zod-validated, authorization-checked capability the model may invoke. Declared
in `src/features/ai/services/chat-tools.ts`.

```ts
type AssistantToolName =
  | 'search_catalog'
  | 'get_product_details'
  | 'compare_products'
  | 'get_order_status'

interface AssistantTool<Args> {
  name: AssistantToolName
  description: string          // sent to the model as the FunctionDeclaration description
  argsSchema: z.ZodType<Args>  // validated before execution; source of the FunctionDeclaration.parameters
  requiresAuth: boolean        // true only for get_order_status
  execute: (args: Args, ctx: ToolExecutionContext) => Promise<string> // returns prompt-ready text
}

interface ToolExecutionContext {
  identity: RequestIdentity     // { userId, isAuthenticated } — never derived from tool args
  currencyCode: CurrencyCode
  formatPrice: (priceInINR: number) => string
  anchorProductId?: string      // present only on the product-anchored route
}
```

**Validation rules**:
- Every `execute` call is preceded by `argsSchema.safeParse(rawArgs)`; a failed parse returns a
  tool-result string describing the argument problem to the model rather than throwing, so the
  model can retry within the tool-call bound (R9).
- `get_order_status.execute` MUST ignore any argument that resembles a user or customer
  identifier (there is none in its schema — see below) and MUST derive scope solely from
  `ctx.identity`.
- No tool's `execute` performs a write, `INSERT`, `UPDATE`, or `DELETE` — enforced by code review
  and by the fact that none of the four tool implementations import any mutation service (FR-007).

**Tool argument schemas**:

```ts
const SearchCatalogArgs = z.object({
  query: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional(),
  maxPriceInDisplayCurrency: z.number().positive().optional(),
  limit: z.number().int().min(1).max(8).default(6),
})

const GetProductDetailsArgs = z.object({
  productIdsOrNames: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
})

const CompareProductsArgs = z.object({
  terms: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
})

const GetOrderStatusArgs = z.object({
  orderId: z.string().trim().regex(/^[A-Za-z0-9]{7,10}$/).optional(),
})
```

## Entity: RetrievalContext

The bounded set of catalog records assembled for one turn, treated as **untrusted content** once
it enters the prompt (FR-010). Represented as the string returned by each tool's `execute`, which
is:
- Length-bounded (reuses `SUPPLEMENTAL_CONTEXT_MAX_CHARS` / a new `TOOL_RESULT_MAX_CHARS`
  constant per result, mirroring the existing `PRODUCT_CONTEXT_MAX_CHARS` /
  `SUPPLEMENTAL_CONTEXT_MAX_CHARS` truncation discipline in `chat-prompt.ts`).
- Sanitized with the existing `sanitizePromptText`-style normalization before being wrapped as a
  `FunctionResponse` part, so injected instructions inside a product description or review
  cannot alter model behavior (mirrors the current handling of product/review text in
  `buildProductContext` and `fetchReviewSummaryContext`).
- Never includes an exact stock count — every quantity is passed through `toStockLabel` before
  formatting (FR-008, SC-002).
- Excludes soft-deleted and unpublished products at the query layer
  (`isNull(products.deletedAt)`), never filtered after the fact (FR-003).

**Invariant**: A `RetrievalContext` string MUST NOT name a product that was not itself returned
by a tool's own query in that turn — the model is instructed (system prompt) to only reference
products present in the tool results, and product links rendered by the client are built from
the product ids the tool result carries, not free-form model text, so a hallucinated name cannot
resolve to a real link (FR-002, User Story 1 Acceptance Scenario 3).

## Entity: ConversationTurn

One request and response pair. Represented by the existing `ChatMessage` type
(`{ role: 'user' | 'assistant', text: string }` in `chat-types.ts`), unchanged. Persisted only for
authenticated users, under a Redis key that now also encodes the **surface**:

```ts
// Before (product-anchored only):
`ai:chat:history:${userId}:${productId}:${threadId}`

// After (both surfaces):
`ai:chat:history:${userId}:${surface}:${threadId}`
// surface = `product:${productId}` | 'catalog'
```

**Validation rules** (unchanged from today, re-verified against the new surface):
- `persistHistory` is forced `false` whenever `identity.isAuthenticated` is `false` — a guest's
  `ConversationTurn`s are never written to Redis regardless of what the client requests
  (FR-009, `parseAndValidateRequest`'s existing `persistHistory: identity.isAuthenticated && ...`
  line, unchanged).
- TTL remains `CHAT_HISTORY_TTL_SECONDS` (30 days), unchanged.
- `MAX_CONVERSATION_TURNS` (6 user turns) applies identically on both routes.

## Entity: AssistantIdentity

The authenticated user identity, or the one-way hashed guest identity used solely for rate
limiting, quota, and abuse control. Represented by the existing `RequestIdentity` type in
`chat-types.ts`:

```ts
type RequestIdentity = {
  userId: string          // real user id, or `guest:{sha256-hash-prefix}`
  isAuthenticated: boolean
}
```

**Validation rules** (unchanged, reused by both routes via `resolveRequestIdentity`):
- Guest ids are derived via `createHash('sha256')` over a client IP header, truncated to
  `MAX_GUEST_ID_LENGTH` — never the raw IP itself is stored or logged (FR-009, FR-015).
- `AssistantIdentity` is the single source of truth `chat-tools-orders.ts` uses for scoping —
  no tool argument may substitute for it (R6).

## Entity: FallbackChain

The ordered degradation path, not a stored entity but a documented control-flow contract that
both routes and `search_catalog` must implement identically:

1. **Semantic retrieval** — `searchProductIdsCached` (Upstash Search via `src/lib/search/client.ts`,
   60-second Redis cache, 10-second stale window).
2. **Hosted search, uncached** — `searchProductIds` direct call when the cache layer itself is
   unavailable but Upstash is reachable.
3. **Database search** — Drizzle `ilike` query with soft-delete/publish filtering when Upstash is
   unavailable or errors (returns `null` from step 1/2).
4. **Conventional search UI** — when the AI provider itself is unavailable
   (`aiConfig.enabled === false`), both chat routes return `503` and the storefront's existing
   `/shop` search page (unaffected by this feature) remains the shopper's path to discovery
   (FR-013, SC-006).

**Invariant**: Steps 1–3 are internal to `search_catalog`'s implementation and are invisible to
the model — the tool always returns candidate products or an explicit "no catalog product
matches" string (User Story 1 Acceptance Scenario 3), never an error the model must interpret.
Step 4 is enforced entirely at the route-handler level, before any tool is even offered to the
model, exactly as today.

## Cache Key Model (supersedes prior product-only shape)

```ts
type AssistantSurface = `product:${string}` | 'catalog'

function buildAiCacheKey(
  surface: AssistantSurface,
  question: string,
  currencyCode: CurrencyCode
): string {
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ')
  return `ai:response:${surface}:${currencyCode}:${normalized}`
}
```

**Invariant**: `product:{id}` and `catalog` are disjoint key spaces by construction — no
normalized question/currency pair can collide across surfaces (D3 in plan.md).

## State Transitions

None of the entities above have a persisted state machine. `ConversationTurn` sequences are
append-only within a bounded window (`MAX_CONVERSATION_TURNS * 2` messages, trimmed via
`trimMessageHistory`); there is no other stateful transition introduced by this feature.
