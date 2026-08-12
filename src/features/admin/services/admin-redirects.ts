/**
 * Retired → survivor redirect map (FR-E03/FR-E10).
 *
 * Every retired admin address permanently redirects to its survivor.
 * This map is the single source of truth for those redirections.
 */
export const ADMIN_REDIRECT_MAP: Record<string, string> = {
  '/admin/sales': '/admin',
}

/**
 * Returns the redirect target for a retired admin route, or null if the
 * route is still active.
 */
export function getAdminRedirect(path: string): string | null {
  return ADMIN_REDIRECT_MAP[path] ?? null
}
