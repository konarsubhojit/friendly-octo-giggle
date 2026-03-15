/** Product categories displayed on the storefront and used in admin forms. */
export const PRODUCT_CATEGORIES = [
  "Handbag",
  "Flowers",
  "Flower Pots",
  "Keychains",
  "Hair Accessories",
] as const;

/** Categories including the "All" filter option for the storefront. */
export const CATEGORY_FILTERS = ["All", ...PRODUCT_CATEGORIES] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
