# Feature Specification: Admin Product Variation Management

**Feature Branch**: `002-admin-variation-management`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: User description: "We have added the feature for product variations/different color or design of the same product. But in admin page we don't even have the capability to add new variations. Add that feature."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a New Variation for a Product (Priority: P1)

An admin user navigates to a product's dedicated edit page in the admin panel. They want to add a new variation (e.g., "Red - Large" or "Classic Logo") to an existing product. Within the variations section of the product edit page, the admin fills out a form specifying the variation name, design name, optional images, a price modifier (positive or negative adjustment from the base product price), and variation-specific stock quantity. After submitting, the variation appears in the product's variation list on the same page and is immediately available to customers on the storefront.

**Why this priority**: This is the core capability that is completely missing. Without being able to create variations, the entire feature is non-functional from an admin perspective. Every other story depends on variations existing.

**Independent Test**: Can be fully tested by navigating to any product in the admin panel, creating a variation with all fields, and verifying it appears in the product's variation list and on the customer-facing product page.

**Acceptance Scenarios**:

1. **Given** an admin is on a product's dedicated edit page, **When** they click a button to add a variation, **Then** a form is presented with fields for name, design name, images, price modifier, and stock.
2. **Given** an admin has filled the variation form with valid data, **When** they submit the form, **Then** the variation is saved and appears in the product's variation list with all entered details.
3. **Given** an admin submits the variation form with a duplicate variation name for the same product, **When** the system processes the request, **Then** an error message is shown indicating the variation name must be unique per product.
4. **Given** an admin submits the variation form with missing required fields (name, design name), **When** the system validates the input, **Then** clear validation error messages are shown for each missing field.

---

### User Story 2 - Edit an Existing Variation (Priority: P2)

An admin user views the list of variations for a product and wants to update details of an existing variation — for example, changing the price modifier, updating stock, replacing images, or correcting the variation name. The admin opens an edit form pre-populated with the current variation data, makes changes, and saves.

**Why this priority**: After creating variations, the next most critical need is correcting or updating them. Price adjustments, stock updates, and image changes are routine admin tasks.

**Independent Test**: Can be tested by selecting an existing variation, modifying its fields, saving, and verifying the changes persist and reflect on the storefront.

**Acceptance Scenarios**:

1. **Given** a product has existing variations, **When** an admin clicks edit on a variation, **Then** a form opens pre-populated with the current variation data.
2. **Given** an admin has modified variation fields, **When** they save the changes, **Then** the variation is updated and the changes are reflected immediately in the variation list.
3. **Given** an admin changes a variation's name to one that already exists for the same product, **When** they save, **Then** an error indicates duplicate names are not allowed.

---

### User Story 3 - Delete a Variation (Priority: P2)

An admin user wants to remove a variation that is no longer offered. They select a variation from the list and confirm deletion. The system removes the variation and it is no longer shown to customers.

**Why this priority**: Equal to editing — admins need to retire variations that are discontinued. This is essential for keeping the catalog accurate.

**Independent Test**: Can be tested by deleting a variation and confirming it no longer appears in the product's variation list or on the storefront.

**Acceptance Scenarios**:

1. **Given** a product has at least one variation, **When** an admin clicks delete on a variation, **Then** a confirmation dialog appears warning about the action.
2. **Given** the admin confirms deletion, **When** the system processes the request, **Then** the variation is removed and no longer appears in the product's variation list.
3. **Given** the variation being deleted is referenced by existing order history, **When** deletion is confirmed, **Then** the variation is removed but historical order records remain intact (orders are not affected).

---

### User Story 4 - View Variations List for a Product (Priority: P1)

An admin user navigates to a product's dedicated edit page in the admin panel. The page displays the product details at the top and a variations section below, showing all existing variations at a glance — including each variation's name, design name, price modifier, current stock, and a thumbnail image. This list provides the starting point for all variation management actions (create, edit, delete).

**Why this priority**: Admins need visibility into what variations exist before they can create, edit, or delete them. This is foundational to the management workflow.

**Independent Test**: Can be tested by navigating to a product's edit page and confirming the variations section displays all variations with correct details.

**Acceptance Scenarios**:

1. **Given** a product has multiple variations, **When** an admin navigates to the product's edit page, **Then** all variations are listed in the variations section with name, design name, price modifier, stock, and thumbnail.
2. **Given** a product has no variations, **When** an admin views the product's edit page, **Then** the variations section shows an empty state with a prompt to add the first variation.

---

### User Story 5 - Upload Variation Images (Priority: P3)

When creating or editing a variation, the admin can upload one primary image and additional images for that specific variation. These images are separate from the parent product's images and are displayed when a customer selects that variation on the storefront.

**Why this priority**: While variations can function without unique images (falling back to product images), distinct images per variation significantly improve the customer experience for color/design variants.

**Independent Test**: Can be tested by uploading images during variation creation, verifying they display in admin, and confirming customers see variation-specific images on the storefront.

**Acceptance Scenarios**:

1. **Given** an admin is creating or editing a variation, **When** they upload a primary image, **Then** it is previewed in the form and saved with the variation.
2. **Given** an admin is creating or editing a variation, **When** they upload additional images, **Then** the images are added to the variation's image gallery (up to a maximum limit).
3. **Given** a variation has no images, **When** a customer views the variation on the storefront, **Then** the product's default images are displayed as a fallback.

---

### Edge Cases

- What happens when an admin tries to create a variation with an empty name or design name? The system rejects the request with a validation error.
- What happens when a variation's stock is set to zero? The variation is saved but shown as out of stock to customers.
- What happens when a variation has a negative price modifier that would make the effective price zero or negative? The system validates that the effective price (base price + modifier) remains greater than zero.
- What happens when the admin deletes the last variation of a product? The variation is soft-deleted; the product continues to function without active variations, showing its base price and stock.
- What happens when an admin tries to upload images exceeding the maximum count or file size? The system rejects the upload with a clear error message about the limits.
- What happens when two admins edit the same variation simultaneously? The last save wins; data is not corrupted.
- What happens when an admin tries to add a 26th variation to a product? The system rejects the request with an error indicating the maximum of 25 variations has been reached.

## Clarifications

### Session 2026-03-19

- Q: How many variations should a product support at maximum? → A: Up to 25 variations per product.
- Q: Where should admins manage variations in the admin workflow? → A: Separate dedicated edit page per product (e.g., `/admin/products/[id]`) with a variations section, replacing the modal pattern with a full page for editing products and their variations.
- Q: When viewing a past order that referenced a now-deleted variation, what should be displayed? → A: Soft delete (mark as inactive/archived); order history shows the original variation name and details.
- Q: Should stock be required when creating a variation, or default to zero? → A: Stock is required with no default; admin must explicitly set stock quantity.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide admin users with the ability to create new variations for any existing product, up to a maximum of 25 variations per product.
- **FR-002**: System MUST allow admins to specify variation name, design name, price modifier, and stock quantity when creating a variation. All four fields are required (no defaults).
- **FR-003**: System MUST enforce that variation names are unique within a given product.
- **FR-004**: System MUST allow admins to upload a primary image and additional images for each variation.
- **FR-005**: System MUST allow admins to edit all fields of an existing variation (name, design name, price modifier, stock, images).
- **FR-006**: System MUST allow admins to delete (soft delete) variations, with a confirmation step before removal. Soft-deleted variations are hidden from customers and admin variation lists but remain in the database for order history integrity.
- **FR-007**: System MUST display all variations for a product in the admin panel, showing name, design name, price modifier, stock, and thumbnail.
- **FR-008**: System MUST validate that the effective price (base product price + variation price modifier) is greater than zero before saving.
- **FR-009**: System MUST validate all required fields (name, design name, stock, price modifier) before saving a variation. Stock must be a non-negative integer.
- **FR-010**: System MUST restrict variation management to authenticated admin users only.
- **FR-011**: System MUST preserve historical order records when a variation is soft-deleted. Orders referencing a soft-deleted variation MUST display the original variation name, design name, and details.
- **FR-012**: System MUST invalidate relevant caches when variations are created, updated, or deleted so customers see current data.
- **FR-013**: System MUST display an empty state with a clear call-to-action when a product has no variations.

### Key Entities

- **Product**: The parent item being sold. Has a base price, stock, and category. A product can have zero or more variations.
- **Product Variation**: A specific variant of a product (e.g., a color, design, or size). Key attributes: name, design name, primary image, additional images, price modifier (adjustment from base price), independent stock quantity, and active/archived status. Must have a unique name within its parent product. Soft-deleted variations are retained for order history but hidden from customers and admin variation lists.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admins can create a new product variation in under 2 minutes, including image upload.
- **SC-002**: Admins can edit any variation field and see changes reflected on the storefront within 60 seconds.
- **SC-003**: Admins can delete a variation in under 30 seconds, including confirmation.
- **SC-004**: All variation management operations validate input and display clear error messages for invalid data within 2 seconds.
- **SC-005**: Newly created variations are visible to customers on the storefront without requiring manual cache clearance or page refresh beyond normal browsing.
- **SC-006**: 100% of variation management actions are restricted to authenticated admin users — unauthenticated or non-admin users cannot access variation management.
- **SC-007**: Historical orders referencing soft-deleted variations display the original variation name and details.

## Assumptions

- The existing product variation database schema will be extended with a soft-delete field (e.g., `deletedAt` timestamp or `isActive` boolean) to support archiving variations while preserving order history references.
- The existing image upload infrastructure (Vercel Blob) will be reused for variation images.
- The existing admin authentication and authorization pattern (session-based with role check) will be reused.
- Image upload limits follow the same constraints as product image uploads (same max count and file size).
- The admin panel will use a dedicated product edit page (replacing the existing modal-based pattern for product editing) that includes both product details and a variations management section. Confirmation dialogs for destructive actions (delete) remain as modals.
- Cache invalidation follows the existing Redis-based pattern used for product data.
