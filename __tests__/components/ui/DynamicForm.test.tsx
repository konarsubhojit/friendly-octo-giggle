import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { DynamicForm } from '@/components/ui/DynamicForm'
import type { FieldDef } from '@/components/ui/DynamicFormTypes'

// Mock FieldRenderer so we can test DynamicForm logic without rendering sub-components
vi.mock('@/components/ui/FieldRenderer', () => ({
  FieldRenderer: ({
    field,
    value,
    error,
    onChange,
    onBlur,
  }: {
    field: FieldDef
    value: string
    error?: string
    onChange: (name: string, value: string) => void
    onBlur: (name: string) => void
    showPassword: boolean
    onTogglePassword: (id: string) => void
  }) => (
    <div data-testid={`field-${field.name}`}>
      <label htmlFor={field.id}>{field.label}</label>
      <input
        id={field.id}
        name={field.name}
        value={value}
        type={field.type === 'password' ? 'password' : 'text'}
        onChange={(e) => onChange(field.name, e.target.value)}
        onBlur={() => onBlur(field.name)}
        data-testid={`input-${field.name}`}
      />
      {error && (
        <span data-testid={`error-${field.name}`} role="alert">
          {error}
        </span>
      )}
    </div>
  ),
}))

const emailField: FieldDef = {
  id: 'email',
  name: 'email',
  label: 'Email',
  type: 'email',
  validate: (v) => (!v.trim() ? 'Email is required' : undefined),
  validateOnBlur: true,
}

const passwordField: FieldDef = {
  id: 'password',
  name: 'password',
  label: 'Password',
  type: 'password',
  validate: (v) => (v.length < 6 ? 'Too short' : undefined),
  validateOnBlur: true,
}

const nameField: FieldDef = {
  id: 'name',
  name: 'name',
  label: 'Name',
  type: 'text',
}

const fields = [emailField, nameField]

describe('DynamicForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all fields from the fields prop', () => {
    render(<DynamicForm fields={[emailField, nameField]} onSubmit={vi.fn()} />)
    expect(screen.getByTestId('field-email')).toBeInTheDocument()
    expect(screen.getByTestId('field-name')).toBeInTheDocument()
  })

  it('renders submit button with custom label', () => {
    render(
      <DynamicForm
        fields={fields}
        onSubmit={vi.fn()}
        submitLabel="Save Changes"
      />
    )
    expect(
      screen.getByRole('button', { name: 'Save Changes' })
    ).toBeInTheDocument()
  })

  it('renders cancel button when onCancel is provided', () => {
    const onCancel = vi.fn()
    render(
      <DynamicForm
        fields={fields}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        cancelLabel="Go Back"
      />
    )
    const cancelBtn = screen.getByRole('button', { name: 'Go Back' })
    expect(cancelBtn).toBeInTheDocument()
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render cancel button when onCancel is not provided', () => {
    render(<DynamicForm fields={fields} onSubmit={vi.fn()} />)
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('initializes fields with initialValues', () => {
    render(
      <DynamicForm
        fields={fields}
        onSubmit={vi.fn()}
        initialValues={{ email: 'test@test.com', name: 'Alice' }}
      />
    )
    expect(screen.getByTestId('input-email')).toHaveValue('test@test.com')
    expect(screen.getByTestId('input-name')).toHaveValue('Alice')
  })

  it('initializes fields with defaultValue from field definition', () => {
    const fieldWithDefault: FieldDef = {
      id: 'role',
      name: 'role',
      label: 'Role',
      type: 'text',
      defaultValue: 'admin',
    }
    render(<DynamicForm fields={[fieldWithDefault]} onSubmit={vi.fn()} />)
    expect(screen.getByTestId('input-role')).toHaveValue('admin')
  })

  it('calls onSubmit with form values on valid submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        initialValues={{ name: 'Alice' }}
      />
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Alice' })
    })
  })

  it('shows validation errors and blocks submit when fields are invalid', async () => {
    const onSubmit = vi.fn()
    render(<DynamicForm fields={[emailField, nameField]} onSubmit={onSubmit} />)
    // email has validate function, submit with empty values
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(screen.getByTestId('error-email')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  it('shows single field error message in summary', async () => {
    const onSubmit = vi.fn()
    render(<DynamicForm fields={[emailField]} onSubmit={onSubmit} />)
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(
        screen.getByText(/Please correct the highlighted field/)
      ).toBeInTheDocument()
    })
  })

  it('shows plural error count in summary when multiple fields invalid', async () => {
    const onSubmit = vi.fn()
    render(
      <DynamicForm fields={[emailField, passwordField]} onSubmit={onSubmit} />
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(
        screen.getByText(/Please correct 2 highlighted fields/)
      ).toBeInTheDocument()
    })
  })

  it('shows internal server error when onSubmit returns a string', async () => {
    const onSubmit = vi.fn().mockResolvedValue('Server is down')
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        initialValues={{ name: 'Alice' }}
      />
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server is down')
    })
  })

  it('shows external server error from prop', () => {
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={vi.fn()}
        serverError="External API error"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('External API error')
  })

  it('external serverError overrides internal server error', async () => {
    const onSubmit = vi.fn().mockResolvedValue('Internal error')
    const { rerender } = render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        initialValues={{ name: 'Bob' }}
        serverError="External error"
      />
    )
    // External error should show
    expect(screen.getByRole('alert')).toHaveTextContent('External error')

    // Rerender without external error
    rerender(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        initialValues={{ name: 'Bob' }}
      />
    )
    expect(screen.queryByText('External error')).toBeNull()
  })

  it('shows field-level errors when onSubmit returns an object', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ email: 'Already taken' })
    render(
      <DynamicForm
        fields={[emailField]}
        onSubmit={onSubmit}
        initialValues={{ email: 'used@example.com' }}
      />
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(screen.getByTestId('error-email')).toHaveTextContent(
        'Already taken'
      )
    })
  })

  it('shows generic error when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network failure'))
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        initialValues={{ name: 'Alice' }}
      />
    )
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'An unexpected error occurred'
      )
    })
  })

  it('shows serverSuccess message', () => {
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={vi.fn()}
        serverSuccess="Profile updated!"
      />
    )
    expect(screen.getByText('Profile updated!')).toBeInTheDocument()
  })

  it('disables submit button while submitting and shows submitting label', async () => {
    let resolveSubmit: (v: undefined) => void
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveSubmit = resolve
      })
    )
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        submitLabel="Save"
        submittingLabel="Saving..."
        initialValues={{ name: 'Alice' }}
      />
    )

    act(() => {
      fireEvent.submit(document.querySelector('form')!)
    })

    // During submission
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    })

    // Resolve and check button is re-enabled
    await act(async () => {
      resolveSubmit!(undefined)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    })
  })

  it('disables cancel button while submitting', async () => {
    let resolveSubmit: (v: undefined) => void
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveSubmit = resolve
      })
    )
    const onCancel = vi.fn()
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={onSubmit}
        onCancel={onCancel}
        initialValues={{ name: 'Alice' }}
      />
    )

    act(() => {
      fireEvent.submit(document.querySelector('form')!)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })

    await act(async () => {
      resolveSubmit!(undefined)
    })
  })

  it('clears field error when user starts typing in that field', async () => {
    const onSubmit = vi.fn()
    render(<DynamicForm fields={[emailField]} onSubmit={onSubmit} />)

    // Trigger validation error
    await act(async () => {
      fireEvent.submit(document.querySelector('form')!)
    })
    await waitFor(() => {
      expect(screen.getByTestId('error-email')).toBeInTheDocument()
    })

    // Type into the field to clear the error
    fireEvent.change(screen.getByTestId('input-email'), {
      target: { value: 'hello' },
    })

    expect(screen.queryByTestId('error-email')).toBeNull()
  })

  it('runs blur validation when field has validateOnBlur and validate', async () => {
    render(<DynamicForm fields={[emailField]} onSubmit={vi.fn()} />)

    fireEvent.blur(screen.getByTestId('input-email'))

    await waitFor(() => {
      expect(screen.getByTestId('error-email')).toHaveTextContent(
        'Email is required'
      )
    })
  })

  it('applies custom formClassName', () => {
    render(
      <DynamicForm
        fields={fields}
        onSubmit={vi.fn()}
        formClassName="my-custom-form"
      />
    )
    expect(document.querySelector('form.my-custom-form')).toBeInTheDocument()
  })

  it('applies custom submitButtonClassName', () => {
    render(
      <DynamicForm
        fields={fields}
        onSubmit={vi.fn()}
        submitButtonClassName="my-submit-btn"
        submitLabel="Go"
      />
    )
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn).toHaveClass('my-submit-btn')
  })

  it('handles field change and updates value', () => {
    render(
      <DynamicForm
        fields={[nameField]}
        onSubmit={vi.fn()}
        initialValues={{ name: '' }}
      />
    )
    fireEvent.change(screen.getByTestId('input-name'), {
      target: { value: 'New Name' },
    })
    expect(screen.getByTestId('input-name')).toHaveValue('New Name')
  })
})
