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

  // If a resource has a userId, ownership must be proven by that same userId,
  // even if a matching guest sessionId is provided.
  if (resource.userId) {
    return false
  }

  return !!options.sessionId && resource.sessionId === options.sessionId
}
