export const STORE_NAME = 'The Kiyon Store'
export const STORE_SHORT_NAME = 'Kiyon'

/**
 * Instagram handle used as the video-evidence channel for damaged-item return
 * claims.
 *
 * Deliberately a static constant rather than Edge Config: it appears in the
 * checkout policy copy that `OrderPolicyConfirmDialog` — a Client Component —
 * imports synchronously, and Edge Config is server-only and async. Keeping the
 * destination for customer damage evidence on the reviewed deploy path also
 * means it cannot be redirected from a dashboard without code review.
 *
 * Whether the channel is *offered* is a separate, dynamic concern: the
 * `returnVideoViaInstagram` feature flag in Edge Config.
 */
export const INSTAGRAM_HANDLE = 'thekiyonstore'

/**
 * Direct-message deep link. `ig.me/m/<handle>` opens the DM composer in the
 * Instagram app and falls back to the web inbox when the app is absent.
 * Instagram does not support prefilled message text, so the return ID is
 * surfaced separately with a copy control.
 */
export const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`

export const withStoreName = (pageTitle: string) =>
  `${pageTitle} | ${STORE_NAME}`
