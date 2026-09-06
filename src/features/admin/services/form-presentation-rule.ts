/**
 * Single documented rule: overlay vs dedicated screen (FR-B02).
 *
 * The decision is based on record complexity (field count and nested structure).
 * - ≤ 8 simple fields → overlay (modal/drawer)
 * - > 8 fields OR nested structures (variants, options, images) → dedicated screen
 *
 * This replaces the ad-hoc per-screen choice and is consumed by every
 * create/edit call site.
 */

export type FormPresentation = 'overlay' | 'dedicated-screen'

export interface FormPresentationInput {
  /** Number of top-level editable fields. */
  readonly fieldCount: number
  /** Whether the record has nested/complex sub-structures. */
  readonly hasNestedStructure: boolean
}

const OVERLAY_FIELD_THRESHOLD = 8

/**
 * Returns the canonical form presentation for a record type.
 */
export function getFormPresentation(
  input: FormPresentationInput
): FormPresentation {
  if (input.hasNestedStructure || input.fieldCount > OVERLAY_FIELD_THRESHOLD) {
    return 'dedicated-screen'
  }
  return 'overlay'
}

/**
 * Pre-computed presentation rules for each admin resource type.
 * Consumed by create/edit call sites to pick overlay vs. dedicated screen.
 */
export const RESOURCE_FORM_PRESENTATIONS: Record<string, FormPresentation> = {
  categories: getFormPresentation({ fieldCount: 3, hasNestedStructure: false }),
  coupons: getFormPresentation({ fieldCount: 7, hasNestedStructure: false }),
  products: getFormPresentation({ fieldCount: 15, hasNestedStructure: true }),
  users: getFormPresentation({ fieldCount: 5, hasNestedStructure: false }),
  reviews: getFormPresentation({ fieldCount: 3, hasNestedStructure: false }),
}

/**
 * Products are the one resource whose rule outcome depends on *mode*, not
 * just the resource type (T065):
 *
 * - Creating a product has no variants/options yet — only the ~5 core
 *   top-level fields (name, description, category, primary image, extra
 *   images) exist, none of them nested — so the low-field-count branch of
 *   the rule applies and `ProductFormModal` renders as an overlay
 *   (`layout="modal"`, the component default).
 * - Editing a product also curates its variants and options, which is the
 *   nested structure the rule is designed to route to a dedicated screen —
 *   so `/admin/products/[id]/edit` renders `ProductEditPageForm`
 *   (`ProductFormModal` with `layout="page"`) alongside `VariantList` and
 *   `OptionManager` on one page, matching `RESOURCE_FORM_PRESENTATIONS.products`
 *   above (`dedicated-screen`).
 * - A single variant's own fields (SKU, price, stock, attributes) are a
 *   small, non-nested record, so `VariantFormModal` is correctly an overlay
 *   regardless of whether the parent product is on a dedicated screen.
 */
export function getProductFormPresentation(
  mode: 'create' | 'edit'
): FormPresentation {
  return mode === 'create' ? 'overlay' : 'dedicated-screen'
}
