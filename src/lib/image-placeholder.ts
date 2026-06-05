const PRODUCT_CARD_PLACEHOLDER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="none">
    <defs>
      <linearGradient id="kiyon-product-placeholder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff8f3" />
        <stop offset="50%" stop-color="#fde4dc" />
        <stop offset="100%" stop-color="#f7d5c7" />
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#kiyon-product-placeholder)" />
  </svg>
`

export const PRODUCT_CARD_BLUR_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PRODUCT_CARD_PLACEHOLDER_SVG)}`
