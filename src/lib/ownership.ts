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

  // Do not allow guest-session fallback for resources that are tied to a user.
  if (resource.userId) {
    return false
  }

  return Boolean(
    resource.sessionId &&
    options.sessionId &&
    resource.sessionId === options.sessionId
  )
}
