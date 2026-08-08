# Feature Specification: Admin Console Revamp

**Feature Branch**: `024-admin-console-revamp`  
**Created**: 2026-08-08  
**Status**: Draft  
**Input**: User description: "A complete revamp of the admin console (`/admin/*`) targeting three outcomes: better user experience, simplicity, and trackability. This is a UX/architecture revamp of existing surfaces — not a rewrite of business logic. Existing permission model, audit table, and API routes stay; the presentation and interaction layer is unified."

## Overview

The admin console has grown one page at a time. Every list screen re-invents its own search box, filter row, pagination, table layout, empty state, and error state. Creating or editing a record happens in a modal on one screen, a full page on another, and inline on a third. Destructive actions are confirmed inconsistently — or not at all. Bulk operations and CSV exports exist as backend capabilities with no way for a staff member to reach them. Every mutating action is already written to an audit log that no human can read.

This feature unifies the presentation and interaction layer of the admin console around a small number of shared, declarative surfaces, and makes the existing audit trail visible. It changes how staff see and operate the system; it does not change what the system is allowed to do.

**Explicit non-goal**: this specification does not re-open decisions made in `004-zenput-admin-integration`. That work is a dependency and an overlapping surface. Where the two touch, this feature adopts whatever component foundation that effort lands on rather than proposing an alternative.

## Clarifications

### Session 2026-08-08

- Q: What retention and archival policy applies to admin activity records? (FR-D12) → A: A fixed 24-month window with hard deletion after expiry; no cold-storage archive.
- Q: What is the disposition of the `/admin/checkout-requests` and `/admin/recommendations` screens? (FR-E07) → A: Both are retained, each with a stated purpose, and both move under the operations grouping.
- Q: Are saved views private or shared, and where are they persisted? (Key entities / Saved view) → A: Private to the creating user and persisted server-side, plus a set of built-in shared defaults that ship with the product.
- Q: Does the revamp ship big-bang or as an incremental migration? → A: Incremental, resource by resource, with the shared surfaces landing first; each converted screen replaces its predecessor on conversion.
- Q: Must retired admin addresses keep working? → A: Yes — every retired admin address permanently redirects to its survivor, indefinitely.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Fulfilment staff clear the day's order queue (Priority: P1)

Priya works in fulfilment. Her permissions let her read and update orders and read products; she cannot touch users, coupons, or refunds.

She opens the console and lands on a dashboard that leads with work, not revenue: "18 orders awaiting fulfilment", "4 items below reorder threshold". She clicks into the orders queue. The list opens pre-filtered to orders needing action. She narrows further by date and shipping method using the same filter controls she has already seen on every other list in the console. She ticks the checkboxes for eleven orders that ship together, and a bulk action bar rises from the bottom of the screen offering only the actions she is permitted to perform — "Mark as shipped" is offered, "Issue refund" is not. She applies it once, confirms, and watches a progress indicator report eleven succeeded. She exports the day's remaining queue to CSV for the packing station and sees the export's progress and completion rather than a silent download.

Nowhere in her session does she see a navigation link, a row action, or a bulk action she is not allowed to use.

**Why this priority**: Order handling is the highest-frequency, highest-volume admin activity, and it is where the absence of bulk selection costs the most staff time today. It is also the safest slice to ship first because the bulk endpoints already exist and no permission semantics change.

**Independent Test**: Sign in as a `FULFILMENT` user, complete an eleven-order status change end to end starting from the dashboard, and confirm the actions offered are exactly the permitted set. Delivers measurable time savings without any other story shipping.

**Acceptance Scenarios**:

1. **Given** a `FULFILMENT` user with orders awaiting action, **When** they open the admin console, **Then** the dashboard's primary content is a set of actionable queues with counts, and each queue links to a pre-filtered list.
2. **Given** an order list, **When** the user selects multiple rows, **Then** a bulk action toolbar appears showing the count of selected rows and only the bulk actions their permissions allow.
3. **Given** a bulk action is applied to N rows, **When** it completes, **Then** the user sees how many succeeded and how many failed, with a per-row reason for each failure, and the list reflects the new state without a full page reload.
4. **Given** a bulk action partially fails, **When** the user reviews the result, **Then** the successful rows remain applied and the failed rows are individually retryable.
5. **Given** a `FULFILMENT` user, **When** they view any admin screen, **Then** no navigation entry, row action, or bulk action is rendered for a permission they do not hold.
6. **Given** the user triggers a CSV export, **When** the export is running, **Then** progress is visible and both success and failure are reported in the interface rather than only as a browser download event.

---

### User Story 2 — Support agent investigates a disputed order (Priority: P1)

Raj works in support. A customer claims their order total changed after they placed it.

Raj searches the order by its short ID from anywhere in the console using the command palette. On the order detail screen he finds an activity panel listing every administrative change to that order in reverse chronological order: who changed it, when, and what changed from what to what. He sees a price adjustment made two days ago by a named colleague. He has enough to answer the customer without asking anyone.

Later he needs to know whether the same colleague made similar adjustments elsewhere. He opens the global activity view and filters by actor and action type across a date range.

**Why this priority**: The audit data already exists and is completely inaccessible. Making it visible converts an existing invisible asset into the console's single largest trust and support improvement, and it unblocks incident investigation that currently requires direct database access.

**Independent Test**: Perform a mutating admin action, then confirm it appears both in the entity's activity panel and in the global activity view with correct actor, timestamp, action, and before/after values. Delivers value with no other story shipping.

**Acceptance Scenarios**:

1. **Given** an order, product, or user detail screen, **When** the viewer holds the permission to read that entity, **Then** an activity panel shows that entity's administrative change history, newest first, paginated.
2. **Given** a recorded change, **When** it is displayed, **Then** it shows the acting person's identity, their role at the time of the action, the timestamp, the action performed, and a human-readable before/after for each changed field.
3. **Given** the global activity view, **When** the viewer applies filters for entity type, action, actor, and date range, **Then** the results reflect all applied filters together.
4. **Given** any mutating admin operation completes successfully, **When** the activity surface is queried, **Then** a corresponding record exists.
5. **Given** a mutating admin operation fails, **When** the activity surface is queried, **Then** no record claiming a successful change exists for it.
6. **Given** a viewer without permission to read an entity type, **When** they open the global activity view, **Then** records for that entity type are not returned to them.

---

### User Story 3 — Administrator maintains the catalogue and the team (Priority: P2)

Meera is a full administrator. She adds a seasonal product, edits an existing one, adjusts a category, creates a coupon, and promotes a colleague to support.

Every one of those tasks now follows the same shape. Simple records open in a focused overlay; records with many fields or nested structure open as a dedicated screen; nothing is edited inline in a table row any more. Validation errors appear in the same place, in the same form, on every screen. If she navigates away with unsaved changes she is warned once, consistently.

When she changes a colleague's role, she is asked to confirm an action described in plain language. When she attempts to remove her own administrator rights, the console refuses.

**Why this priority**: Form and confirmation consistency reduces error rate and training cost, but it affects lower-frequency tasks than order handling and depends on the shared surfaces landing first.

**Independent Test**: Create and edit one record of each supported type and confirm identical validation, dirty-state, and save/cancel behaviour across all of them.

**Acceptance Scenarios**:

1. **Given** any admin create or edit task, **When** it is opened, **Then** its presentation follows a single documented rule based on the record's complexity, not on which screen the user came from.
2. **Given** a form with invalid input, **When** the user attempts to save, **Then** field-level errors appear adjacent to the offending fields and a summary states how many fields need attention, in the same manner on every admin form.
3. **Given** a form with unsaved changes, **When** the user attempts to close it or navigate away, **Then** they are warned and can choose to discard or return.
4. **Given** any destructive or irreversible action, **When** it is triggered, **Then** a confirmation states the specific entity affected, the consequence, and whether it can be undone.
5. **Given** a high-risk action — refund, role change, or bulk delete — **When** it is confirmed, **Then** the user must type a specific confirmation value before the action can proceed.
6. **Given** an administrator viewing their own account, **When** they attempt to reduce their own role or remove their own administrative permissions, **Then** the action is refused with an explanation, both in the interface and if the request reaches the server directly.

---

### User Story 4 — Any staff member finds their way around (Priority: P2)

A new starter opens the console for the first time. Navigation is grouped by what the groups are for — day-to-day commerce operations, catalogue, people, and system operations — rather than by the order in which screens happened to be built. There is no screen that duplicates another. Screens whose purpose is opaque are either given a clear name and stated purpose or removed. The command palette reaches every screen the user is permitted to open, and nothing else.

**Why this priority**: Information architecture cleanup makes the other stories discoverable, but delivers less standalone value than the queue and activity work.

**Independent Test**: Ask a person unfamiliar with the console to locate five named capabilities; measure success rate and time without assistance.

**Acceptance Scenarios**:

1. **Given** the admin navigation, **When** it is rendered for a user, **Then** every entry it contains resolves to a screen that user is permitted to open.
2. **Given** two screens presenting the same data and actions, **When** the revamp is complete, **Then** only one remains and the other's address redirects to it.
3. **Given** any admin screen, **When** it is opened, **Then** breadcrumbs describe its position in the grouping and the screen states its purpose.
4. **Given** the command palette, **When** a user searches, **Then** results are restricted to destinations and actions permitted to that user.

---

### Edge Cases

- A bulk action is applied to a selection that spans more pages than are currently loaded — the system must be unambiguous about whether "select all" means the loaded page or the entire filtered result set, and must state which it applied.
- A bulk action's selection becomes stale because another administrator changed some of the rows between selection and confirmation.
- A bulk action is applied to a very large selection and exceeds the time budget of a single request.
- Two administrators edit the same record concurrently and both save.
- A user's permissions are revoked while they have an admin screen open, and they then submit a mutation.
- An administrator attempts self-demotion by calling the underlying endpoint directly, bypassing the interface.
- The last remaining administrator attempts to demote themselves or another administrator.
- An activity record's referenced entity is later deleted — the change history must remain readable.
- A mutation succeeds but writing its activity record fails.
- An entity's change history is large enough that rendering it whole would be slow.
- A CSV export's result set is large enough that it cannot complete within a single request.
- A CSV import file contains a mixture of valid and invalid rows.
- A list is filtered to a state that yields no results, versus a list whose underlying resource genuinely has no records — these must be visually distinguishable and must offer different next actions.
- A list fails to load entirely, versus a list that loads but whose row action fails.
- A screen is used on a narrow viewport where a wide table cannot be shown.
- A form is opened for a record that is deleted by someone else before it is saved.

## Requirements _(mandatory)_

### Functional Requirements

#### A. Unified admin list surface

- **FR-A01**: Every admin screen that presents a collection of records MUST be rendered through a single shared list surface rather than bespoke per-screen table wiring.
- **FR-A02**: The list surface MUST be declared per resource — its columns, filters, sort options, row actions, and bulk actions expressed as configuration rather than assembled from scratch.
- **FR-A03**: The list surface MUST provide free-text search where the underlying resource supports it, with consistent placement, behaviour, and input debouncing across all resources.
- **FR-A04**: The list surface MUST provide filtering, and applied filters MUST be visible as individually removable indicators with a single control to clear all of them.
- **FR-A05**: The list surface MUST provide column sorting on resources that support it, with the active sort visibly indicated.
- **FR-A06**: The list surface MUST paginate using the existing cursor-based approach and MUST preserve search, filter, and sort state across pagination.
- **FR-A07**: The list surface's current search, filter, sort, and pagination state MUST be reflected in the screen's address so it can be bookmarked, shared, and restored on reload.
- **FR-A08**: The list surface MUST support row selection, including select-all-on-page, and MUST display the number of selected rows.
- **FR-A09**: When rows are selected, the list surface MUST present a bulk action toolbar containing only actions the current user is permitted to perform on the selected resource.
- **FR-A10**: Bulk action results MUST report per-row outcome, distinguishing succeeded from failed rows and giving a reason for each failure.
- **FR-A11**: The list surface MUST present distinct, purposeful states for loading, empty-because-no-records, empty-because-filtered, and failed-to-load. The failed state MUST offer a retry.
- **FR-A12**: The list surface MUST expose a CSV export control for resources with an export capability, and MUST surface the export's progress, completion, and failure.
- **FR-A13**: The list surface MUST adapt to narrow viewports without loss of any action available on a wide viewport.
- **FR-A14**: Row actions MUST be filtered by the current user's permissions; an action the user cannot perform MUST NOT be rendered.
- **FR-A15**: The products, orders, users, reviews, coupons, categories, and email-failures screens MUST all conform to this surface.
- **FR-A16**: The system MUST make explicit, in the interface, whether a bulk action applies to the currently loaded page or to the entire filtered result set, and MUST require the user to opt into the latter.
- **FR-A17**: The list surface MUST allow a user to save the current combination of search text, filters, and sort as a named saved view, and to recall it in a single interaction.
- **FR-A18**: A user-created saved view MUST be private to the user who created it. It MUST NOT be visible to, editable by, or deletable by any other user, regardless of that user's permissions.
- **FR-A19**: Saved views MUST be persisted server-side and bound to the owning user, so that they are available to that user from any device and survive clearing of local browser state.
- **FR-A20**: A set of built-in saved views MUST ship with the product, shared across all staff, read-only, and visible only to users holding the permission required by the underlying resource.
- **FR-A21**: A saved view MUST be evaluated against the viewer's permissions at the time it is opened; it MUST NOT expose records the viewer is not permitted to read.

#### B. Unified form surface

- **FR-B01**: The console MUST define exactly one canonical create/edit pattern, and every admin create and edit task MUST use it.
- **FR-B02**: A single documented rule MUST determine whether a given form is presented as an overlay or as a dedicated screen, based on properties of the record rather than on the screen the user arrived from.
- **FR-B03**: Inline editing within a table row MUST be eliminated as a create/edit pattern.
- **FR-B04**: Validation errors MUST be presented identically on every admin form: adjacent to the offending field, with a summary of how many fields require attention.
- **FR-B05**: Every admin form MUST guard against loss of unsaved changes when closing or navigating away.
- **FR-B06**: Every admin form MUST present save and cancel affordances in a consistent position with consistent labelling, and MUST prevent duplicate submission while a save is in flight.
- **FR-B07**: A form MUST report server-side rejection distinctly from client-side validation failure, and MUST retain the user's entered values in both cases.
- **FR-B08**: A form whose target record was modified or deleted by another user since it was opened MUST tell the user rather than silently overwriting or silently failing.

#### C. Unified confirmation of consequential actions

- **FR-C01**: The console MUST provide a single confirmation primitive used by every destructive, irreversible, or high-consequence action.
- **FR-C02**: A confirmation MUST name the specific entity or entities affected, state the consequence, and state whether the action can be reversed.
- **FR-C03**: High-risk actions — refunds, role changes, and bulk deletions — MUST require the user to type a specific confirmation value before proceeding.
- **FR-C04**: The system MUST refuse any attempt by a user to reduce their own role or remove their own administrative permissions, and MUST enforce this on the server independently of the interface.
- **FR-C05**: The system MUST refuse any change that would leave the platform with no user holding full administrative permissions.
- **FR-C06**: A confirmation MUST NOT be the only safeguard for an action that is enforced server-side; server-side authorisation remains authoritative.
- **FR-C07**: The outcome of a confirmed action MUST be reported to the user — success, failure with reason, or partial success.

#### D. Trackability

- **FR-D01**: Every mutating admin operation MUST record an activity entry. Coverage MUST be complete across all admin mutation endpoints, with no exceptions.
- **FR-D02**: An activity entry MUST capture the acting user, their role at the time of the action, the entity type, the entity identifier, the action performed, a structured before/after change set, and the time of the action.
- **FR-D03**: The change set MUST follow one consistent shape across all entity types so it can be rendered by a single presentation.
- **FR-D04**: The console MUST provide a global activity view listing all recorded activity, newest first, with cursor pagination.
- **FR-D05**: The global activity view MUST support filtering by entity type, action, acting user, and date range, applied in combination.
- **FR-D06**: Order, product, and user detail screens MUST each present that entity's own activity history.
- **FR-D07**: Activity entries MUST remain readable after their referenced entity is deleted.
- **FR-D08**: Activity entries MUST be immutable — no admin surface may edit or delete them. The scheduled expiry process in FR-D13 is the only mechanism permitted to remove an entry.
- **FR-D09**: Access to the global activity view MUST be permission-gated, and results MUST be restricted to entity types the viewer is permitted to read.
- **FR-D10**: A failure to record an activity entry MUST NOT cause the underlying operation to fail, but MUST be reported to operational monitoring.
- **FR-D11**: The change set MUST NOT contain credentials, password material, or payment instrument data.
- **FR-D12**: Activity entries MUST be retained for 24 months from the time of the action, after which they MUST be permanently deleted. No archival copy is retained beyond that window.
- **FR-D13**: Expiry MUST be enforced by an automated, scheduled process rather than by manual intervention, and the deletion of expired entries MUST itself be reported to operational monitoring.
- **FR-D14**: The global activity view MUST make the retention window explicit to the viewer, so that the absence of records older than the window is understood as expiry rather than as missing data.

#### E. Information architecture

- **FR-E01**: Admin navigation MUST be organised into coherent groups reflecting the work being done, and every screen MUST belong to exactly one group.
- **FR-E02**: Navigation MUST be permission-accurate — no entry may be shown to a user who cannot open its destination.
- **FR-E03**: Duplicate screens presenting the same data and actions MUST be reduced to one, with the retired address redirecting to the survivor.
- **FR-E04**: The screen currently at `/admin/sales` MUST be retired in favour of the dashboard.
- **FR-E05**: Operational and maintenance screens — search reindexing, email failures, checkout requests, recommendations, and equivalent — MUST be grouped together under a clearly labelled operations grouping rather than sitting alongside commerce screens.
- **FR-E06**: Every admin screen MUST state its purpose, so that no screen's function has to be inferred from its data.
- **FR-E07**: Screens whose purpose cannot be justified MUST be removed rather than relabelled. The checkout-requests and recommendations screens are both retained, because each is the only interface to an operational capability that has no equivalent elsewhere.
- **FR-E07a**: The checkout-requests screen is retained under the operations grouping. Its stated purpose is triage of in-flight and failed checkout attempts and the stock reservations they hold, including release of a reservation that is stuck.
- **FR-E07b**: The recommendations screen is retained under the operations grouping. Its stated purpose is reporting the state of the product-affinity scoring job — coverage, freshness, and thresholds — and triggering a recomputation outside its schedule.
- **FR-E10**: Every admin address retired by this feature — whether removed, merged, or renamed — MUST permanently redirect to its survivor. The redirect MUST remain in place indefinitely; no retired admin address may return a not-found response.
- **FR-E08**: The command palette MUST reach every screen and quick action the current user is permitted to use, and MUST NOT surface any they are not.
- **FR-E09**: Breadcrumbs MUST reflect the navigation grouping consistently on every screen.

#### F. Data-fetching policy

- **FR-F01**: The console MUST adopt a single documented rule determining, for any given admin screen, whether it is server-rendered with direct data access or client-driven through the console's own interface layer.
- **FR-F02**: A single screen MUST NOT mix both approaches for the same data.
- **FR-F03**: Screens presenting per-request, user-specific, or permission-sensitive data MUST be treated as per-request and MUST NOT be served from a shared cache.
- **FR-F04**: Every screen MUST be reachable through the documented rule without route-segment configuration that the platform's rendering model forbids.
- **FR-F05**: Interactive state that exists only for one screen MUST remain local to that screen and MUST NOT be promoted to shared application state.
- **FR-F06**: Client-driven screens MUST reach data only through the console's own interface layer, never by ad-hoc direct calls.

#### G. Dashboard

- **FR-G01**: The dashboard's primary content MUST be work requiring attention, not aggregate performance figures.
- **FR-G02**: The dashboard MUST present actionable queues including at minimum: orders awaiting action, stock below threshold, failed customer emails, reviews awaiting moderation, and refunds in progress.
- **FR-G03**: Each queue MUST show a current count and MUST link to the corresponding list pre-filtered to exactly that queue.
- **FR-G04**: The dashboard MUST only present queues relevant to the viewer's permissions.
- **FR-G05**: Aggregate performance figures MUST remain available to users holding analytics permission, presented secondary to the actionable queues.
- **FR-G06**: A queue whose data cannot be loaded MUST fail in isolation without preventing the remaining queues from rendering.
- **FR-G07**: Queue counts MUST reflect the state at the time the screen was requested, and the screen MUST indicate the time the data was current as of.

#### H. Accessibility and responsiveness

- **FR-H01**: Every admin surface MUST be operable entirely by keyboard, including list selection, bulk actions, forms, confirmations, and the command palette.
- **FR-H02**: Overlays and confirmations MUST trap focus while open, restore focus to their trigger on close, and close on the escape key.
- **FR-H03**: Every interactive control MUST have an accessible name, and controls without visible text MUST carry an explicit label.
- **FR-H04**: Asynchronous state changes — loading, saving, bulk progress, success, and failure — MUST be announced to assistive technology.
- **FR-H05**: Every admin surface MUST meet WCAG 2.1 Level AA, including colour contrast, in both available themes.
- **FR-H06**: Every admin surface MUST be usable on viewports down to 375 pixels wide with no loss of function and no horizontal scrolling of the page.
- **FR-H07**: Interactive behaviour MUST be attached to natively interactive elements rather than to generic containers carrying compensating roles.

#### I. Rollout and migration

- **FR-I01**: The revamp MUST be delivered incrementally, resource by resource, rather than as a single simultaneous replacement of the console.
- **FR-I02**: The shared list, form, and confirmation surfaces MUST land before the screens that consume them; no screen may be migrated onto a surface that does not yet exist.
- **FR-I03**: A migrated screen MUST replace its predecessor at the moment of migration. Two implementations of the same screen MUST NOT be reachable at the same time, and the console MUST NOT require a runtime toggle to choose between them.
- **FR-I04**: At every point during the migration the console MUST remain fully functional, with unmigrated screens continuing to work unchanged alongside migrated ones.
- **FR-I05**: The completion criteria in Success Criteria are measured against the end state of the migration, not against any intermediate release.

### Non-Functional Requirements

- **NFR-001**: An admin list screen MUST begin rendering meaningful content within 1 second at the 75th percentile under normal production conditions.
- **NFR-002**: Applying a search, filter, sort, or page change on a list MUST present updated results within 1 second at the 75th percentile, and MUST show an in-progress indication within 100 milliseconds.
- **NFR-003**: Any user interaction on an admin surface MUST produce a visible response within 200 milliseconds.
- **NFR-004**: An admin list MUST remain responsive when presenting a result set drawn from at least 100,000 underlying records.
- **NFR-005**: A bulk action applied to the maximum permitted selection size MUST either complete within the request budget or be executed as a tracked background job with observable progress. The maximum synchronous selection size MUST be documented and enforced.
- **NFR-006**: No mutating admin action may complete without a corresponding activity record — audit coverage of mutating admin endpoints MUST be 100%.
- **NFR-007**: The global activity view MUST return its first page within 1 second at the 75th percentile against a full 24-month retention window of accumulated records.
- **NFR-008**: All admin surfaces MUST pass automated accessibility checks with zero violations at WCAG 2.1 AA.
- **NFR-009**: The revamp MUST NOT increase the number of database round trips required to render any existing admin screen.
- **NFR-010**: The revamp MUST NOT weaken any existing server-side authorisation check; permission enforcement remains server-authoritative regardless of what the interface renders.

### Key Entities

- **Admin activity record**: An immutable record of one administrative change. Holds the acting user, that user's role at the time, the entity type, the entity identifier, the action, a structured change set of before and after values, and the time of the action. Already exists in the data model and is already written by mutating operations; this feature makes it complete, consistently shaped, and readable. It survives deletion of the entity it refers to.
- **Resource list definition**: The declarative description of how one resource is presented as a list — its columns, available filters, sort options, row actions, bulk actions, export capability, and the permission each of those requires. One definition per resource; consumed by the shared list surface.
- **Saved view**: A named, reusable combination of search text, filters, and sort for a resource, so that recurring work such as "orders awaiting fulfilment today" is one interaction rather than several. Carries its owner, the resource it applies to, and its stored criteria. A user-created saved view is private to its owner and persisted server-side, so it follows that person across devices and is invisible to everyone else. A separate set of built-in saved views ships with the product, is shared across all staff, is read-only, and is shown only to users permitted to read the underlying resource. Every saved view is evaluated against the viewer's permissions when opened.
- **Bulk operation**: A single user-initiated action applied to a selection of records. Carries the resource type, the action, the target selection, the initiating user, a per-row outcome, and — where it exceeds the synchronous budget — an observable progress and completion state.
- **Actionable queue**: A named collection of records requiring staff attention, defined by a resource plus a filter, carrying a current count and the permission needed to see it. The dashboard is composed of these.

## Assumptions

- The role and permission model is fixed. The four existing roles and eleven existing permission strings are used as-is; this feature adds no new permission except any gate required for the activity view, and any such gate reuses an existing permission where one fits.
- Existing admin endpoints and their contracts remain. Where one is extended — for example to return a page of activity — the extension is additive and does not break existing consumers.
- The existing audit table is structurally sufficient. Any schema change required is additive: new indexes, or nullable columns to support filtering and denormalised actor display. No destructive migration.
- Persisting saved views requires new storage that does not exist today. It is additive — a new owner-scoped store — and touches no existing table.
- Deleting activity entries at the end of the 24-month retention window is the one intentional exception to the immutability rule in FR-D08. Expiry is a scheduled system process; it is not an admin-surface capability, and no admin surface may delete an entry ahead of its expiry.
- Bulk product and bulk order endpoints already exist and are the mechanism behind the new bulk toolbar; no new bulk capability is introduced beyond exposing what already exists.
- CSV export and import endpoints already exist and are the mechanism behind the new export and import surfacing.
- The component foundation from the in-progress admin component integration effort is the substrate for the shared surfaces. This feature consumes it and does not propose a competing one.
- Staff use modern evergreen browsers; no legacy browser support is required for the console.
- The console is English-only for this revamp; no internationalisation work is included.
- Analytics figures already computed for the current dashboard remain available and are relocated, not recomputed.
- "Complete audit coverage" is measured against admin mutation endpoints only; customer-initiated mutations on the storefront are out of scope.

## Out of Scope

- Any change to storefront surfaces or customer-facing behaviour.
- New business capabilities — no new payment, shipping, loyalty, or promotional mechanics.
- Changes to the role and permission model itself; role names and permission strings are unchanged.
- Replacing the data access layer, the shared state library, or the admin component library.
- Multi-tenant, multi-store, or admin-organisation features.
- Any database schema change beyond additive columns and indexes required by the activity surface, and the new storage required to persist saved views.
- Rewriting the business logic behind any admin operation; only its presentation and confirmation change.
- Re-litigating decisions already made in the in-progress admin component integration effort.
- New analytics or reporting capabilities beyond relocating what already exists.
- Changes to authentication, session handling, or the edge authorisation gate.

## Dependencies

- The in-progress admin component integration effort, whose component foundation the shared list and form surfaces build upon. Its completion state determines the sequencing of the surfaces in this feature.
- Existing bulk, export, and import endpoints, which must remain available and behaviourally stable.
- The existing audit recording helper and its call sites, which are extended to reach complete coverage.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of admin list screens are rendered through the shared list surface, with zero screens retaining bespoke table, search, filter, or pagination wiring.
- **SC-002**: Screen-specific list presentation code is reduced by at least 60% relative to the pre-revamp baseline, measured across all list screens.
- **SC-003**: 100% of admin create and edit tasks use the single canonical form pattern, and zero create/edit tasks use inline row editing.
- **SC-004**: 100% of destructive, irreversible, and high-consequence actions route through the shared confirmation primitive, and 100% of refunds, role changes, and bulk deletions require typed confirmation.
- **SC-005**: 100% of mutating admin operations produce an activity record, verified by an automated check that fails if any mutating admin endpoint lacks one.
- **SC-006**: A support agent can determine who last changed a given order, when, and what changed, in under 30 seconds from the console's entry point, without direct database access.
- **SC-007**: Applying the same status change to 20 orders takes at most 5 interactions, down from at least 40 today.
- **SC-008**: The number of distinct navigation destinations is reduced by at least 15%, with zero duplicate and zero unexplained screens remaining.
- **SC-009**: A person unfamiliar with the console locates 5 named capabilities unaided, with a success rate of at least 90% and a median time under 30 seconds each.
- **SC-010**: Zero navigation entries, row actions, or bulk actions are rendered for permissions the viewing user does not hold, verified per role by automated test.
- **SC-011**: Automated accessibility checks report zero WCAG 2.1 AA violations across every admin surface, in both themes.
- **SC-012**: Every admin task can be completed end to end using only a keyboard, verified for the primary journey of each role.
- **SC-013**: Admin list screens present meaningful content within 1 second at the 75th percentile, and list interactions update within 1 second at the 75th percentile.
- **SC-014**: Every admin list screen is fully usable at 375 pixels wide with no loss of function.
- **SC-015**: Every admin list screen and form presents purposeful loading, empty, filtered-empty, and error states, with zero screens showing a blank region or an unhandled failure.
- **SC-016**: Self-demotion and last-administrator removal are refused in 100% of attempts, including attempts that bypass the interface.
- **SC-017**: 100% of admin addresses retired by the revamp resolve to their survivor by redirect; zero retired admin addresses return a not-found response.
- **SC-018**: Zero saved views created by one user are visible to any other user, verified by automated test across every role pairing.
- **SC-019**: Zero activity entries older than 24 months are present in the live activity store, verified by an automated check.
- **SC-020**: At every release during the migration the console is fully functional, with zero screens rendered unreachable or broken by a partially completed migration.

## Deferred Decisions

None. All decisions previously marked for clarification were resolved in the 2026-08-08 clarification session recorded above.
