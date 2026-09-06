# Feature Specification: Storefront AI Assistant

**Feature Branch**: `020-storefront-ai-assistant`  
**Created**: 2026-08-01  
**Last reviewed**: 2026-08-10  
**Status**: Draft — ready to plan  
**Epic**: Phase 3 — AI, interaction quality, and revenue levers  
**Input**: Promote the single-product AI chat into a catalog-wide assistant that can search, filter, compare, and — for authenticated shoppers only — answer questions about their own orders, while preserving every privacy guardrail the current assistant already enforces.

## Baseline (verified 2026-08-10)

Re-verified against the working tree at `f257e72`. The assistant has grown considerably since this specification was drafted, and two of its original assumptions are now wrong: the assistant is already order-aware, and it already assembles supplemental commerce context beyond the anchor product. The remaining gap is narrower and sharper than the original draft described.

- **One route, one surface.** `POST /api/ai/products/[id]/chat` is still the only AI endpoint, and `ProductAssistant.tsx` (lazily imported by `ProductClient.tsx`) is still the only surface. Every question is anchored to a product id in the URL, so a shopper who has not yet chosen a product has no way to reach the assistant at all.
- **The service layer is substantial.** `src/features/ai/services/` now holds ten modules: `chat-request` (parsing, identity, currency), `chat-prompt` (system prompt, token estimation, `sanitizePromptText`, `sanitizeAssistantOutput`), `chat-intent` (`detectIntentSignals`, `detectBlockedPrompt`, `extractComparisonTerms`), `chat-commerce-context`, `chat-history`, `chat-usage`, `chat-cached-answer`, `chat-stream`, `chat-constants`, and `chat-types`.
- **Supplemental context already exists — but only around the anchor product.** `buildCommerceContext` composes `fetchComparisonContext`, `fetchRecommendationContext`, `fetchReviewSummaryContext`, and `fetchOrderStatusContext`. These are ordinary server-side fetches selected by keyword intent detection, **not** model-invoked tools: there are no function declarations, the model cannot choose what to retrieve, and it cannot iterate. Intent misdetection therefore silently starves the model of context with no recovery path.
- **Order awareness already shipped.** `fetchOrderStatusContext` answers "where is my order" for authenticated users, scoped server-side by session identity. User Story 3 is consequently a hardening-and-extension story, not a greenfield one — the risky surface it describes is already live and must be audited rather than designed.
- **Cost and abuse controls already shipped and stricter than the draft assumed.** `chat-constants.ts` sets `DAILY_REQUEST_QUOTA=40`, `DAILY_TOKEN_QUOTA=12000`, a separate `ADVANCED_DAILY_REQUEST_QUOTA=15` for intent-triggered advanced context, `MAX_CONVERSATION_TURNS=6`, `MAX_OUTPUT_TOKENS=400`, `MAX_INPUT_MESSAGE_CHARS=500`, `PRODUCT_CONTEXT_MAX_CHARS=4000`, and `SUPPLEMENTAL_CONTEXT_MAX_CHARS=1600`. Quotas are Redis-backed per UTC day (`chat-usage.ts`) and sit behind the strict Upstash limiter applied to `/api/ai` in `src/proxy.ts`.
- **Guardrails to carry forward unchanged.** Guest identity is one-way hashed; history persists (30-day TTL) only for signed-in users; exact stock counts are never disclosed — `product-rag.ts` emits qualitative labels only; prompt and output text are sanitized; `playwright-tests/ai-stock-privacy.spec.ts` enforces the stock-privacy contract at browser level.
- **Model configuration.** Google Generative AI (`@google/genai`) through `src/lib/ai/gateway.ts`, with `getAiConfigCached()` reading Vercel Edge Config on a 60-second in-process cache and `buildGenerateConfig()` applying the thinking level. Single-turn responses are cached in `src/lib/ai/ai-cache.ts` (Redis, 1-hour TTL) under `ai:response:{productId}:{currencyCode}:{normalizedQuestion}` — a key shape that assumes a product anchor and will need reworking for catalog-wide questions.
- **Retrieval available to build on.** `src/lib/search/product-search.ts` exposes `searchProductIds`, `searchProductIdsCached`, and `searchProducts` with facets, six sort modes, a 60-second cache with a 10-second stale window, and a SQL fallback when the hosted search service is unavailable. This is the retrieval layer a catalog-wide assistant should consume; nothing new needs to be indexed to reach a first useful version.
- **The gap, restated precisely**: (1) no entry point that is not anchored to a product id; (2) retrieval is keyword-triggered and server-chosen rather than model-directed, so genuinely open-ended discovery and multi-constraint comparison cannot be served; (3) the response cache key is product-scoped; (4) no cart awareness. The privacy model, quota model, streaming, and history are all already in place.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Catalog-wide product discovery (Priority: P1)

A shopper can describe what they want in natural language and receive relevant products from anywhere in the catalog, with links.

**Why this priority**: This is the capability the current assistant lacks, and it is the one that helps shoppers who have not yet chosen a product — the largest addressable group.

**Independent Test**: Ask a natural-language question spanning multiple categories and confirm the answer cites real, in-catalog, purchasable products with working links.

**Acceptance Scenarios**:

1. **Given** a shopper asks for a product by description, **When** the assistant answers, **Then** it recommends products that exist in the catalog and links to them.
2. **Given** the assistant recommends a product, **When** the recommendation is produced, **Then** it is grounded in retrieved catalog data and not invented.
3. **Given** no catalog product matches, **When** the assistant answers, **Then** it says so rather than fabricating a product.
4. **Given** a soft-deleted or unpublished product, **When** retrieval runs, **Then** it is excluded from candidates.
5. **Given** a shopper asks in terms of price, **When** the assistant answers, **Then** prices are expressed in the shopper's selected currency.

---

### User Story 2 - Comparison and constrained recommendation (Priority: P2)

A shopper can ask the assistant to compare products or to recommend within a constraint such as a budget or a category.

**Why this priority**: High value for decision-making, and it builds directly on Story 1's retrieval, so it is sequenced after it.

**Independent Test**: Ask for a comparison of two named products and a budget-constrained recommendation, and confirm both answers use accurate catalog attributes.

**Acceptance Scenarios**:

1. **Given** two named products, **When** the shopper asks for a comparison, **Then** the assistant compares real attributes retrieved from the catalog.
2. **Given** a budget constraint, **When** the shopper asks for a recommendation, **Then** only products satisfying the constraint are recommended.
3. **Given** a constraint no product satisfies, **When** the assistant answers, **Then** it states this and may offer the nearest alternatives, labelled as such.
4. **Given** an availability question, **When** the assistant answers, **Then** it uses qualitative availability language and never a numeric stock count.

---

### User Story 3 - Order questions for authenticated shoppers only (Priority: P2)

A signed-in shopper can ask about their own orders and receive an accurate answer; a guest cannot reach order data at all.

**Why this priority**: A frequent support-deflection use case, but it is the highest-risk surface in this specification because it connects a language model to personal data.

**Independent Test**: As a signed-in user, ask about your most recent order and confirm the answer matches the record. Repeat as a guest and as a different user, and confirm no order data is disclosed.

**Acceptance Scenarios**:

1. **Given** a signed-in shopper, **When** they ask about their own order, **Then** the assistant answers from that user's own order records.
2. **Given** a guest, **When** they ask about any order, **Then** the assistant declines and no order data is retrieved.
3. **Given** a signed-in shopper, **When** they reference an order belonging to another user, **Then** ownership enforcement prevents retrieval and nothing is disclosed.
4. **Given** any order-data retrieval, **When** it executes, **Then** it is scoped by the session user identity on the server, never by an identifier supplied in the conversation.
5. **Given** an order answer, **When** it is produced, **Then** it excludes payment secrets, gateway identifiers, and full stored addresses.

---

### User Story 4 - Guardrails hold on every new surface (Priority: P1)

Every privacy, abuse, and cost control that governs the current assistant applies unchanged to the expanded one.

**Why this priority**: Expanding scope multiplies the blast radius of any guardrail gap. This story is equal in priority to the core capability because shipping without it would be a regression in safety.

**Independent Test**: Attempt stock extraction, cross-user data access, prompt injection through product content, and rate-limit exhaustion, and confirm each is refused or throttled.

**Acceptance Scenarios**:

1. **Given** any assistant response, **When** it mentions availability, **Then** it never contains an exact stock count.
2. **Given** a guest conversation, **When** it completes, **Then** no conversation history is persisted and the guest identity remains one-way hashed.
3. **Given** repeated requests beyond the limit, **When** they arrive, **Then** the existing strict rate limiter throttles them.
4. **Given** injected instructions inside product descriptions or reviews, **When** they enter the retrieval context, **Then** they are treated as untrusted data and do not alter assistant behavior.
5. **Given** a tool invocation requested by the model, **When** it executes, **Then** its arguments are validated with Zod and its authorization is enforced server-side.
6. **Given** logging or metrics, **When** they are written, **Then** they exclude raw guest identifiers, prompts containing personal data, and credentials.

---

### Edge Cases

- With the AI provider unavailable or its key unset, the assistant must degrade to conventional search rather than erroring the page.
- Semantic retrieval must fall back to the existing Upstash Search and then to database search, matching the platform's fallback discipline.
- Retrieval context must be bounded so a large catalog cannot exceed the model's context window or inflate cost per request.
- Stale embeddings after a product edit must not cause the assistant to describe outdated attributes.
- Model output that names a nonexistent product must be suppressed rather than shown.
- A tool-calling loop must be bounded so the model cannot chain calls indefinitely.
- Session expiry mid-conversation must immediately revoke access to order data.
- Currency and price rendering must remain consistent with the storefront's stored INR base and display conversion.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The assistant MUST answer questions spanning the whole catalog, not only a single product.
- **FR-002**: The assistant MUST ground every product claim in retrieved catalog data and MUST NOT present unretrieved products.
- **FR-003**: Retrieval MUST exclude soft-deleted and unpublished products.
- **FR-004**: The assistant MUST expose a bounded set of server-defined tools — catalog search, filtering, product comparison, and authenticated order lookup — and MUST NOT execute any operation outside that set.
- **FR-005**: Every tool argument MUST be validated with Zod before execution.
- **FR-006**: Order-data tools MUST be available only to authenticated sessions and MUST scope every query by the server-side session user identity.
- **FR-007**: The assistant MUST NOT perform mutations; it is read-only with respect to carts, orders, and account data.
- **FR-008**: Responses MUST NOT disclose exact stock counts, preserving the shipped qualitative availability mapping.
- **FR-009**: Guest conversations MUST NOT be persisted, and guest identity MUST remain one-way hashed.
- **FR-010**: Retrieved product and review content MUST be treated as untrusted data and MUST NOT be able to alter system instructions.
- **FR-011**: Tool-calling depth and total tokens per conversation turn MUST be bounded.
- **FR-012**: Semantic retrieval MUST fall back to Upstash Search and then to database search when unavailable.
- **FR-013**: With the AI provider unavailable, the storefront MUST degrade to conventional search without an error state.
- **FR-014**: Existing strict rate limiting on `/api/ai` MUST apply to all new assistant surfaces.
- **FR-015**: Logs and metrics MUST exclude raw guest identifiers, credentials, payment secrets, and personal data contained in prompts.
- **FR-016**: Model configuration MUST continue to be driven by Edge Config with hardcoded defaults when unavailable.
- **FR-017**: `playwright-tests/ai-stock-privacy.spec.ts` MUST be extended to cover every new assistant surface.
- **FR-018**: `docs/features.md` and `docs/architecture.md` MUST document the tool set, the authorization model, and the fallback chain.

### Key Entities

- **AssistantTool**: A server-defined, Zod-validated, authorization-checked capability the model may invoke.
- **RetrievalContext**: The bounded set of catalog records assembled for one turn, treated as untrusted content.
- **ConversationTurn**: One request and response pair, persisted only for authenticated users.
- **AssistantIdentity**: The authenticated user identity, or the one-way hashed guest identity used solely for rate limiting and abuse control.
- **FallbackChain**: The ordered degradation path — semantic retrieval, hosted search, database search, conventional search UI.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The assistant answers a multi-product discovery question with products that exist and are purchasable.
- **SC-002**: No assistant response contains an exact stock count.
- **SC-003**: A guest cannot obtain any order data through any phrasing.
- **SC-004**: A signed-in shopper cannot obtain another user's order data through any phrasing.
- **SC-005**: Injected instructions in product or review content do not change assistant behavior.
- **SC-006**: With the AI provider disabled, storefront discovery still functions through conventional search.
- **SC-007**: Tokens and tool calls per turn stay within the configured bounds.
- **SC-008**: The extended AI privacy Playwright suite passes against every assistant surface.

## Out of Scope

- Assistant-initiated mutations such as adding to cart, placing orders, or changing account data.
- Admin-facing AI copilots, which are a separate slice.
- Voice or image input.
- Replacing the existing search experience; the assistant complements it.

## Dependencies

- Extends the shipped product AI chat, its guardrails, and its Edge Config-driven model configuration.
- May consume scores from `017-personalized-recommendations` but MUST NOT depend on them.
