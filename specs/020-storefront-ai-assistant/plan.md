# Implementation Plan: Storefront AI Assistant

**Branch**: `020-storefront-ai-assistant` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-storefront-ai-assistant/spec.md`

## Summary

Promote the existing single-product AI chat into a catalog-wide assistant without discarding
anything that already ships. The current `POST /api/ai/products/[id]/chat` route and
`ProductAssistant.tsx` surface stay in place — they are the anchored-context mode of the
assistant. A new, product-independent entry point is added: `POST /api/ai/assistant/chat`,
reachable from a global launcher (`StorefrontAssistant.tsx`) mounted once in the root layout, so
a shopper who has not opened a product page can still reach the assistant.

Both routes are rebuilt on top of one shared **tool-calling engine**
(`chat-engine.ts` + `chat-tools*.ts`) instead of the current server-side, keyword-triggered
context assembly in `chat-commerce-context.ts`. The model is given four bounded, Zod-validated,
server-executed tools — `search_catalog`, `get_product_details`, `compare_products`, and
`get_order_status` (authenticated sessions only) — and a capped tool-calling loop
(`MAX_TOOL_CALLS_PER_TURN = 3`) so retrieval becomes model-directed rather than
intent-regex-triggered. `search_catalog` and `get_product_details` are new; `compare_products`
and `get_order_status` are the existing `fetchComparisonContext` / `fetchOrderStatusContext`
logic promoted from ad-hoc keyword-selected context to explicit, model-invocable tools with the
same server-side scoping rules (order lookups are always scoped by session identity, never a
model-supplied identifier).

Every guardrail already shipped is carried forward unchanged and re-verified against the new
surface: guest identity stays one-way hashed and unpersisted, stock is only ever disclosed
qualitatively (`toStockLabel`), prompt/output sanitization is unchanged, quotas
(`DAILY_REQUEST_QUOTA`, `DAILY_TOKEN_QUOTA`, `ADVANCED_DAILY_REQUEST_QUOTA`) apply identically to
both routes keyed by the same identity, and the strict `/api/ai` rate limiter in `src/proxy.ts`
already matches both paths by prefix with no changes needed. The response cache key
(`src/lib/ai/ai-cache.ts`) is reworked to be scoped by **surface** (`product:{id}` or `catalog`)
instead of assuming a product id, which is the one currently-broken invariant a catalog-wide
question would otherwise violate.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 22 serverless runtime
**Primary Dependencies**: Next.js 16.3 (App Router, Cache Components), React 19.2, `@google/genai` 2.10 (function calling / `functionDeclarations`), Drizzle ORM 0.45, Zod 4.4, NextAuth v5, Redux Toolkit 2.12
**Storage**: PostgreSQL (Neon Serverless) via Drizzle for products/orders/reviews; Redis for AI response cache, chat history, and daily usage quotas (`src/lib/redis.ts`); Upstash Search for semantic catalog retrieval with DB fallback (`src/lib/search/`)
**Testing**: Vitest 4.1 + jsdom + React Testing Library for tool/engine unit tests; Playwright 1.62 for the extended `ai-stock-privacy.spec.ts` and new catalog-assistant coverage
**Target Platform**: Serverless on-demand functions (Vercel)
**Project Type**: Web application — Next.js App Router monolith under `src/`
**Performance Goals**: Streamed first token unaffected by tool calls that resolve before the model's final turn; tool loop bounded so a request never issues more than 3 server-side tool calls; total per-turn cost (input + output tokens) stays within the existing `DAILY_TOKEN_QUOTA` envelope
**Constraints**: No route segment config (`dynamic`/`revalidate`/`runtime`) — Cache Components is enabled; no Redis read inside a `"use cache"` scope (both AI routes are plain Route Handlers, not `"use cache"` scopes, so this does not directly apply, but no new code may introduce such nesting); every tool argument validated with Zod before execution; order-data tools scoped only by server-side session identity; stock disclosure remains qualitative only; guest conversations never persisted
**Scale/Scope**: 1 new API route, 1 new global client component, 1 shared tool-calling engine module, 4 tool implementations (2 new, 2 promoted from existing keyword-triggered functions), 1 cache-key rework, 1 Playwright spec extension, 2 doc updates (`docs/features.md`, `docs/architecture.md`)

**Resolved unknowns** (detail in [research.md](./research.md)):

| Unknown                                       | Resolution                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry point for catalog-wide questions          | New global launcher `StorefrontAssistant.tsx` in the root layout + new route `/api/ai/assistant/chat`                                                    |
| How the model chooses what to retrieve          | `@google/genai` function calling with 4 bounded tools and a capped tool-calling loop (≤3 calls/turn)                                                     |
| Whether the existing product route is replaced  | No — kept as the anchored-context mode, refactored onto the same shared engine                                                                            |
| Cache key shape for catalog-wide answers        | `ai:response:{surface}:{currencyCode}:{normalizedQuestion}` where `surface` is `product:{id}` or `catalog`                                                |
| Cart awareness                                  | Explicitly out of scope — FR-004's bounded tool set has no cart tool, and the feature is read-only                                                        |
| Where comparison/recommendation logic moves     | Promoted from `chat-commerce-context.ts` keyword dispatch into `compare_products` / `search_catalog` tools; same DB queries and stock-qualitative formatting reused, not rewritten |
| Order lookup authorization                      | Unchanged: `get_order_status` tool takes no user-identifying argument; the dispatcher injects the session `userId` server-side, matching `fetchOrderStatusContext`'s existing contract |
| Retrieval fallback chain                        | Unchanged: `searchProductIdsCached` (Upstash, 60s cache) → `searchProductIds` (Upstash uncached) → Drizzle `ilike`/category query → conventional `/shop` search UI when the AI provider itself is unavailable |
| Rate limiting for the new route                 | No change needed — `AI_RATE_LIMIT_PATHS = ['/api/ai']` in `src/proxy.ts` already matches any path under `/api/ai` by prefix                               |
| Tool-loop bound                                 | `MAX_TOOL_CALLS_PER_TURN = 3` in `chat-constants.ts`, enforced in `chat-engine.ts`; exceeding it ends the turn with the best answer assembled from tool results gathered so far |

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                              | Assessment                                                                                                                                                                                                                                                       | Status |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Server-First Rendering               | `StorefrontAssistant.tsx` is `'use client'` (interactive chat), lazily imported the same way `ProductAssistant.tsx` already is; the root layout mounts it as a small client boundary alongside server-rendered content — no server logic moves to the client.    | PASS   |
| II. Type Safety End-to-End              | Every tool has a Zod schema in `chat-tools.ts`; tool arguments are parsed with `.safeParse` before any DB or search call executes; no raw SQL — all tool implementations use Drizzle's typed query builder, matching the existing commerce-context module.       | PASS   |
| III. Testing Discipline                 | New Vitest coverage for `chat-tools*.ts` (Zod validation, authorization boundary, stock-qualitative output) and `chat-engine.ts` (tool-loop bound, cache-key scoping); `ai-stock-privacy.spec.ts` extended to the catalog surface per FR-017.                     | PASS   |
| IV. Serverless & Caching Architecture   | Both AI routes remain plain Route Handlers using `waitUntil` for background cache/history/usage writes — no `"use cache"` scope is introduced or touched; Redis reads/writes are unchanged in shape, only the cache key composition changes.                    | PASS   |
| V. Security by Default                  | `get_order_status` never accepts a user- or order-owner identifier from the model or the conversation; the dispatcher injects the authenticated session `userId` exactly as `fetchOrderStatusContext` does today. Guests get a "sign in" string, not data.       | PASS   |
| VI. Observability & Structured Logging  | Both routes keep structured logging via `logBusinessEvent`/`logError`; a new `ai_chat_tool_call` business event logs tool name, call count, and success/failure — never raw arguments containing user content.                                                  | PASS   |
| VII. Simplicity & YAGNI                 | No new persistence beyond the existing Redis history/cache/usage keys; no cart tool; no new database tables; the tool loop is a small bounded state machine, not a general agent framework.                                                                     | PASS   |
| VIII. DRY Shared Utilities              | `chat-engine.ts` is shared by both routes so the anchored and catalog-wide paths do not duplicate quota, cache, history, sanitization, or streaming logic; `AssistantMarkdown.tsx` moves to `src/features/ai/components/` and both surfaces import the one copy. | PASS   |

**Post-Phase-1 re-check**: PASS. Design work in Phase 1 confirmed the tool dispatcher can reuse
the existing Drizzle queries in `chat-commerce-context.ts` verbatim (only their call site moves
from intent-regex dispatch to tool-invocation dispatch), so no new query logic and no schema
changes were introduced.

## Project Structure

### Documentation (this feature)

```text
specs/020-storefront-ai-assistant/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── assistant-chat-api.md   # New catalog-wide route
│   └── product-chat-api.md     # Refactored anchored route (behavioral contract, same shape)
└── tasks.md              # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                                   # MODIFY — mount <StorefrontAssistant /> globally
│   └── api/ai/
│       ├── products/[id]/chat/route.ts              # MODIFY — refactor onto chat-engine.ts
│       └── assistant/chat/route.ts                  # NEW — catalog-wide, no product anchor
├── features/ai/
│   ├── components/
│   │   ├── StorefrontAssistant.tsx                  # NEW — 'use client', global launcher + panel
│   │   └── AssistantMarkdown.tsx                     # MOVED from features/product/components
│   └── services/
│       ├── chat-constants.ts                         # MODIFY — add MAX_TOOL_CALLS_PER_TURN, CATALOG_SEARCH_MAX_RESULTS
│       ├── chat-types.ts                             # MODIFY — tool result / surface types
│       ├── chat-request.ts                           # MODIFY — productId becomes optional
│       ├── chat-prompt.ts                            # MODIFY — add buildCatalogSystemPrompt + tool-result formatting
│       ├── chat-history.ts                           # MODIFY — thread key includes surface, not just productId
│       ├── chat-usage.ts                              # UNCHANGED — already identity-keyed, not surface-keyed
│       ├── chat-intent.ts                             # MODIFY — retains detectBlockedPrompt/jailbreak checks; comparison/recommendation/order-status keyword detectors superseded by tool calls but kept as an advanced-quota trigger heuristic
│       ├── chat-commerce-context.ts                  # MODIFY — comparison/recommendation/order-status functions extracted into chat-tools-catalog.ts / chat-tools-orders.ts; module kept for delivery-info + review-summary sections used as static context on the anchored route
│       ├── chat-tools.ts                              # NEW — Zod schemas, FunctionDeclaration[] builder, tool dispatcher
│       ├── chat-tools-catalog.ts                      # NEW — search_catalog, get_product_details, compare_products
│       ├── chat-tools-orders.ts                       # NEW — get_order_status (session-scoped)
│       ├── chat-engine.ts                             # NEW — shared turn orchestration: quota, cache, tool loop, streaming, history persistence (extracted from route.ts, used by both routes)
│       ├── chat-cached-answer.ts                      # MODIFY — surface-aware cache key
│       └── chat-stream.ts                              # MODIFY — surface-aware cache key on background write
├── lib/ai/
│   ├── ai-cache.ts                                    # MODIFY — buildAiCacheKey(surface, question, currencyCode)
│   ├── gateway.ts                                     # MODIFY — buildGenerateConfig accepts tools: FunctionDeclaration[]
│   └── product-rag.ts                                 # UNCHANGED
└── lib/edge-config.ts                                 # MODIFY — optional AiConfig.maxToolCallsPerTurn override, default from constant

__tests__/features/ai/services/
├── chat-tools-catalog.test.ts                          # NEW
├── chat-tools-orders.test.ts                           # NEW — authorization boundary, no cross-user leakage
├── chat-engine.test.ts                                 # NEW — tool-loop bound, cache-key scoping
└── chat-cached-answer.test.ts                          # MODIFY — surface-scoped key assertions

playwright-tests/
└── ai-stock-privacy.spec.ts                            # MODIFY — extend to /api/ai/assistant/chat and StorefrontAssistant surface (FR-017)

docs/
├── features.md                                          # MODIFY — document catalog-wide assistant, tool set (FR-018)
└── architecture.md                                      # MODIFY — document tool-calling engine, authorization model, fallback chain (FR-018)
```

**Structure Decision**: The feature stays inside the existing `src/features/ai/` module rather
than spreading tool logic across `product` and a new module. The anchored (`product/[id]/chat`)
and catalog-wide (`assistant/chat`) routes share one engine so quota, cache, sanitization, and
history logic are written once — duplicating them across two routes would violate Principle
VIII and would double the surface area that guardrail regressions could hide in. The one
UI-level extraction (`AssistantMarkdown.tsx` moving to `src/features/ai/components/`) reflects
that markdown rendering is now shared by two chat surfaces, not owned by `product` alone;
`ProductAssistant.tsx` is updated to import it from its new location.

## Key Design Decisions

### D1 — Tool calling replaces keyword-triggered context assembly, not the underlying queries

The existing `fetchComparisonContext`, `fetchRecommendationContext`, and
`fetchOrderStatusContext` functions already contain the correct, tested Drizzle queries and
qualitative-stock formatting. Rewriting their query logic would be pure risk with no benefit, so
`compare_products` and `get_order_status` tools call the same query logic, unchanged, only moving
the *decision of when to call them* from a keyword-intent regex to the model's function-calling
decision. `search_catalog` and `get_product_details` are the two genuinely new tools, built on
the existing `searchProductIdsCached` / `searchProducts` fallback chain and a straightforward
Drizzle product lookup respectively — no new indexing or retrieval infrastructure is required.

### D2 — One engine, two thin route handlers

`chat-engine.ts` owns: quota enforcement, the single-turn cache lookup/write, the bounded tool
loop, streaming, and history persistence. `products/[id]/chat/route.ts` and
`assistant/chat/route.ts` become thin adapters that resolve their own system-prompt anchor (a
specific product vs. none) and call the shared engine — this is what lets both surfaces inherit
every guardrail automatically instead of re-implementing them, and is the direct answer to User
Story 4's "guardrails hold on every new surface" requirement.

### D3 — Cache key gains a surface dimension instead of a product dimension

`ai:response:{productId}:{currencyCode}:{normalizedQuestion}` assumed every single-turn answer
is anchored to one product. The catalog-wide route has no product id, and a catalog-wide
question and a product-anchored question with identical text must not collide. The key becomes
`ai:response:{surface}:{currencyCode}:{normalizedQuestion}` where `surface` is `product:{id}` for
the anchored route and the literal string `catalog` for the new route. This is a pure key-shape
change; TTL, storage, and invalidation semantics are unchanged, and pre-existing cache entries
simply age out under the 1-hour TTL rather than requiring a migration.

### D4 — Order-status tool authorization is enforced at the dispatcher, not the schema

`get_order_status`'s Zod input schema intentionally has **no** user-identifying field (only an
optional order-id string, matching the existing `ORDER_ID_PATTERN` extraction). The dispatcher
in `chat-tools-orders.ts` receives the authenticated session identity out-of-band from
`chat-engine.ts` (never from tool arguments) and refuses to run the tool at all — returning a
"sign in to check your orders" string, not an error the model could try to route around — when
the identity is a guest. This mirrors `fetchOrderStatusSection`'s current behavior exactly and
keeps the ownership check un-bypassable by construction: there is no argument path that could
carry another user's id into the query.

### D5 — Tool-calling loop bound and degradation

`chat-engine.ts` executes at most `MAX_TOOL_CALLS_PER_TURN` (3) tool calls per turn. If the model
requests a 4th call, the engine stops issuing calls and asks the model for a final answer using
whatever tool results have already been gathered, rather than erroring — an unresolvable request
degrades to "here is what I found" instead of a failed turn. If the AI provider itself is
unavailable (`aiConfig.enabled === false`, matching the existing check), both routes already
return a `503` and the storefront's existing conventional search remains fully usable, satisfying
FR-013 without new fallback code.

## Complexity Tracking

> Filled only where the Constitution Check surfaced a justified deviation.

No unjustified violations. The one structural addition beyond a minimal reading of the spec —
extracting `chat-engine.ts` as a shared module rather than adding tool-calling directly inline in
each route — is required by Principle VIII (duplicating quota/cache/sanitization/streaming logic
across two routes is exactly the three-plus-file duplication the constitution requires
extracting) and is not tracked as a deviation.

## Phase Status

- [x] Phase 0 — research complete ([research.md](./research.md))
- [x] Phase 1 — data model, contracts, quickstart generated
- [ ] Phase 2 — task breakdown (`tasks.md` — run `/speckit.tasks`)
- [ ] Phase 3 — implementation (run `/speckit.implement`)
