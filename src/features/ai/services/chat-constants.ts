/** Shared limits and quotas for the product AI chat feature. */

export const MAX_INPUT_MESSAGE_CHARS = 500
export const MAX_CONVERSATION_TURNS = 6
export const MAX_OUTPUT_TOKENS = 400
export const DAILY_REQUEST_QUOTA = 40
export const DAILY_TOKEN_QUOTA = 12000
export const ADVANCED_DAILY_REQUEST_QUOTA = 15
export const PRODUCT_CONTEXT_MAX_CHARS = 4000
export const SUPPLEMENTAL_CONTEXT_MAX_CHARS = 1600
export const CHAT_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30
export const MAX_REVIEW_COMMENT_CHARS = 120
/** Keep guest identifiers stable and compact for per-guest Redis quota keys. */
export const MAX_GUEST_ID_LENGTH = 64
