# Contract: Confirmation Primitive

Internal UI contract, not a network API. Defines the single component
(`AdminConfirmDialog`) every destructive, irreversible, or high-consequence
admin action must route through (FR-C01–FR-C07), superseding the narrower
`DeleteConfirmModal`.

## Shape

```ts
interface AdminConfirmDialogProps {
  open: boolean
  onClose: () => void

  /** Plain-language description of the specific entity/entities affected
   *  and the consequence (FR-C02). Not a generic "Are you sure?" string. */
  title: string
  description: string

  /** Whether this action can be reversed, stated to the user (FR-C02). */
  reversible: boolean

  /** When set, the confirm button stays disabled until the user types this
   *  exact value into a text field (FR-C03: refunds, role changes, bulk
   *  deletions). Omitted for lower-risk confirmations. */
  typedConfirmationValue?: string

  /** Invoked on confirm; the dialog shows its own pending state and
   *  disables re-submission while this is in flight (mirrors FR-B06's
   *  duplicate-submission guard, applied to confirmations too). */
  onConfirm: () => Promise<ConfirmOutcome>
}

type ConfirmOutcome =
  | { status: 'success' }
  | { status: 'partial'; succeeded: number; failed: number }
  | { status: 'failure'; reason: string }
```

## Behavioral requirements

- Traps focus while open and restores focus to the triggering control on
  close (FR-H02), consistent with existing overlay behavior already used by
  `DeleteConfirmModal` and the `CommandPalette`.
- Closes on `Escape` (FR-H02).
- The confirm control is disabled (not merely inert) until
  `typedConfirmationValue`, if set, is matched exactly — this is a client-side
  UX aid only; it is not a substitute for server-side authorization, and the
  underlying mutation endpoint enforces its own checks independent of what
  the dialog allowed the user to click (FR-C06/NFR-010).
- On completion, renders the `ConfirmOutcome` (success / partial with
  counts / failure with reason) before closing, satisfying FR-C07 — the
  dialog does not close silently on submit.

## Adoption requirements

- Every call site currently using `DeleteConfirmModal` is migrated to
  `AdminConfirmDialog` with `reversible: false` and no
  `typedConfirmationValue` (equivalent behavior, single primitive).
- Every call site for refund, role change, and bulk delete actions supplies
  `typedConfirmationValue` (FR-C03). The exact expected string (e.g. the
  order's short ID, or the literal word "DELETE") is decided per action at
  implementation time and documented at the call site, not standardized to
  one fixed string across unrelated actions.
- Self-demotion and last-administrator removal (FR-C04/FR-C05) are refused
  by the server before any confirmation dialog would even be reached in the
  success path; the dialog is not the enforcement point for those rules —
  it may still be shown and then rejected server-side, and the interface
  must surface that rejection clearly (edge case: "administrator attempts
  self-demotion by calling the underlying endpoint directly" — the
  dialog's existence is irrelevant to that path by design).
