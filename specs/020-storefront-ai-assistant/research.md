# Research: Storefront AI Assistant

Each item below resolves a "NEEDS CLARIFICATION" from Technical Context or documents a
best-practice decision. Format: Decision / Rationale / Alternatives considered.

## R1 — Entry point for catalog-wide questions

**Decision**: Add a new global launcher component, `StorefrontAssistant.tsx`, mounted once in
`src/app/layout.tsx` (client boundary, lazily imported the same way `ProductAssistant.tsx`
already is from `ProductClient.tsx`), backed by a new route `POST /api/ai/assistant/chat`. The
existing `ProductAssistant.tsx` and `POST /api/ai/products/[id]/chat` remain unchanged in
surface area — they continue to anchor every question to the product page the shopper is on.

**Rationale**: The spec's baseline is explicit that "one route, one surface" anchored to a
product id is the entire gap (spec.md, Baseline). A shopper who has not yet chosen a product has
literally no way to reach the assistant today. Adding a second, independent surface — rather than
replacing the anchored one — preserves the anchored experience's tighter, product-scoped system
prompt (which is cheaper and more precise for on-page questions) while adding the missing
catalog-wide capability. This directly satisfies User Story 1's acceptance scenarios, which
require the assistant to be reachable and answer with products "from anywhere in the catalog."

**Alternatives considered**:
- *Replace the product route with a single catalog-wide route that takes an optional anchor
  product id.* Rejected: this would force every existing call site (`ProductClient.tsx`) to
  change its request shape and would risk regressing the already-shipped, well-tested anchored
  behavior (including its cache key and history threading) for no functional gain — the same
  four tools are available to both surfaces either way.
- *Embed the catalog-wide assistant only on the `/shop` search results page rather than
  globally.* Rejected: narrower than what User Story 1 asks for ("a shopper who has not yet
  chosen a product" could be on the home page, a category page, or anywhere else), and a global
  launcher is a small, well-understood UI pattern (matches the existing pattern of
  `ServiceWorkerRegistration.tsx` and other global client mounts in the root layout).

## R2 — How the model chooses what to retrieve

**Decision**: Use `@google/genai`'s native function calling (`functionDeclarations` on
`GenerateContentConfig.tools`, `FunctionCall`/`FunctionResponse` parts) with four bounded,
server-defined tools, and a capped tool-calling loop of at most `MAX_TOOL_CALLS_PER_TURN = 3`
calls per conversation turn.

**Rationale**: The baseline explicitly diagnoses the current problem: "ordinary server-side
fetches selected by keyword intent detection, not model-invoked tools... there are no function
declarations, the model cannot choose what to retrieve, and it cannot iterate. Intent
misdetection therefore silently starves the model of context with no recovery path." FR-004
mandates "a bounded set of server-defined tools" the model may invoke, and FR-011 mandates a
bounded tool-calling depth. `@google/genai` v2.10 (already a dependency) supports
`FunctionDeclaration[]` natively (confirmed in its type definitions), so no new dependency is
needed. A hard cap of 3 keeps worst-case latency and token cost bounded and auditable, matching
the existing quota-conscious design (`MAX_CONVERSATION_TURNS`, `MAX_OUTPUT_TOKENS`, etc., all in
`chat-constants.ts`).

**Alternatives considered**:
- *Keep keyword-intent detection but broaden its patterns to catalog-wide queries.* Rejected:
  this is the exact anti-pattern the baseline calls out — misdetection silently starves the model
  of context with no recovery path, and broadening regexes cannot express genuinely open-ended,
  multi-constraint discovery (User Story 2's comparison-with-budget scenarios).
  Model-directed tool calls let the model retry or use a different tool when its first choice is
  unproductive, which is the actual capability gap.
- *Unbounded/agentic tool loop with no cap.* Rejected: violates FR-011 directly and the
  Simplicity/YAGNI principle; also opens an availability/cost risk (a model stuck in a retrieval
  loop could exhaust the token quota on a single turn).

## R3 — Whether the existing product route changes shape

**Decision**: Keep `POST /api/ai/products/[id]/chat`'s request/response contract identical
(same `ChatRequestSchema`, same streaming `text/plain` response, same `X-AI-Thread-ID` header
behavior). Internally, refactor its handler to delegate to the shared `chat-engine.ts`, which now
also exposes the four tools to the model within that product's anchored context.

**Rationale**: `ProductClient.tsx` and `ProductAssistant.tsx` are unchanged consumers; changing
the contract would be a breaking change to a shipped, tested surface for no requirement in the
spec. Giving the anchored route access to the same tool set (in particular `search_catalog` and
`get_product_details`) is a strict superset of its current capability — it can now recommend
products beyond the anchor product when asked, closing part of the baseline's gap #2 without a
new route for that specific case.

**Alternatives considered**:
- *Leave the product route as intent-driven and only build tool-calling into the new catalog
  route.* Rejected: this would mean two different retrieval architectures to maintain and would
  leave the anchored route's comparison/recommendation logic on the fragile keyword-detection
  path that Guardrail Story 4 asks to be uniformly solid across every surface.

## R4 — Cache key shape for catalog-wide answers

**Decision**: Change `buildAiCacheKey` in `src/lib/ai/ai-cache.ts` from
`ai:response:{productId}:{currencyCode}:{normalizedQuestion}` to
`ai:response:{surface}:{currencyCode}:{normalizedQuestion}`, where `surface` is `product:{id}`
for the anchored route and the literal string `catalog` for the new route.

**Rationale**: The baseline flags this precisely: "a key shape that assumes a product anchor and
will need reworking for catalog-wide questions." Reusing `productId` unmodified for the new
route (e.g., an empty string or a sentinel) risks silent collisions between an anchored answer
and a catalog-wide answer that happen to share normalized question text and currency. A named
`surface` dimension keeps the two answer spaces disjoint without needing any new storage
mechanism — same Redis key/value shape, same 1-hour TTL, same `getRedisClient()` graceful
no-op-when-unavailable behavior.

**Alternatives considered**:
- *Use a wildcard/empty product id for the catalog surface (`ai:response::INR:...`).* Rejected:
  fragile — a future refactor could accidentally treat an empty string as "any product," and it
  reads ambiguously in Redis key inspection/debugging.
- *Separate Redis key prefix entirely for the catalog surface
  (`ai:catalog-response:{currencyCode}:{normalizedQuestion}`).* Considered but not chosen: the
  `surface` dimension inside the existing prefix keeps one cache namespace, one TTL constant, and
  one set of cache-operation log statements (`logCacheOperation`) to reason about, which is
  simpler to audit for the stock-privacy and no-history guardrails that already instrument this
  path.

## R5 — Where comparison/recommendation/order-status logic moves

**Decision**: Extract `fetchComparisonContext` and `fetchOrderStatusContext` (with their helper
functions `toStockLabel`, `formatComparableProduct`, `formatOrderStatusLine`,
`extractComparisonTerms`) out of `chat-commerce-context.ts` into `chat-tools-catalog.ts` (for
comparison) and `chat-tools-orders.ts` (for order status), wrapped in a Zod-validated tool
signature. `fetchRecommendationContext`'s budget-filtering logic becomes part of the new
`search_catalog` tool's filter path (category + budget constraint), since User Story 2's
budget-constrained recommendation and User Story 1's catalog search are both "find matching
products under constraints" at the query level. `chat-commerce-context.ts` keeps the
delivery-info and review-summary sections as static, non-tool context appended to the anchored
route's system prompt (they are cheap, always-relevant-to-the-anchor-product context, not
retrieval decisions the model needs to make).

**Rationale**: These functions are already correct and already enforce the qualitative-stock
guardrail (`toStockLabel`) and the soft-delete/unpublished exclusion (`isNull(products.deletedAt)`
in every query). Moving their *call site* from a keyword regex to a tool dispatch changes nothing
about their SQL or their output formatting, which is the lowest-risk path to closing baseline gap
#2 ("retrieval is keyword-triggered and server-chosen rather than model-directed").

**Alternatives considered**:
- *Leave `chat-commerce-context.ts` untouched and add a parallel, duplicate set of tool
  implementations.* Rejected: violates Principle VIII (DRY) — the exact same Drizzle queries
  would exist in two places and a future guardrail fix (e.g., a new soft-delete condition) could
  be applied to one copy and not the other.

## R6 — Order lookup authorization boundary

**Decision**: `get_order_status`'s tool input schema has no user-identifying field. The
`chat-tools-orders.ts` dispatcher receives the authenticated session `userId` (or "not
authenticated") from `chat-engine.ts` — never from the model's tool call arguments — and either
runs `fetchOrderStatusContext(userId, ...)` scoped to that session's orders, or returns a
"sign in to check your orders" message without touching the database at all when the caller is a
guest.

**Rationale**: FR-006 requires order-data tools to be "available only to authenticated sessions"
and to "scope every query by the server-side session user identity." This is exactly what
`fetchOrderStatusSection` already does today (baseline confirms User Story 3 is "a
hardening-and-extension story, not a greenfield one"). Keeping the authorization check at the
dispatcher, structurally outside the Zod-validated argument shape, means there is no possible
malicious or malformed tool-call argument that could route a query to another user's orders —
the identity is simply not on the argument surface the model controls.

**Alternatives considered**:
- *Accept a `userId` argument in the tool schema and validate it matches the session at
  dispatch time.* Rejected: adds an attack surface (a check that could be missed or weakened in
  a future edit) for no benefit — the server already knows the session identity and never needs
  the model to supply it.

## R7 — Retrieval fallback chain for `search_catalog`

**Decision**: `search_catalog` calls `searchProductIdsCached` first (Upstash Search, 60-second
Redis cache with a 10-second stale window), and if that returns `null` (Upstash unavailable or
failing), falls through to a direct Drizzle query (`ilike` on name/description, optionally
filtered by category and budget) — the same two-tier pattern `product-search.ts` already
implements for the rest of the storefront's search.

**Rationale**: FR-012 requires semantic retrieval to fall back to Upstash Search and then to
database search when unavailable. Reusing the exact fallback chain already proven in
`src/lib/search/product-search.ts` avoids introducing a second, subtly different fallback
implementation for the AI assistant, and keeps the two search experiences (conventional `/shop`
search and assistant-driven search) consistent with each other, which is also what the "does not
replace the existing search experience; the assistant complements it" out-of-scope note implies.

**Alternatives considered**:
- *Build a bespoke semantic-only retrieval path for the assistant with no DB fallback.*
  Rejected: directly violates FR-012 and the edge case "the AI provider unavailable... must
  degrade to conventional search rather than erroring the page" — the DB fallback is what makes
  that degradation possible at the retrieval layer, one level below the AI-provider-unavailable
  check that already exists in the route handlers.

## R8 — Rate limiting and quota reuse for the new route

**Decision**: No changes to `src/proxy.ts`. `AI_RATE_LIMIT_PATHS = ['/api/ai']` already matches
`/api/ai/assistant/chat` by `pathname.startsWith(aiPrefix)`, so the existing strict Upstash
limiter (and its in-memory fallback when Redis is unavailable) applies automatically. Daily
request/token/advanced-feature quotas in `chat-usage.ts` are already keyed by `userId` (session
id or hashed guest id), not by route or product, so they apply identically and cumulatively
across both surfaces with zero code changes.

**Rationale**: FR-014 requires the existing strict rate limiting on `/api/ai` to apply to all new
assistant surfaces. Verifying the existing prefix-match logic already covers the new path (rather
than assuming it needs a new entry) avoids an unnecessary change to a shared security-relevant
file, and confirms the daily quota model already spans surfaces per shopper rather than per
route — exactly what prevents a shopper from doubling their effective quota by using both
surfaces.

**Alternatives considered**: None — this is a verification of existing behavior, not a design
choice with real alternatives.

## R9 — Tool-calling loop bound and degradation behavior

**Decision**: `chat-engine.ts` tracks a per-turn tool-call counter. After each model turn that
returns one or more `FunctionCall`s, the engine executes them (Zod-validated, dispatched to the
matching tool module) and feeds `FunctionResponse` parts back to the model for its next turn,
incrementing the counter by the number of calls executed. If the model requests further tool
calls once the counter has reached `MAX_TOOL_CALLS_PER_TURN` (3, overridable via
`aiConfig.maxToolCallsPerTurn` through Edge Config, matching the existing quota-override pattern
in `AiConfig`), the engine sets `functionCallingConfig.mode` to disallow further calls on the
final request so the model must answer using only the tool results already gathered.

**Rationale**: FR-011 requires tool-calling depth to be bounded. Ending the turn with a "best
answer from what was retrieved so far" rather than an error keeps SC-001's discovery experience
resilient — a shopper still gets a useful answer even if the model's exploration strategy would
otherwise have wanted a 4th lookup.

**Alternatives considered**:
- *Hard-error the turn once the bound is hit.* Rejected: turns a soft over-exploration into a
  visible failure for the shopper, worse than simply asking for a final answer with what is
  already known.

## R10 — Model configuration and Edge Config integration

**Decision**: `getAiConfigCached()`/`buildGenerateConfig()` in `src/lib/ai/gateway.ts` gain one
new optional parameter path: `buildGenerateConfig` accepts a `tools: FunctionDeclaration[]`
argument that both routes pass (built by `chat-tools.ts`'s declaration builder). No new Edge
Config keys are introduced beyond an optional `maxToolCallsPerTurn` override on the existing
`AiConfig` interface, following the same "hardcoded default when Edge Config unavailable"
discipline the constitution mandates.

**Rationale**: FR-016 requires model configuration to remain Edge-Config-driven with hardcoded
defaults. Reusing the existing `AiConfig` shape and its cached-read pattern
(`getAiConfigCached`, 60-second in-process TTL) avoids introducing a second configuration path.

**Alternatives considered**: None material — this is additive to the existing configuration
surface, not a redesign.

## R11 — Cart awareness

**Decision**: Out of scope for this feature. The bounded tool set in FR-004 is catalog search,
filtering, comparison, and authenticated order lookup — no cart tool. The assistant remains
strictly read-only per FR-007 and the Out of Scope section ("Assistant-initiated mutations such
as adding to cart... " are explicitly excluded), and a *read* of cart contents is not requested
by any user story or functional requirement.

**Rationale**: The baseline names "no cart awareness" as part of "the gap, restated precisely,"
but the Functional Requirements and User Stories that follow it do not include a cart-reading
tool or a cart-related acceptance scenario. Building one now would be speculative scope beyond
what is specified (Principle VII, YAGNI) and beyond what `/speckit.plan` should introduce without
a spec change.

**Alternatives considered**:
- *Add a read-only `get_cart_contents` tool anyway, reasoning it is implied by "the gap."*
  Rejected: no acceptance scenario or functional requirement calls for it; adding unspecified
  scope during planning risks scope creep the constitution explicitly warns against.
