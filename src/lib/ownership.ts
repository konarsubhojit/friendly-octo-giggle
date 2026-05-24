interface OwnershipResource {
  readonly userId?: string | null
  readonly sessionId?: string | null
}

interface SessionLike {
  readonly user?: {
    readonly id?: string | null
  } | null
}

interface AssertOwnershipOptions {
  readonly sessionId?: string | null
}

/**
 * IDOR ownership gate for user-scoped/guest-scoped resources.
 *
 * Precedence:
 * 1) Authenticated users must match `resource.userId`.
 * 2) Guest fallback is allowed only for resources without `userId`, and only
 *    when `resource.sessionId` matches the provided `options.sessionId`.
 *
 * Returns `false` for null/undefined resources so callers can safely collapse
 * "not found" and "not owned" into the same response surface.
 *
 * The type-guard return (`resource is T`) lets callers continue with a
 * non-null resource only after ownership is proven.
 */
export const assertOwnership = <T extends OwnershipResource>(
  resource: T | null | undefined,
  session: SessionLike | null | undefined,
  options: AssertOwnershipOptions = {}
): resource is T => {
  if (!resource) {
    return false
  }

  const sessionUserId = session?.user?.id
  if (sessionUserId) {
    return resource.userId === sessionUserId
  }

  // Security: user-owned resources can never be claimed via guest sessionId,
  // even if session IDs match.
  if (resource.userId) {
    return false
  }

  return !!options.sessionId && resource.sessionId === options.sessionId
}
