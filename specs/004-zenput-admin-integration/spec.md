# Feature Specification: Zenput Admin Integration

**Feature Branch**: `004-zenput-admin-integration`
**Created**: 2025-07-16
**Status**: Draft
**Input**: User description: "Replace admin section form fields with zenput@1 package Library components. Also use the DataTable component from this library to display the product and order list."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Admin Creates or Edits a Product Using Standardised Form Fields (Priority: P1)

An admin opens the product form modal to create a new product or edit an existing one. Every field in the form — product name, description, price, stock quantity, category, and image upload — is rendered using the zenput@1 library components. Validation errors appear inline beneath the relevant field with a consistent visual style, using the library's built-in error state.

**Why this priority**: The product form is the most-used admin entry point for catalogue management. Standardising its fields on the shared library establishes the integration pattern all other forms will follow, and it unblocks the P2 and P3 stories.

**Independent Test**: Can be fully tested by opening the product form modal, submitting with invalid data, and verifying that all fields render the zenput style and that error messages appear inline beneath each field. Delivers a visibly consistent form with library-driven validation feedback.

**Acceptance Scenarios**:

1. **Given** the admin is on the Products admin page, **When** they click "Add Product" or "Edit" on an existing product, **Then** the product form modal opens with all fields (name, description, price, currency, stock, category, image) rendered as zenput@1 components.
2. **Given** the product form is open, **When** the admin submits the form with a missing required field, **Then** the corresponding zenput field displays an inline error message directly beneath it in the library's error style.
3. **Given** the product form is open with an existing product loaded, **When** the admin views the form, **Then** all pre-populated values appear correctly inside the zenput fields.
4. **Given** the product form is open, **When** the admin selects a file for the image field using the zenput FileInput, **Then** the selected file name is visible and the field behaves identically to the previous implementation.
5. **Given** the product form is open, **When** the admin selects a category from the zenput SelectInput, **Then** the dropdown options match the available categories and the selection is captured correctly.

---

### User Story 2 — Admin Creates or Edits a Product Variation Using Standardised Form Fields (Priority: P2)

An admin opens the variation form modal to add or edit a product variation (name, design name, variation type, price, stock, style reference, and image). All fields are rendered with zenput@1 components, and validation errors surface inline beneath the relevant field.

**Why this priority**: Variation management shares the same goals as product management but is a secondary workflow. Completing this story ensures full coverage of the admin form surface and applies the same library integration pattern consistently.

**Independent Test**: Can be fully tested by opening the variation form, submitting with invalid data, and confirming that all fields use zenput components and that inline errors appear per field.

**Acceptance Scenarios**:

1. **Given** the admin is editing a product and opens the variation modal, **When** the modal renders, **Then** all variation fields (name, design name, variation type, style selector, price, currency, stock, image) appear as zenput@1 components.
2. **Given** the variation form is open, **When** the admin submits with a blank required field, **Then** an inline error message appears beneath the offending zenput field.
3. **Given** the variation form is in "edit" mode, **When** the admin views the form, **Then** existing variation values are pre-populated into the zenput fields accurately.
4. **Given** the variation type is "styling", **When** the admin views the style selector, **Then** a zenput SelectInput lists available styles for selection.

---

### User Story 3 — Admin Views and Filters the Product List as a Data Table (Priority: P3)

Instead of a card grid, the Products admin page displays the product catalogue in a structured zenput DataTable. Each row shows key product attributes as columns. The admin can identify, scan, and act on products more efficiently than with the previous card layout.

**Why this priority**: The DataTable improves information density and scannability for large catalogues. It depends on the zenput library being integrated (P1 pattern) but does not depend on the form stories, so it can be developed in parallel once the library is available.

**Independent Test**: Can be fully tested by loading the Products admin page and verifying the DataTable renders with the expected columns, displays all fetched products as rows, and shows the empty-state message when no products exist.

**Acceptance Scenarios**:

1. **Given** the admin navigates to the Products page, **When** the products load successfully, **Then** they are displayed in a zenput DataTable with columns for at minimum: product name, category, price, stock count, and actions (edit / delete).
2. **Given** the Products DataTable is visible, **When** there are no products matching the current search, **Then** the table displays the library's configurable empty-state message.
3. **Given** the Products DataTable is visible, **When** the admin is on a paginated page, **Then** the existing pagination controls continue to function and the table reflects the current page's records.
4. **Given** the Products DataTable is visible, **When** the admin clicks the edit action for a row, **Then** the product form modal opens pre-populated with that product's data.

---

### User Story 4 — Admin Views and Filters the Order List as a Data Table (Priority: P4)

The Orders admin page replaces its card-based layout with a zenput DataTable. Each order appears as a row with columns for key order attributes. The status filter and search controls remain functional.

**Why this priority**: Mirrors the product list improvement (P3) for the orders workflow. It is lower priority because order management has an existing card UI that works acceptably, while the product grid benefits more immediately from tabular density.

**Independent Test**: Can be fully tested by loading the Orders admin page and confirming that orders render in a DataTable with the expected columns, the status filter narrows rows correctly, and the empty state appears when no orders are found.

**Acceptance Scenarios**:

1. **Given** the admin navigates to the Orders page, **When** orders load, **Then** they are displayed in a zenput DataTable with columns for at minimum: order ID, customer name, status, total amount, and order date.
2. **Given** the Orders DataTable is visible, **When** the admin selects a status filter, **Then** only orders matching that status appear in the table.
3. **Given** the Orders DataTable is visible, **When** there are no orders matching the current search or filter, **Then** the table shows the configured empty-state message.
4. **Given** the Orders DataTable is visible, **When** the admin is on a paginated page, **Then** the existing pagination controls continue to function correctly.
5. **Given** an order row is visible in the DataTable, **When** the admin clicks the "View" action for that row, **Then** the AdminOrderCard (or order detail route) opens, allowing the admin to update the order status and shipping details outside the table.

---

### Edge Cases

- What happens when the zenput library fails to load (e.g., network error or version mismatch)? The admin forms and list pages must not silently break; a clear error or fallback state must be presented.
- What happens when a DataTable receives an empty data array on initial load versus after a search that returns no results? Both states must display the configured `emptyMessage`.
- What happens when a form field receives a value type that does not match the zenput component's expectation (e.g., a non-numeric string passed to NumberInput)? The field must handle the mismatch gracefully without crashing.
- What happens when image file selection via zenput FileInput is cancelled mid-flow? The previously selected file state must be preserved (not cleared).
- What happens when the admin resizes the browser window while a DataTable is visible with many columns? Column layout must remain usable and not cause horizontal overflow that hides data silently.
- What happens when a validation error is present on a zenput field and the admin corrects the input? The error message must clear immediately on correction, not only on re-submit.

---

## Requirements _(mandatory)_

### Functional Requirements

**Form Field Replacement — Product Form**

- **FR-001**: The product creation and edit form MUST render the product name field using the zenput TextInput component with the `label`, `errorMessage`, `validationState`, `fullWidth`, and `required` props wired to the existing form state and validation logic.
- **FR-002**: The product description field MUST be replaced with the zenput TextArea component, preserving all existing label and error-display behaviour.
- **FR-003**: The product price field MUST be replaced with the zenput NumberInput component. The currency selector adjacent to the price field MUST be replaced with the zenput SelectInput component, with all existing currency options (INR, USD, EUR, GBP) available as selectable items.
- **FR-004**: The product stock quantity field MUST be replaced with the zenput NumberInput component with appropriate min/step constraints preserved.
- **FR-005**: The product category field MUST be replaced with the zenput SelectInput component, with all existing category options available as selectable items.
- **FR-006**: The primary product image upload field MUST be replaced with the zenput FileInput component, retaining the existing file-type and file-size constraints and the current-image preview when editing. Additional image rows (the AdditionalImageRow component) are out of scope and MUST remain as native inputs unchanged.

**Form Field Replacement — Variation Form**

- **FR-007**: The variation name field MUST be replaced with the zenput TextInput component.
- **FR-008**: The variation design name field MUST be replaced with the zenput TextInput component.
- **FR-009**: The variation type selector (originally a radio button group) MUST be replaced with the zenput SelectInput component offering the same "styling" and "colour" options. Note: this changes the UX from an always-visible radio group to a dropdown; accepted per requirement to use zenput components for all form fields.
- **FR-010**: The style reference selector (shown when variation type is "colour") MUST be replaced with the zenput SelectInput component, listing available styles.
- **FR-011**: The variation price field MUST be replaced with the zenput NumberInput component. The currency selector adjacent to the price field MUST be replaced with the zenput SelectInput component, with all existing currency options available.
- **FR-012**: The variation stock field MUST be replaced with the zenput NumberInput component.
- **FR-013**: The variation image upload field MUST be replaced with the zenput FileInput component, retaining the file-type and file-size constraints. Additional image rows (the AdditionalImageRow component) are out of scope and MUST remain as native inputs unchanged.

**Validation & Error Display**

- **FR-014**: Every zenput form component MUST receive the `validationState` prop set to `'error'` when its corresponding field has a validation error, and `'default'` otherwise.
- **FR-015**: Every zenput form component MUST receive the `errorMessage` prop populated with the specific validation error text when `validationState` is `'error'`.
- **FR-016**: Validation error display MUST remain consistent with the existing validation triggers (on submit and, where currently implemented, on blur or change).

**DataTable — Products List**

- **FR-017**: The Products admin page MUST replace the existing card grid with a zenput DataTable component.
- **FR-018**: The Products DataTable MUST define columns for at minimum: product name, category, price (formatted via the existing currency formatter), stock quantity, and an actions column with edit and delete controls.
- **FR-019**: The Products DataTable MUST receive the currently fetched page of products as its `data` prop, with each product mapped to the column key structure.
- **FR-020**: The Products DataTable MUST display the `emptyMessage` configured for the case where no products are found (either on initial load or after search).
- **FR-021**: The existing search input, cursor-based pagination controls, and total-count display MUST remain functional and visually available alongside the DataTable.

**DataTable — Orders List**

- **FR-022**: The Orders admin page MUST replace the existing AdminOrderCard-first list layout with a zenput DataTable component while retaining AdminOrderCard as the order detail and editing surface.
- **FR-023**: The Orders DataTable MUST define columns for at minimum: order ID, customer name, order status, total amount (formatted via the existing currency formatter), and order date. Each row MUST provide a way to reveal the related AdminOrderCard from the table context, such as row expansion or an equivalent view action.
- **FR-024**: The Orders DataTable MUST receive the currently fetched page of orders as its `data` prop.
- **FR-025**: The Orders DataTable MUST display the `emptyMessage` configured for the case where no orders are found.
- **FR-026**: The existing status filter, search input, and cursor-based pagination controls MUST remain functional alongside the DataTable.
- **FR-027**: Order status updates and shipping detail edits MUST continue to be performed via the AdminOrderCard. In the Orders DataTable flow, the AdminOrderCard is retained and may be revealed inline for a row (for example, via row expansion) rather than only through a separate "View" action or route. The AdminOrderCard layout is NOT removed from the codebase; it remains the canonical order detail and editing UI.

**General**

- **FR-028**: No existing form submission logic, API calls, Redux dispatches, or data-fetching hooks MUST be modified as part of this change — only the rendered UI elements are replaced.
- **FR-029**: All replaced components MUST maintain full keyboard accessibility and screen-reader compatibility consistent with the existing admin interface.
- **FR-030**: The visual appearance of the admin forms and list pages after migration MUST be verified with Playwright before completion.

### Key Entities

- **zenput Form Component**: A UI input widget (TextInput, TextArea, NumberInput, SelectInput, FileInput) from the zenput@1 library. Accepts `label`, `errorMessage`, `validationState` (`'error'` | `'default'`), `fullWidth`, and `required` props alongside the standard input value/onChange contract.
- **zenput DataTable**: A table component from the zenput@1 library. Accepts a `columns` array of `DataTableColumn` descriptors (each with `key`, `header`, optional `filterable`, optional `render`, optional `width`) and a `data` array of records. Optionally accepts `rowKey` for stable row identity and `emptyMessage` for the zero-records state.
- **Product**: An admin-managed catalogue item with name, description, price, stock quantity, category, and primary + additional image assets.
- **ProductVariation**: A child record of a Product representing a purchasable variant, with its own name, design name, variation type, style reference, price, stock, and image assets.
- **AdminOrder**: An order record visible in the admin interface, containing customer details, line items, status, total amount, tracking number, and shipping provider.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All admin form fields in the product and variation modals are rendered exclusively by zenput@1 components — zero custom-styled native `<input>`, `<textarea>`, or `<select>` elements remain in those forms, **with the sole exception** of AdditionalImageRow native inputs which are out of scope for this migration.
- **SC-002**: Inline validation errors appear beneath each zenput field within 300 ms of a failed form submission, with no regression in the error-message content compared to the current behaviour.
- **SC-003**: The Products admin page renders the product list as a DataTable; the existing card grid is no longer present.
- **SC-004**: The Orders admin page renders the order list as a read-only zenput DataTable; the inline card-based list view is replaced. The AdminOrderCard component is retained and remains the editing interface for order status and shipping details, accessed via the "View" action in the DataTable.
- **SC-005**: All existing admin workflows — create product, edit product, delete product, create variation, edit variation, update order status, save shipping details — complete successfully end-to-end after the migration, verified by Playwright tests.
- **SC-006**: Admin page load time (time to interactive for the Products and Orders pages) does not increase by more than 10% compared to the baseline before migration.
- **SC-007**: The migrated admin forms and tables pass the existing accessibility requirements: all interactive zenput components are keyboard-navigable and labelled correctly for screen readers.
- **SC-008**: No existing unit or integration tests fail as a result of this change, and test coverage for the modified components does not decrease.

---

## Assumptions

- **A-001**: The zenput@1 package is already published to npm and can be installed as a standard dependency without private registry configuration.
- **A-002**: The zenput form components accept a standard React controlled-input contract (value + onChange) compatible with the existing `useProductForm` and form-state hooks.
- **A-003**: zenput DataTable's `data` prop accepts objects whose values are `string | number | boolean | null | undefined`; the existing Product and AdminOrder data shapes are compatible or can be mapped with a lightweight adapter without touching API or store logic.
- **A-004**: The zenput library's built-in styles do not conflict with the project's Tailwind CSS v4 setup; any necessary style isolation is handled at the component boundary.
- **A-005**: Additional image rows in the product and variation forms (which have their own custom UI) are out of scope for this migration and will retain their current implementation.
- **A-006**: The AdminOrderCard is **retained** for editing. The Orders DataTable is strictly read-only (order ID, customer name, status, total, date). A "View" action button in the actions column opens the AdminOrderCard (or navigates to an order detail route) where the admin edits status and shipping details. No inline row editing or expanded-row editing is implemented in the DataTable.
- **A-007**: The currency selector that sits alongside the price field in both forms MUST be replaced with a zenput SelectInput component, consistent with the requirement that all form controls use zenput components. The currency options (INR, USD, EUR, GBP) are mapped to `SelectOption[]` format.

---

## Clarifications

### Session 2026-04-05

- Q: For the Orders DataTable — should inline order edits (status change, shipping fields) be shown via a `render()` callback on DataTable columns, or should the table be read-only with AdminOrderCard retained for editing? → A: Orders DataTable is READ-ONLY (columns: id, customer, total, status, date). AdminOrderCard is retained and accessed via a "View" action column in the table (or linked to a detail route). No inline editing occurs in the table.
- Q: Should additional image rows (AdditionalImageRow component) be migrated to zenput FileInput, or remain as native inputs? → A: AdditionalImageRow components remain as-is using native inputs. Zenput FileInput replaces the primary image field only (product and variation).
- Q: Should the currency selector beside price fields be replaced with a zenput component, or stay as a native `<select>`? → A (revised per new requirement 2026-04-05): Currency selector MUST be replaced with zenput SelectInput. All form controls — including the currency selector — use zenput components. No native `<select>` elements remain in the product or variation forms.
