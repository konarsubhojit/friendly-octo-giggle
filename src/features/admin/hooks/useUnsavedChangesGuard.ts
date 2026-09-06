'use client'

/**
 * Shared unsaved-changes guard (FR-B05, T067) used by every converted
 * overlay/dedicated-screen form (categories, coupons, products).
 *
 * Each form tracks its own `dirty` boolean (set the first time the user
 * edits a field); this hook centralizes the "are you sure you want to
 * discard unsaved changes?" confirmation so every form warns consistently
 * instead of each modal re-implementing its own `window.confirm` call.
 */

const DEFAULT_MESSAGE = 'Discard unsaved changes?'

export function useUnsavedChangesGuard(dirty: boolean) {
  /**
   * Wraps a `close` callback so it only runs immediately when there are no
   * unsaved changes; otherwise it asks for confirmation first and only
   * proceeds if the user accepts.
   */
  const guardClose = (close: () => void, message = DEFAULT_MESSAGE) => {
    if (dirty && !window.confirm(message)) return
    close()
  }

  return { guardClose }
}

export default useUnsavedChangesGuard
