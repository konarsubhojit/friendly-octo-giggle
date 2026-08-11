# Contract: Product-Anchored Assistant Chat API (MODIFIED — same external shape)

`POST /api/ai/products/[id]/chat`

This route's **external contract is unchanged** from what is already shipped; this document
records the behavioral delta introduced by refactoring it onto the shared `chat-engine.ts` and
giving it access to the same four tools as the new catalog-wide route.

## Request

Unchanged:

```ts
{
  messages: Array<{ role: 'user' | 'assistant'; text: string }>, // min 1
  persistHistory?: boolean,
  threadId?: string, // defaults to `product-{productId}` via resolveThreadId
}
```

`params.id` (product id) continues to come from the URL path, not the request body.

## Behavior delta

**Before**: `buildCommerceContext` selects comparison / recommendation / review-summary /
order-status context by running regex-based `detectIntentSignals` over the latest message and
fetching all matching sections unconditionally, then hands the assembled static text to the model
as part of the system prompt. The model cannot ask for more, cannot ask for something the intent
detector missed, and cannot iterate.

**After**: The system prompt still opens with the anchor product's own context
(`buildProductContext`, unchanged — `product-rag.ts` is untouched) and the delivery-info /
review-summary sections remain static context appended the same way (R5 — these are
cheap, always-relevant, non-decision context, not moved to tools). Comparison and order-status
become model-invocable tools (`compare_products`, `get_order_status`), and the model additionally
gains `search_catalog` / `get_product_details` so an anchored conversation can now recommend
products beyond the anchor product when the shopper asks for alternatives — closing part of
baseline gap #2 for the anchored surface too, at no cost to existing behavior when the shopper's
questions stay about the anchor product alone.

**Unchanged**:
- 404 if the product itself does not exist (`db.products.findById(id)` check happens first,
  before any tool is offered).
- `MAX_CONVERSATION_TURNS`, quota enforcement, `detectBlockedPrompt`, streaming shape, and
  `X-AI-Thread-ID` header behavior.
- Response cache lookup for single-turn requests — now scoped under
  `surface = 'product:{id}'` instead of the bare product id (see D3 in plan.md and
  [data-model.md](../data-model.md)'s Cache Key Model). This is a pure key-shape change; callers
  never see the key, so no client-visible behavior changes.
- History Redis key now includes the surface segment
  (`ai:chat:history:{userId}:product:{id}:{threadId}`) instead of the bare product id — again
  invisible to callers, and old keys simply expire under the existing 30-day TTL.

## Response

Unchanged: streamed `text/plain` body with optional `X-AI-Thread-ID` header, or a cached-answer
JSON body for single-turn cache hits. Status codes (`400`, `404`, `429`, `503`) unchanged.

## Guardrails re-verified against the tool-calling refactor

All guardrails listed in [assistant-chat-api.md](./assistant-chat-api.md)'s table apply
identically to this route, since both routes now share `chat-engine.ts`. The one
anchored-route-specific check that must be re-verified is:

- **Anchor product exclusivity is not required.** Nothing in the spec restricts the anchored
  route to only ever discussing its anchor product — Acceptance Scenario coverage for User Story
  1/2 does not distinguish between the two routes. The anchored route's system prompt still
  instructs the model to prioritize the anchor product's own context, but `search_catalog` /
  `compare_products` remain available so a shopper asking "what else do you have like this?"
  on a product page gets a real, tool-grounded answer instead of a refusal.
