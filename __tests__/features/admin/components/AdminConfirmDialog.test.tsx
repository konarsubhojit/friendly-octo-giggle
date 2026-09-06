// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminConfirmDialog } from '@/features/admin/components/AdminConfirmDialog'

describe('AdminConfirmDialog', () => {
  it('disables confirm until the typed confirmation matches', () => {
    render(
      <AdminConfirmDialog
        open
        onClose={vi.fn()}
        title="Delete product"
        description="Delete SKU-1 from the catalogue."
        reversible={false}
        typedConfirmationValue="DELETE"
        onConfirm={vi.fn().mockResolvedValue({ status: 'success' })}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /^confirm$/i })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'DELETE' },
    })

    expect(confirmButton).toBeEnabled()
  })

  it('closes on escape and restores focus to the trigger', async () => {
    const onClose = vi.fn()

    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <AdminConfirmDialog
            open={open}
            onClose={() => {
              onClose()
              setOpen(false)
            }}
            title="Delete product"
            description="Delete SKU-1 from the catalogue."
            reversible={false}
            onConfirm={vi.fn().mockResolvedValue({ status: 'success' })}
          />
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: /open dialog/i })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce()
      expect(trigger).toHaveFocus()
    })
  })

  it('renders the confirm outcome before the user closes the dialog', async () => {
    render(
      <AdminConfirmDialog
        open
        onClose={vi.fn()}
        title="Refund order"
        description="Refund ORD123."
        reversible={true}
        confirmLabel="Issue refund"
        onConfirm={vi.fn().mockResolvedValue({
          status: 'partial',
          succeeded: 2,
          failed: 1,
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /issue refund/i }))

    await waitFor(() => {
      expect(screen.getByText('2 completed, 1 failed.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument()
  })
})
