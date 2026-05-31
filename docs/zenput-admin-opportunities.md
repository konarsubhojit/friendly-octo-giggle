# zenput v1.1.1 — Admin Surface Opportunity Map & Feature Requests

> Companion document to the [zenput Phase A](../docs/development.md#zenput-adapter-layer) work.
> This is **analysis only** — no admin component should be migrated to a zenput
> equivalent without an accompanying PR that updates the adapter layer in
> `src/components/ui/zenput/`, the developer guide at `docs/development.md`,
> and the axe/visual regression suites.

## 1. Method

I walked every file under `src/app/[locale]/admin/**` and
`src/features/admin/components/**`, then cross-referenced each custom UI
construct against the components exported by `zenput@1.1.1`
(`node_modules/zenput/dist/index.d.ts`). Each construct is bucketed into:

- **Good fit** — adopt in a future Phase B PR.
- **Conditional fit** — only adopt once the listed zenput gap is closed.
- **Keep custom** — the in-repo component is already a thin wrapper around app
  semantics (`LocaleLink`, `AdminPageShell`, etc.) and replacing it would
  reduce, not improve, clarity.

## 2. Component opportunity map

| Admin construct                                                                                            | Files                                                                               | Current implementation                                                  | zenput@1.1.1 candidate                                                                    | Recommendation                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Breadcrumb trail in `AdminPageShell`                                                                       | `src/features/admin/components/AdminBreadcrumbs.tsx`, `AdminPageShell.tsx`          | Hand-rolled `<nav aria-label="Breadcrumb">` + `<ol>` with `LocaleLink`s | `Breadcrumbs`                                                                             | Good fit (Phase B)                                                                   |
| Tab strip inside admin dashboards (segments such as "Overview / Trends / Stock")                           | Several admin dashboards use ad-hoc `<button>` arrays in tabbed sections            | Custom `<button>` strip with `aria-selected`                            | `Tabs`, `TabList`, `Tab`, `TabPanels`, `TabPanel`                                         | Good fit (Phase B)                                                                   |
| Delete confirmation modal                                                                                  | `src/features/admin/components/DeleteConfirmModal.tsx`                              | Custom focus-trap + portal                                              | `Dialog` + `DialogHeader/Body/Footer`, `useConfirm`                                       | Good fit (Phase B)                                                                   |
| Product / Variant form modals                                                                              | `ProductFormModal.tsx`, `VariantFormModal.tsx`                                      | Custom dialog wrapping zenput inputs                                    | `Dialog` + `DialogContent` for the shell; reuse our adapter inputs inside                 | Good fit (Phase B)                                                                   |
| Empty / zero-state slates on admin pages (currently rendered through `EmptyState` in `src/components/ui/`) | `src/components/ui/EmptyState.tsx`                                                  | Card with `EmptyStateIcon`                                              | `EmptyState`                                                                              | Good fit (Phase B) — keep the icon set                                               |
| Loading spinners / skeleton placeholders                                                                   | `LoadingSpinner.tsx`, `DataTable` skeleton rows                                     | Custom spinner + DataTable handles its own rows                         | `Spinner`, `Skeleton`, `SkeletonText`, `SkeletonAvatar`                                   | Good fit (Phase B) for non-table loaders                                             |
| Status / role pills (`RoleBadge`, order status chips)                                                      | `src/features/admin/components/RoleBadge.tsx`, inline pills in `AdminOrderCard.tsx` | Tailwind chip                                                           | `Badge`, `Chip`, `Tag`                                                                    | Good fit (Phase B)                                                                   |
| User avatar / initials                                                                                     | `src/features/admin/components/UserAvatar.tsx`                                      | Custom circle with initials fallback                                    | `Avatar`, `AvatarGroup`                                                                   | Good fit (Phase B)                                                                   |
| Inline alert banners on admin pages                                                                        | `src/components/ui/AlertBanner.tsx`                                                 | Tailwind alert with icon                                                | `Field`, `FieldMessage` (for inline form alerts) — no top-level `Alert` exported in 1.1.1 | Conditional — see feature request #2                                                 |
| Drawer for ‘View order detail’ on `/admin/orders` (currently `expandedRowRender`)                          | `src/app/[locale]/admin/orders/page.tsx`                                            | Inline expanded row via DataTable                                       | `Drawer` + `DrawerContent` for a true side panel                                          | Good fit (Phase B) — UX upgrade                                                      |
| Tooltips on icon-only admin buttons (e.g. refresh, bulk-action triggers)                                   | Various                                                                             | `title=…` attributes only                                               | `Tooltip` + `TooltipTrigger/Content` + `TooltipProvider`                                  | Good fit (Phase B) — a11y improvement                                                |
| Toast notifications                                                                                        | `react-hot-toast` (global, used everywhere)                                         | Third-party, integrated app-wide                                        | `ToastProvider` + `useToast`                                                              | **Keep custom.** Migrating would touch the entire app, not just admin. Out of scope. |
| Pagination controls (DataTable’s built-in)                                                                 | DataTable                                                                           | DataTable handles it                                                    | `Pagination` (standalone)                                                                 | Already covered by DataTable                                                         |
| Internal links (`LocaleLink`)                                                                              | Everywhere                                                                          | Custom locale-aware wrapper over `next/link`                            | `Link`                                                                                    | **Keep custom.** Locale-aware routing is app logic.                                  |
| Generic buttons (primary / secondary / destructive)                                                        | Everywhere                                                                          | Tailwind classes directly                                               | `Button`                                                                                  | Conditional — see feature request #1                                                 |

## 3. Suggested phased adoption

- **Phase B (low-risk swaps, no UX change):** `Badge`/`Chip`, `Avatar`,
  `Spinner`/`Skeleton`, `Tooltip`. Each is a leaf component with no state and
  a straightforward 1:1 mapping.
- **Phase C (interactive surfaces):** `Dialog`/`Drawer` to replace
  `DeleteConfirmModal`, `ProductFormModal`, `VariantFormModal` shells, plus
  `Tabs`. These pull a11y wiring (focus trap, escape handling) into the
  library and let us delete bespoke logic.
- **Phase D (cross-cutting concerns):** `EmptyState`, `Breadcrumbs`. These
  affect non-admin surfaces as well; do an explicit RFC first.

Each phase **must** ship behind the adapter layer in
`src/components/ui/zenput/` and update the eslint
`no-restricted-imports` exemption list if any new symbols are re-exported.

## 4. Feature requests to file against the zenput repo

These gaps were uncovered while scoping the migration above. They are blockers
or sharp edges that, if addressed in zenput, would let us delete more custom
code instead of writing more adapters.

### FR-1 — First-class `Button` recipes that match our Tailwind tokens

**What:** A `Button` primitive with `variant` (`primary`, `secondary`,
`ghost`, `destructive`), `size` (`sm`, `md`, `lg`), `loading` state, and an
optional `asChild` slot (so it composes with `LocaleLink`).

**Why:** Our admin pages re-declare the same `inline-flex items-center
rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white ...`
class string in ~20 places. A `Button` that consumes the zenput tokens would
let us delete the repetition without bouncing through Tailwind tokens.

**Status:** zenput 1.1.1 exports `interactiveRecipe` and `focusRingRecipe`
but no top-level `Button` symbol; consumers are expected to roll their own.

### FR-2 — Top-level `Alert` / `AlertBanner` component

**What:** A non-form `Alert` (info / success / warning / error) with title,
description, optional action slot, and `dismissible` prop. Should announce
politely via the existing `LiveRegion` utility.

**Why:** zenput 1.1.1 exports `FieldMessage` (form-scoped) and the
`useAlert` hook (programmatic toast-like), but neither replaces our
`AlertBanner` for inline page-level notices ("3 orders failed to sync",
etc.).

### FR-3 — `NumberInput.onChange` should fire `(value: number) => void` with an opt-in `allowEmpty` flag

**What:** Make the `(value: number | undefined)` signature opt-in via
`allowEmpty: true` and otherwise emit a concrete `number` (snapping to
`min`, `max`, or a `fallbackValue`).

**Why:** This is the exact shim our `NumberField` adapter implements. Every
team using `NumberInput` is likely re-implementing the same coalescing
logic. Pushing it into the library would let us delete `NumberField.tsx`.

**Workaround in this repo:** `src/components/ui/zenput/NumberField.tsx`.

### FR-4 — `DataTable` `expandedRowRender` should expose `close()` / `isExpanded` to consumers

**What:** Pass a render-prop argument so the expanded view can dismiss
itself or react to its own state.

**Why:** On `/admin/orders` the expanded row hosts a form (tracking number
update). After saving we want to collapse the row, but the current API
gives no programmatic handle.

### FR-5 — `DataTable` `pagination` should support a `cursor` mode (or expose `onLoadMore`)

**What:** Today the table’s pagination is page-number based
(`currentPage`, `totalCount`, `pageSize`). Our admin endpoints are
cursor-paginated for list endpoints (see `pageCursorsRef` workaround in
`src/app/[locale]/admin/products/page.tsx`).

**Why:** Without cursor support we forge a synthetic page-number/cursor
mapping client-side. Native cursor support would let us delete the
`pageCursorsRef` book-keeping.

### FR-6 — `FileInput` should accept multiple files with an externally controlled queue

**What:** A `value: File[]` / `onChange(files: File[])` controlled API,
plus reorder/remove primitives.

**Why:** `VariantFormModal` manages an additional-images gallery with up
to ten slots manually (see `MAX_ADDITIONAL_IMAGES`). A controlled
multi-file `FileInput` (or a sibling `FileList`/`FileGrid` component)
would replace the bespoke add/remove/reorder state machine.

### FR-7 — Expose token CSS variables under documented names

**What:** A reference table mapping every `--zenput-color-*`,
`--zenput-radius-*`, `--zenput-shadow-*` variable to its semantic role,
plus a guarantee that names won’t change within a minor version.

**Why:** Light/dark parity work currently requires inspecting computed
styles to discover which variable backs a given visual property. Stable,
documented names let us map zenput → Tailwind v4 tokens in
`src/app/globals.css` confidently.

### FR-8 — Ship typed `axe-core` baselines or accessibility snapshots per component

**What:** Per-component a11y snapshot/test artifact published with the
package (e.g. `zenput/a11y/<component>.json`).

**Why:** Lets us assert in CI that integrating a zenput component into
`/admin/products` cannot regress axe rules the library itself already
guarantees, and clarifies which a11y wiring is our responsibility vs.
zenput's.

---

If/when any of FR-1..FR-8 ship, revisit this document and the corresponding
row in Section 2 (the Component opportunity map table) to promote the entry from "Conditional fit" / "Keep custom" to a
concrete Phase B/C/D migration task.
