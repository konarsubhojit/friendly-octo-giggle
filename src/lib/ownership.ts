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

export const assertOwnership = (
  resource: OwnershipResource | null | undefined,
  session: SessionLike | null | undefined,
  options: AssertOwnershipOptions = {}
): boolean => {
  if (!resource) {
    return false
  }

  const sessionUserId = session?.user?.id
  if (sessionUserId) {
    return resource.userId === sessionUserId
  }

  // If a resource has a userId, ownership must be proven by that same userId.
  // This prevents access by supplying/guessing a guest sessionId fallback.
  if (resource.userId) {
    return false
  }

  return !!options.sessionId && resource.sessionId === options.sessionId
}
