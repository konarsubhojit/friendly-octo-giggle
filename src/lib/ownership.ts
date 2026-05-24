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

  // If a resource has a userId, only that userId can establish ownership.
  // Guest sessionId fallback is never allowed for user-owned resources.
  if (resource.userId) {
    return false
  }

  return !!options.sessionId && resource.sessionId === options.sessionId
}
