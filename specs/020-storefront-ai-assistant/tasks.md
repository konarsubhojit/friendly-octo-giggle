# Tasks: Storefront AI Assistant

**Input**: Design documents from `/specs/020-storefront-ai-assistant/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included — the plan's Constitution Check (Principle III) and FR-005/FR-006/FR-017 require Vitest coverage for tool validation/authorization and an extended Playwright privacy suite. Per-story test tasks are written first and must fail before their implementation tasks.

**Organization**: Tasks are grouped by user story (US1–US4, matching spec.md priorities) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every description

## Path Conventions

Single Next.js App Router project rooted at `src/`, with tests under `__tests__/` (Vitest) and `playwright-tests/` (Playwright), matching plan.md's Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared modules and constants that every subsequent phase edits, without yet changing behavior.

- [ ] T001 Add `MAX_TOOL_CALLS_PER_TURN = 3`, `TOOL_RESULT_MAX_CHARS`, and `CATALOG_SEARCH_MAX_RESULTS` constants to `src/features/ai/services/chat-constants.ts`
- [ ] T002 [P] Add `maxToolCallsPerTurn?: number` to the `AiConfig` interface and its parsing/defaulting logic in `src/lib/edge-config.ts` (default from `MAX_TOOL_CALLS_PER_TURN`, per R10)
- [ ] T003 [P] Extend `chat-types.ts` in `src/features/ai/services/chat-types.ts` with `AssistantSurface` (`` `product:${string}` | 'catalog' ``), `AssistantToolName`, `AssistantTool<Args>`, and `ToolExecutionContext` types per data-model.md
- [ ] T004 Move `src/features/product/components/AssistantMarkdown.tsx` to `src/features/ai/components/AssistantMarkdown.tsx` and update its one existing import in `src/features/product/components/ProductAssistant.tsx`

**Checkpoint**: Shared types/constants exist; no behavioral change yet; app still builds and existing tests still pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the tool-calling engine, cache-key rework, and tool declaration/dispatch plumbing that every user story's tools plug into. **No user story tool can be exposed to the model until this phase is complete.**

**⚠️ CRITICAL**: This phase must fully complete before Phase 3 (US1) begins, because US1's `search_catalog`/`get_product_details` tools and the shared engine loop are foundational to every other story.

- [ ] T005 Rework `buildAiCacheKey` in `src/lib/ai/ai-cache.ts` to accept `(surface: AssistantSurface, question: string, currencyCode: CurrencyCode)` and produce `ai:response:{surface}:{currencyCode}:{normalizedQuestion}` per data-model.md's Cache Key Model (D3); update all existing call sites
- [ ] T006 Update `src/features/ai/services/chat-cached-answer.ts` to pass a resolved `AssistantSurface` (not a bare product id) into `buildAiCacheKey`
- [ ] T007 Update `src/features/ai/services/chat-stream.ts`'s background cache-write call to use the same surface-scoped `buildAiCacheKey`
- [ ] T008 Update `src/features/ai/services/chat-history.ts` so the Redis history key becomes `ai:chat:history:{userId}:{surface}:{threadId}` instead of `ai:chat:history:{userId}:{productId}:{threadId}`, accepting `surface: AssistantSurface` as a parameter
- [ ] T009 Update `src/features/ai/services/chat-request.ts` so `productId` becomes optional in the parsed request and the resolved `AssistantSurface` is computed (`` `product:${productId}` `` when present, else `'catalog'`)
- [ ] T010 Create `src/features/ai/services/chat-tools.ts`: the `AssistantTool<Args>` registry, a `buildFunctionDeclarations()` helper producing `FunctionDeclaration[]` for `@google/genai`, and a `dispatchToolCall(name, rawArgs, ctx)` function that looks up the matching tool, runs `argsSchema.safeParse`, and returns a prompt-ready string (never throws) per data-model.md's AssistantTool validation rules
- [ ] T011 Update `src/lib/ai/gateway.ts`'s `buildGenerateConfig` to accept an optional `tools: FunctionDeclaration[]` argument and an optional `functionCallingConfig.mode` override (for the tool-loop cutoff in T014), per R10
- [ ] T012 Create `src/features/ai/services/chat-engine.ts`: extract the shared turn-orchestration logic (identity resolution, currency resolution, history load/merge, `detectBlockedPrompt` check, `aiConfig.enabled` check, quota enforcement, single-turn cache lookup) out of the current `src/app/api/ai/products/[id]/chat/route.ts`, parameterized by `surface: AssistantSurface` and an optional `anchorProductId`
- [ ] T013 [P] Add `ai_chat_tool_call` business event logging (tool name, call count, success/failure — never raw arguments) alongside the existing `ai_chat_request`/`ai_chat_usage` events, in `src/features/ai/services/chat-engine.ts`
- [ ] T014 Implement the bounded tool-calling loop in `src/features/ai/services/chat-engine.ts`: after each model turn returning `FunctionCall`s, dispatch via `dispatchToolCall`, feed `FunctionResponse` parts back, increment a per-turn counter, and once `MAX_TOOL_CALLS_PER_TURN` (or `aiConfig.maxToolCallsPerTurn`) is reached, set `functionCallingConfig.mode` to disallow further calls so the model must answer from gathered results (R9)
- [ ] T015 [P] Add Vitest coverage for the tool-loop bound and cache-key scoping in `__tests__/features/ai/services/chat-engine.test.ts` (asserts the loop stops at the configured max and that `product:{id}` vs `catalog` surfaces never collide)
- [ ] T016 [P] Update `__tests__/features/ai/services/chat-cached-answer.test.ts` with surface-scoped key assertions (product surface vs. catalog surface producing disjoint keys for identical question/currency)

**Checkpoint**: Shared engine, tool registry/dispatcher, and surface-scoped cache/history exist and are unit-tested. No route uses them yet — safe to proceed to user stories in parallel.

---

## Phase 3: User Story 1 - Catalog-wide product discovery (Priority: P1) 🎯 MVP

**Goal**: A shopper who has not chosen a product can describe what they want in natural language and get real, in-catalog, purchasable product recommendations with links, from anywhere in the storefront.

**Independent Test**: Ask a natural-language, multi-category question via the new global assistant and confirm the answer cites real, in-catalog, purchasable products with working links — or explicitly states no match exists, in the shopper's selected currency.

### Tests for User Story 1 ⚠️

- [ ] T017 [P] [US1] Vitest coverage for `search_catalog` and `get_product_details` Zod schemas and dispatch in `__tests__/features/ai/services/chat-tools-catalog.test.ts`: validates argument bounds (query length, `limit` 1–8, `productIdsOrNames` 1–4), excludes soft-deleted/unpublished products, and never returns a numeric stock count
- [ ] T018 [P] [US1] Contract test for `POST /api/ai/assistant/chat` in `__tests__/app/api/ai/assistant-chat.test.ts`: asserts request validation (min 1 message, `MAX_INPUT_MESSAGE_CHARS`), the streamed `text/plain` response shape, and the cached-answer JSON shape from contracts/assistant-chat-api.md

### Implementation for User Story 1

- [ ] T019 [P] [US1] Define `SearchCatalogArgs` and `GetProductDetailsArgs` Zod schemas in `src/features/ai/services/chat-tools-catalog.ts` per data-model.md
- [ ] T020 [US1] Implement the `search_catalog` tool in `src/features/ai/services/chat-tools-catalog.ts`, calling `searchProductIdsCached` (Upstash, 60s cache) → `searchProductIds` (uncached) → Drizzle `ilike` fallback with `isNull(products.deletedAt)` and published-only filtering, applying `category`/`maxPriceInDisplayCurrency`/`limit` constraints, per the FallbackChain in data-model.md and R7
- [ ] T021 [US1] Implement the `get_product_details` tool in `src/features/ai/services/chat-tools-catalog.ts`: Drizzle lookup by id or fuzzy name match, formatting price in the shopper's currency and stock via `toStockLabel` (reused from `chat-commerce-context.ts`), truncated to `TOOL_RESULT_MAX_CHARS`
- [ ] T022 [US1] Register `search_catalog` and `get_product_details` in the tool registry (`buildFunctionDeclarations`/`dispatchToolCall`) in `src/features/ai/services/chat-tools.ts`
- [ ] T023 [US1] Create `buildCatalogSystemPrompt()` in `src/features/ai/services/chat-prompt.ts`: instructs the model to use only tool-returned products, to state explicitly when no catalog product matches (never fabricate), and to render prices in the shopper's currency
- [ ] T024 [US1] Create `src/app/api/ai/assistant/chat/route.ts`: new `POST` Route Handler with no product anchor, calling `chat-engine.ts` with `surface: 'catalog'`, offering all currently-registered tools (at this point `search_catalog`/`get_product_details`), returning `503` when `aiConfig.enabled === false` (FR-013) and the same status codes as the existing anchored route
- [ ] T025 [US1] Create `src/features/ai/components/StorefrontAssistant.tsx`: `'use client'` global launcher + panel component, lazily imported the same way `ProductAssistant.tsx` already is, posting to `/api/ai/assistant/chat` and rendering streamed responses via the shared `AssistantMarkdown.tsx`
- [ ] T026 [US1] Mount `<StorefrontAssistant />` once in `src/app/layout.tsx` as a small client boundary alongside existing server-rendered content
- [ ] T027 [US1] Ensure product links in `StorefrontAssistant.tsx` are built from tool-result product ids (not free-form model text), so a hallucinated name cannot resolve to a real link (FR-002, data-model.md RetrievalContext invariant)

**Checkpoint**: User Story 1 is fully functional and independently testable — a shopper can reach the assistant from anywhere in the storefront and get grounded, linked, currency-correct catalog recommendations.

---

## Phase 4: User Story 2 - Comparison and constrained recommendation (Priority: P2)

**Goal**: A shopper can ask the assistant to compare two named products or to recommend within a budget/category constraint, using accurate catalog attributes and qualitative-only stock language.

**Independent Test**: Ask for a comparison of two named products and a budget-constrained recommendation on either surface, and confirm both answers use accurate catalog attributes, real prices in the shopper's currency, and qualitative (non-numeric) stock language.

### Tests for User Story 2 ⚠️

- [ ] T028 [P] [US2] Vitest coverage for `compare_products` in `__tests__/features/ai/services/chat-tools-catalog.test.ts` (extend from T017): asserts comparisons use real retrieved attributes, budget filtering excludes non-matching products, and stock is always qualitative
- [ ] T029 [P] [US2] Extend `playwright-tests/ai-stock-privacy.spec.ts` (or a new spec file referenced from it) with a case asserting no numeric stock count appears in a comparison or budget-recommendation response on `/api/ai/assistant/chat`

### Implementation for User Story 2

- [ ] T030 [US2] Define `CompareProductsArgs` Zod schema in `src/features/ai/services/chat-tools-catalog.ts` per data-model.md
- [ ] T031 [US2] Extract `fetchComparisonContext`, `formatComparableProduct`, and `extractComparisonTerms` from `src/features/ai/services/chat-commerce-context.ts` into `src/features/ai/services/chat-tools-catalog.ts`, wrapped as the `compare_products` tool (same Drizzle queries and `toStockLabel` formatting, unchanged per R5/D1)
- [ ] T032 [US2] Fold `fetchRecommendationContext`'s budget/category filtering logic into `search_catalog`'s query path in `src/features/ai/services/chat-tools-catalog.ts` (constraint-based recommendation is "find matching products under constraints" at the query level, per R5), including the "no product satisfies the constraint" explicit-statement case and labelled nearest-alternatives per spec Acceptance Scenario 3
- [ ] T033 [US2] Register `compare_products` in the tool registry (`buildFunctionDeclarations`/`dispatchToolCall`) in `src/features/ai/services/chat-tools.ts`
- [ ] T034 [US2] Update `buildCatalogSystemPrompt()` (and the anchored route's system-prompt assembly) in `src/features/ai/services/chat-prompt.ts` to instruct the model on comparison/constraint phrasing: real attributes only, qualitative stock only, explicit no-match statement, labelled alternatives
- [ ] T035 [US2] Remove the now-superseded comparison/recommendation keyword-dispatch branches from `src/features/ai/services/chat-commerce-context.ts`, retaining only delivery-info and review-summary static context per R5 (`chat-commerce-context.ts` keeps its module for the anchored route's static sections)
- [ ] T036 [US2] Retain `detectIntentSignals`'s comparison/recommendation detectors in `src/features/ai/services/chat-intent.ts` solely as the advanced-quota trigger heuristic (per plan.md's Project Structure note for `chat-intent.ts`), removing their use as a context-selection gate

**Checkpoint**: User Stories 1 AND 2 both work independently — catalog discovery and comparison/constrained recommendation are both model-directed and tool-grounded.

---

## Phase 5: User Story 3 - Order questions for authenticated shoppers only (Priority: P2)

**Goal**: A signed-in shopper can ask about their own orders and get an accurate answer; a guest — or a shopper referencing another user's order — gets no order data under any phrasing.

**Independent Test**: As a signed-in user, ask about your most recent order and confirm the answer matches the record. Repeat as a guest and as a different user, and confirm no order data is disclosed in either case.

### Tests for User Story 3 ⚠️

- [ ] T037 [P] [US3] Vitest coverage in `__tests__/features/ai/services/chat-tools-orders.test.ts`: asserts `get_order_status` derives scope solely from `ctx.identity` (never from tool arguments), returns a "sign in" string with zero DB calls for unauthenticated identities, and returns "not found for this account" — never another user's data — when an `orderId` argument belongs to a different user
- [ ] T038 [P] [US3] Extend `playwright-tests/ai-stock-privacy.spec.ts` with authenticated/guest/cross-user order-question scenarios against `/api/ai/assistant/chat`, per quickstart.md Section 4 and spec Acceptance Scenarios 1–4

### Implementation for User Story 3

- [ ] T039 [US3] Define `GetOrderStatusArgs` Zod schema (no user-identifying field; optional `orderId` matching `ORDER_ID_PATTERN`) in a new `src/features/ai/services/chat-tools-orders.ts`
- [ ] T040 [US3] Extract `fetchOrderStatusContext` and `formatOrderStatusLine` from `src/features/ai/services/chat-commerce-context.ts` into `src/features/ai/services/chat-tools-orders.ts`, wrapped as the `get_order_status` tool, with the dispatcher receiving `ctx.identity` out-of-band from `chat-engine.ts` and refusing to query the database at all for unauthenticated identities (R6, D4) — same query logic and secret/address exclusion, unchanged
- [ ] T041 [US3] Register `get_order_status` in the tool registry with `requiresAuth: true` in `src/features/ai/services/chat-tools.ts`, ensuring `buildFunctionDeclarations()` still advertises it to the model for guests (so the model can attempt the call and receive the "sign in" tool result) while the dispatcher — not the schema — enforces the authorization boundary
- [ ] T042 [US3] Update `buildCatalogSystemPrompt()` (and the anchored prompt) in `src/features/ai/services/chat-prompt.ts` to instruct the model to phrase declined order questions as "sign in to check your orders" rather than a generic error
- [ ] T043 [US3] Remove the order-status keyword-dispatch branch from `src/features/ai/services/chat-commerce-context.ts`, leaving only delivery-info/review-summary static sections (per R5/T035)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — order questions are answered only for the correct authenticated owner, on both surfaces.

---

## Phase 6: User Story 4 - Guardrails hold on every new surface (Priority: P1)

**Goal**: Every privacy, abuse, and cost control already shipped for the anchored assistant applies unchanged — and is re-verified — across both the anchored and catalog-wide surfaces.

**Independent Test**: Attempt stock extraction, cross-user data access, prompt injection through product content, and rate-limit exhaustion on both surfaces, and confirm each is refused or throttled identically.

### Tests for User Story 4 ⚠️

- [ ] T044 [P] [US4] Extend `playwright-tests/ai-stock-privacy.spec.ts` to run its full existing assertion set (no numeric stock, no cross-user leakage, guest non-persistence) against `POST /api/ai/assistant/chat` and the `StorefrontAssistant.tsx` surface, per FR-017 and quickstart.md Section 5
- [ ] T045 [P] [US4] Add a Vitest case in `__tests__/features/ai/services/chat-prompt.test.ts` asserting that a tool-result string containing an injected instruction (e.g., "ignore previous instructions") is sanitized the same way `sanitizePromptText`/`sanitizeAssistantOutput` already sanitize product/review text, before being wrapped as a `FunctionResponse` part (FR-010, SC-005)
- [ ] T046 [P] [US4] Add a Vitest case in `__tests__/features/ai/services/chat-usage.test.ts` (or extend existing coverage) asserting `DAILY_REQUEST_QUOTA`/`DAILY_TOKEN_QUOTA`/`ADVANCED_DAILY_REQUEST_QUOTA` are enforced cumulatively across both `product:{id}` and `catalog` surfaces for the same identity (R8)

### Implementation for User Story 4

- [ ] T047 [US4] Apply `sanitizePromptText`-equivalent normalization to every tool's `execute` return string in `src/features/ai/services/chat-tools-catalog.ts` and `chat-tools-orders.ts` before it is wrapped as a `FunctionResponse` part, per data-model.md's RetrievalContext invariant
- [ ] T048 [US4] Verify (and adjust only if needed) that `AI_RATE_LIMIT_PATHS` prefix-matching in `src/proxy.ts` already covers `/api/ai/assistant/chat` with no code change required (R8) — add a regression comment/test if the match is implicit
- [ ] T049 [US4] Verify `chat-usage.ts`'s quota keys remain `userId`-scoped (not route/surface-scoped) so quotas are shared across both AI routes, per R8 — adjust only if a surface-scoped key was accidentally introduced elsewhere in this feature
- [ ] T050 [P] [US4] Update `docs/features.md` to document the catalog-wide assistant, its four-tool set, and the anchored-vs-catalog-wide distinction (FR-018)
- [ ] T051 [P] [US4] Update `docs/architecture.md` to document the tool-calling engine (`chat-engine.ts`), the authorization model for `get_order_status` (dispatcher-enforced, not schema-enforced), and the full fallback chain (semantic → hosted search → DB → conventional search UI) (FR-018)

**Checkpoint**: All four user stories are independently functional, and every guardrail is re-verified to hold identically on both the anchored and catalog-wide surfaces.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final refactor of the anchored route onto the shared engine, and repo-wide verification.

- [ ] T052 Refactor `src/app/api/ai/products/[id]/chat/route.ts` to delegate to `chat-engine.ts` with `surface: 'product:{id}'` and `anchorProductId` set, per contracts/product-chat-api.md — request/response contract, status codes, and `X-AI-Thread-ID` header behavior remain externally unchanged
- [ ] T053 [P] Update `src/features/product/components/ProductAssistant.tsx`'s import of `AssistantMarkdown` to its new location (`src/features/ai/components/AssistantMarkdown.tsx`), completing T004
- [ ] T054 [P] Run `npm run lint` and fix any violations introduced by this feature
- [ ] T055 [P] Run `npx tsc --noEmit -p tsconfig.check.json` and fix any type errors introduced by this feature
- [ ] T056 Run `npm run test -- chat-tools chat-engine chat-cached-answer chat-tools-catalog chat-tools-orders` and ensure all pass
- [ ] T057 Run `npx playwright test playwright-tests/ai-stock-privacy.spec.ts` and ensure all pass, including the new catalog-surface and order-authorization cases
- [ ] T058 Run `npm run docs:check` to confirm `docs/features.md` and `docs/architecture.md` updates satisfy documentation gates (FR-018)
- [ ] T059 Execute quickstart.md end-to-end (Sections 2–5) manually or via scripted verification, confirming the AI-provider-unavailable degradation path (Section 1's `503` check) still leaves conventional search fully usable (FR-013, SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion — BLOCKS all user stories (US1–US4), since the shared engine, tool registry, and surface-scoped cache/history are consumed by every story.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2). Establishes `search_catalog`/`get_product_details`, the new route, and the global launcher that US2/US3 tools plug into.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and reuses the `search_catalog` tool and route/launcher built in US1 (extends rather than duplicates them) — implement after US1 for the smoothest path, though its own tool (`compare_products`) is independently testable once T010/T012 exist.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) and the tool registry from US1 (T010, T022) — independently testable once the registry and route exist, but sequenced after US1/US2 because it is the highest-risk surface per spec.md's "Why this priority."
- **User Story 4 (Phase 6)**: Depends on US1, US2, and US3 all being implemented, since it re-verifies guardrails across every tool and surface they introduced.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories beyond Foundational — this is the MVP.
- **User Story 2 (P2)**: Builds directly on US1's retrieval (`search_catalog`) per spec.md's "Why this priority," but its own `compare_products` tool and tests are additive, not a modification of US1's files in a conflicting way.
- **User Story 3 (P2)**: Independent of US1/US2 at the tool level (`get_order_status` is a separate tool/file), but shares the route and registry infrastructure they establish.
- **User Story 4 (P1 — but sequenced last)**: By definition depends on US1–US3 existing, since it re-verifies guardrails on surfaces they create. Its priority is P1 for release readiness, not for implementation order.

### Within Each User Story

- Tests (marked ⚠️) MUST be written and FAIL before their corresponding implementation tasks.
- Tool argument schemas before tool implementations.
- Tool implementations before tool registry registration.
- Tool registry registration before route/prompt wiring that offers the tool to the model.
- Route/prompt wiring before UI wiring (US1 only, since US2/US3 reuse US1's route and launcher).
- Story implementation complete before moving to the next priority phase.

### Parallel Opportunities

- Setup tasks T002–T003 can run in parallel (T001 first, since T002/T003 reference its constants); T004 is independent and parallelizable.
- Foundational tasks T005–T009 are mostly sequential (cache key → cache-write call sites → history key → request parsing), but T013, T015, T016 are parallelizable once T010–T012/T014 land.
- Once Foundational (Phase 2) completes, US1, US2, and US3 tool/schema files (`chat-tools-catalog.ts` additions for US1 vs. US2, and `chat-tools-orders.ts` for US3) can be developed in parallel by different contributors, since they are largely separate files or additive sections of the same file — coordinate on `chat-tools-catalog.ts` if US1 and US2 tasks run concurrently.
- All test tasks marked [P] within a story can run in parallel with each other (different files).
- Documentation tasks T050–T051 in Phase 6 are parallelizable with each other and with T047–T049.

---

## Parallel Example: User Story 1

```bash
# Launch tests for User Story 1 together:
Task: "Vitest coverage for search_catalog and get_product_details in __tests__/features/ai/services/chat-tools-catalog.test.ts"
Task: "Contract test for POST /api/ai/assistant/chat in __tests__/app/api/ai/assistant-chat.test.ts"

# Then implement schemas + tools (T019 before T020/T021, since schemas are imported by tool implementations):
Task: "Define SearchCatalogArgs and GetProductDetailsArgs Zod schemas in src/features/ai/services/chat-tools-catalog.ts"
```

## Parallel Example: User Story 4 (guardrail re-verification)

```bash
# These four tasks touch different files and can run in parallel:
Task: "Extend playwright-tests/ai-stock-privacy.spec.ts for the catalog surface"
Task: "Add prompt-injection sanitization test in __tests__/features/ai/services/chat-prompt.test.ts"
Task: "Add cross-surface quota test in __tests__/features/ai/services/chat-usage.test.ts"
Task: "Update docs/features.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Section 2 independently — confirm the global assistant answers catalog-wide questions with real, linked, currency-correct products
5. Deploy/demo if ready — this alone closes the baseline's primary gap ("one route, one surface")

### Incremental Delivery

1. Complete Setup + Foundational → shared engine and tool plumbing ready
2. Add User Story 1 → validate via quickstart.md Section 2 → deploy/demo (MVP!)
3. Add User Story 2 → validate via quickstart.md Section 3 → deploy/demo
4. Add User Story 3 → validate via quickstart.md Section 4 → deploy/demo (highest-risk surface — do not skip its tests)
5. Add User Story 4 → validate via quickstart.md Section 5 and the full Playwright suite → deploy/demo
6. Complete Phase 7 polish (anchored-route refactor, docs, full verification suite)

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: User Story 1 (`chat-tools-catalog.ts` search/details, new route, `StorefrontAssistant.tsx`)
- Developer B: User Story 3 (`chat-tools-orders.ts`, fully separate file — lowest file-conflict risk with US1)
- Developer C: begins User Story 2 (`compare_products`) once US1's `chat-tools-catalog.ts` skeleton (T019–T020) lands, to minimize merge conflicts in the shared file
- All: converge on User Story 4's guardrail re-verification once US1–US3 are merged
- Final: one developer performs Phase 7's anchored-route refactor once the shared engine is proven stable across US1–US4
