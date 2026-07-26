# Review Checklist

Item-by-item checks for each manual pass. Apply only to lines the branch adds or modifies.

## Correctness

- Boundary conditions: `<` vs `<=`, empty arrays, zero, null, first/last element
- Inverted conditions and negations, especially after a refactor
- `Promise` handling: missing `await`, floating promises, `await` on non-Promises (S4123)
- Error paths: every `catch` either handles or rethrows meaningfully — never swallows
- Early returns that skip required cleanup or state updates
- Copy-paste artifacts: wrong variable reused, stale comment, duplicated block
- Dead code, unreachable branches, unused exports left behind

## Security

- Every API route validates its body **and** its route/query params with Zod before touching the DB
- Authentication checked (`auth()`), then authorization checked (role/ownership) — 401 vs 403 used correctly
- No secrets, tokens, real emails, or passwords in source, tests, fixtures, or logs
- User-controlled values never interpolated into raw SQL, shell commands, file paths, or redirect URLs
- Server-only data (cost, margin, internal stock, other users' PII) never serialized into client props or API responses
- External links carry `rel="noopener noreferrer"`
- Uploads validate MIME type, extension, and size limits server-side
- Rate limiting present on write and auth endpoints

## Data & Database

- Schema change has a generated migration in `drizzle/`; no schema edits without one
- Migration is zero-downtime: no destructive column drops in the same deploy as code that still reads them; `NOT NULL` added via backfill + `NOT VALID` constraint + validate
- New foreign keys and frequently-filtered columns are indexed
- Multi-step writes wrapped in a transaction
- Count/limit checks performed **inside** the transaction with a parent row lock, not before it
- Read-after-write flows use `primaryDrizzleDb`, not the replica composite
- No N+1 queries: relations loaded via `with`, not in a loop
- Cache invalidated on every write path that changes cached data; `revalidateTag()` called with a single string argument

## API Contract

- Correct status codes: 400 validation, 401 unauthenticated, 403 unauthorized, 404 missing, 409 conflict
- Response shape unchanged for existing consumers, or all consumers updated in the same branch
- `Cache-Control` headers set appropriately; no caching on user-specific responses
- Errors routed through `handleApiError` / `apiError`, never raw `throw` to the client
- Error messages do not leak stack traces, SQL, or internal identifiers

## React & State

- `'use client'` pushed to the smallest leaf that needs it; not added to layouts or pages
- No data fetching in `useEffect` where a Server Component could fetch it
- Hook dependency arrays complete and stable; no new object/array literal recreated every render
- List `key` is a stable identifier, never the array index
- No `Date.now()` / `Math.random()` / `window` reads during SSR render
- Effects clean up timers, listeners, and subscriptions
- Redux used only for cross-page/shared state; local UI state stays in `useState`
- All thunks go through `lib/api-client.ts`, not raw `fetch`

## Performance

- Above-fold images: dimensions set, `priority`, no `loading="lazy"`
- No new render-blocking script or stylesheet
- New heavy dependency justified; check bundle impact and prefer tree-shakeable/native alternatives
- Lists over ~100 items virtualized
- No layout-triggering CSS animated (`width`, `height`, `top`, `left`) — use `transform`/`opacity`
- No synchronous work over ~50ms in an event handler
- Direct imports, not barrel-file imports

## Accessibility

- Interactive behavior on a real interactive element (`<button>`, `<a>`), not a `div` with a role
- `tabIndex` only on interactive elements (`tabIndex={-1}` for programmatic focus is fine)
- Labels bound via `htmlFor`/`id`; icon-only controls have `aria-label`
- Dropdowns/menus expose `aria-expanded`, `aria-haspopup`, `role="menu"`, `role="menuitem"`
- Decorative elements marked `aria-hidden="true"`
- Focus visible and trapped correctly in modals; Escape closes

## Tests

- Every new conditional branch and error path has a test
- Every `it()` contains at least one meaningful assertion (S2699)
- Assertions verify observable outcomes (DOM change, returned value, DB state) — not merely "the mock was called"
- Captured request bodies are asserted, not just captured
- No `waitForTimeout()` in E2E tests; assert on a visible change instead
- No hardcoded credentials — use `process.env.PLAYWRIGHT_TEST_*`
- No `mockResolvedValue(undefined)`, no `async` callbacks without `await`, no non-null assertions (`!`)

## Consistency

- Prices formatted via `formatPrice()` from `useCurrency()` — never raw `$` or `.toFixed(2)`
- Theme values via `useTheme()`, not hardcoded colors
- Error copy pulled from `lib/constants/error-messages.ts`
- Logging via `lib/logger.ts` (Pino), not `console.log`
- Component placed in the correct folder (`ui/`, `layout/`, `admin/`, `sections/`, …)
- Props interfaces use `readonly` members
- IDs generated via `lib/short-id.ts`

## Cleanup

- No leftover `console.log`, debugger statements, or commented-out code
- No temporary mock data or hardcoded fixtures left in app code
- No `TODO`/`FIXME` added without a tracked issue reference
- No unrelated formatting churn inflating the diff
- `.env`, certificates, and generated artifacts not committed

## Cognitive Complexity

Flag any function whose cognitive complexity exceeds 15 (S3776). Remediate by extracting named predicate helpers, returning early, and splitting multi-responsibility functions.
