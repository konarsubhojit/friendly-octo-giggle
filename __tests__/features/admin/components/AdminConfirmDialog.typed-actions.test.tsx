// @vitest-environment jsdom
/**
 * T061: Unit test for typed-confirmation gating on refund, role-change, and
 * bulk-delete call sites (FR-C03).
 */
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminConfirmDialog } from '@/features/admin/components/AdminConfirmDialog'

describe('AdminConfirmDialog typed-confirmation gating', () => {
  it('disables confirm until the typed value matches for a refund action', () => {
    render(
      <AdminConfirmDialog
        open
        onClose={() => {}}
        title="Issue refund"
        description="Refund order ORD1234 for ₹500?"
        reversible={false}
        typedConfirmationValue="ORD1234"
        onConfirm={async () => ({ status: 'success' })}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ORD123' },
    })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ORD1234' },
    })
    expect(confirmBtn).toBeEnabled()
  })

  it('disables confirm until the typed value matches for a role change', () => {
    render(
      <AdminConfirmDialog
        open
        onClose={() => {}}
        title="Change role"
        description="Change user role to Support?"
        reversible={true}
        typedConfirmationValue="CHANGE ROLE"
        onConfirm={async () => ({ status: 'success' })}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'CHANGE ROLE' },
    })
    expect(confirmBtn).toBeEnabled()
  })

  it('disables confirm until the typed value matches for a bulk delete', () => {
    render(
      <AdminConfirmDialog
        open
        onClose={() => {}}
        title="Delete 5 items"
        description="This action cannot be undone."
        reversible={false}
        typedConfirmationValue="DELETE"
        onConfirm={async () => ({ status: 'success' })}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmBtn).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'DELETE' },
    })
    expect(confirmBtn).toBeEnabled()
  })
})
