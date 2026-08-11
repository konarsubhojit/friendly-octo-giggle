// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminActivityFilters } from '@/features/admin/components/AdminActivityFilters'

describe('AdminActivityFilters', () => {
  it('applies combined filter changes through a single callback', () => {
    const onChange = vi.fn()

    function Harness() {
      const [value, setValue] = React.useState({})

      return (
        <AdminActivityFilters
          value={value}
          entityOptions={['order', 'product']}
          actionOptions={['status_change', 'refund']}
          onChange={(nextValue) => {
            setValue(nextValue)
            onChange(nextValue)
          }}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByLabelText('Entity'), {
      target: { value: 'order' },
    })
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'refund' },
    })
    fireEvent.change(screen.getByLabelText('Actor'), {
      target: { value: 'admin-1' },
    })

    expect(onChange).toHaveBeenNthCalledWith(1, { entity: 'order' })
    expect(onChange).toHaveBeenNthCalledWith(2, {
      entity: 'order',
      action: 'refund',
    })
    expect(onChange).toHaveBeenNthCalledWith(3, {
      entity: 'order',
      action: 'refund',
      actorId: 'admin-1',
    })
  })
})
