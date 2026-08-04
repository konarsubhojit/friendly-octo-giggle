# Contract: Fixture Seed

**Feature**: `013-e2e-in-continuous-integration` | **Artifact**: `scripts/seed-e2e-fixtures.mjs`

The fixture seed is the only data a blocking Playwright project is permitted to assume. Anything not guaranteed below is not promised and must be intercepted with `page.route` instead. Weakening or removing a guarantee is a breaking change for every consumer listed against it.

## Execution contract

| Property          | Value                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Location          | `scripts/seed-e2e-fixtures.mjs`                                                                             |
| Invocation        | `node scripts/seed-e2e-fixtures.mjs`                                                                        |
| Preconditions     | `DATABASE_URL` set; `npx drizzle-kit migrate` has completed successfully                                    |
| Runs before       | The application server starts                                                                               |
| Connection        | Direct `pg` TCP, not the Neon WebSocket driver — the seed needs no proxy, exactly as `drizzle-kit` does not |
| Idempotence       | Deletes its own rows by known identifier, then inserts. Re-running inside a job is safe                     |
| DDL               | None. Schema changes are Drizzle migrations only                                                            |
| Exit code         | Non-zero on any failure; a partial seed must not be reported as success                                     |
| Table definitions | Imported from `src/lib/schema.ts`, which imports no env and no database and is therefore safe to import     |

## Guaranteed invariants

### G1 — Admin test account

| Field            | Guarantee                                         | Why                                                                                                          |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `email`          | Equals the `COPILOT_DEV_EMAIL` value the job sets | `playwright-tests/global-setup.ts:29-38` reads that variable and signs in with it                            |
| `passwordHash`   | `bcrypt` hash of `COPILOT_DEV_PASS` at cost 12    | `src/features/auth/services/password.ts:9-10` uses cost 12; the hash is self-describing so `compare` matches |
| `role`           | `'ADMIN'`                                         | `src/proxy.ts:534-546` bounces non-staff roles away from `/admin`                                            |
| `emailVerified`  | Non-null                                          | `src/lib/auth.ts:156-157` rejects credentials sign-in for an unverified email                                |
| `lockedUntil`    | Null                                              | `src/lib/auth.ts:113` rejects a locked account                                                               |
| `sessionVersion` | Present                                           | Carried on the JWT and re-validated by the Node-side `jwt` callback                                          |

Consumers: `playwright-tests/global-setup.ts` and the eight projects with `storageState: './playwright-tests/.auth/admin.json'` — `orders-list`, `account-password-validation`, `admin-desktop`, `admin-mobile`, `accessibility-authenticated`, `variant-options`, plus the advisory `orders-live` and the `describe`-scoped admin routes in `ux-audit.spec.ts`.

The credentials are literal non-secret job values on a database created and destroyed inside the job. They are not repository secrets, which is what lets a fork pull request run the identical blocking set (FR-010, FR-015, SC-008). Session state is written to `playwright-tests/.auth/admin.json` at run time and is never committed.

### G2 — Browsable catalog

At least one active `Product` that:

- belongs to a `Category`,
- carries at least one image,
- has stock above zero,
- renders as a card on `/shop`,
- has a detail page reachable by following that card.

Consumers: `public-pages.spec.ts` (product detail via the shop grid), `product-navigation.spec.ts` (grid links and the bestseller link), `accessibility.spec.ts` (its "Product" route navigates from `/shop`), and the `webServer` readiness probe on `${BASE_URL}/shop`.

`src/lib/db-queries.ts:272+` builds bestsellers with a LEFT JOIN, so a product with no order history still appears. The seed therefore needs no orders to satisfy `product-navigation.spec.ts`.

### G3 — Product with variant options

At least one `Product` that carries:

- **two** `ProductOption` rows,
- at least **two** `ProductOptionValue` rows per option,
- `ProductVariant` rows wired to those values through `ProductVariantOptionValue`,
- stock above zero on every variant the suite selects,
- dash-delimited SKUs of equal arity across all variants.

Consumer: `variant-options.spec.ts`.

Why each part:

- `VariantSelector` renders `id="variant-selector-label"` with the text **"Choose Your Options"** only on the named-options branch. The no-options fallback renders "Choose Your Option" and would fail the assertion.
- `variant-options.spec.ts:88-92` requires at least two pressed option dimensions, so one option is not enough.
- The test that clicks an unpressed value needs a second value on at least one option and a second matching variant.
- Stock above zero is required for the stock status, quantity control, and add-to-cart assertions at `:125` and the real cart write at `:205`.
- Equal-arity dash-delimited SKUs are what `deriveOptionsFromSkus` in `src/app/(public)/products/[id]/lib/variant-utils.ts:124-144` requires, which the admin "generate from variant SKUs" cases at `:176-193` exercise.

`variant-options.spec.ts:53-55` already throws when no such product exists, so a regression in this guarantee fails loudly during setup rather than skipping, as the spec's edge cases require.

### G4 — Deterministic identifiers

| Table                                                                          | Identifier form                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `Category`, `Product`, `ProductOption`, `ProductOptionValue`, `ProductVariant` | Fixed 7-character Base62 literals, matching the `varchar(7)` column shape |
| `User`, `Account`                                                              | Schema default `crypto.randomUUID()`, addressed by email rather than id   |

`generateShortId()` from `src/lib/short-id.ts` is random by design and cannot be used where the suite must address a row across runs. The literals conform to the same shape the column enforces. Auth tables keep UUIDs, which the repository's coding standard already exempts.

### G5 — Explicit non-guarantees

The seed **does not** provide these, and no blocking project may depend on them:

| Absent fixture                    | Consequence                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Product with identifier `tprod01` | `orders-live.spec.ts:107-108` hardcodes it, which is one of the two reasons `orders-live` is advisory (spec Q4)        |
| Order history                     | Order-facing suites intercept their responses from `playwright-tests/mock-data.ts`                                     |
| A second user account             | `session-isolation.spec.ts`'s optional second-account case skips when that credential is absent, which FR-010 requires |
| Reviews, coupons, shipping zones  | Not asserted by any blocking project; add a guarantee here before a suite starts relying on one                        |

Adding a fixture to satisfy a currently advisory project promotes that project only if the project's other promotion conditions are also met. Seeding `tprod01` alone would not make `orders-live` blocking, because its conditional assertions remain.

## Drift control against `drizzle/`

| Mechanism                                               | What it catches                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Seed imports table objects from `src/lib/schema.ts`     | A migration adding a non-nullable column with no default breaks the seed at type-check, not at run time |
| Seed runs only after `npx drizzle-kit migrate` succeeds | The seed never races a partially applied schema                                                         |
| Seed issues no DDL                                      | Schema shape stays owned exclusively by `drizzle/`                                                      |
| Job-scoped database                                     | No run can be green because a fixture survived from an earlier run, per the spec's edge cases           |

## Coding standards this script must satisfy

- `const` arrow functions only; no `function` declarations.
- `/* eslint-disable no-console */` header, since `eslint.config.js:54-57` disables `no-console` for `__tests__/**` and `playwright-tests/**` but not for `scripts/**`. Both committed scripts already carry it.
- No comments other than that lint suppression.
- Password hashing calls `bcryptjs` directly rather than importing `hashPassword`, because `src/features/auth/services/password.ts:2` imports `primaryDrizzleDb` and would construct the Neon pool as a side effect of seeding. The cost constant is shared, and the resulting hash is byte-compatible.
