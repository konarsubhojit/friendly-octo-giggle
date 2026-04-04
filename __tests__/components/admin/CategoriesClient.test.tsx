import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CategoriesClient from '@/features/admin/components/CategoriesClient'

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean
    title: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel Dialog</button>
      </div>
    ) : null,
}))

const mockCategories = [
  {
    id: 'cat1',
    name: 'Bags',
    sortOrder: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'cat2',
    name: 'Shoes',
    sortOrder: 2,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    deletedAt: null,
  },
]

describe('CategoriesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the add category form', () => {
    render(<CategoriesClient initialCategories={[]} />)
    expect(
      screen.getByRole('heading', { name: /add category/i })
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Handbag')).toBeInTheDocument()
  })

  it('shows empty state when no categories', () => {
    render(<CategoriesClient initialCategories={[]} />)
    expect(screen.getByText('No categories yet')).toBeInTheDocument()
  })

  it('renders categories table with data', () => {
    render(<CategoriesClient initialCategories={mockCategories} />)
    expect(screen.getByText('Bags')).toBeInTheDocument()
    expect(screen.getByText('Shoes')).toBeInTheDocument()
    expect(screen.getAllByText('Edit')).toHaveLength(2)
    expect(screen.getAllByText('Delete')).toHaveLength(2)
  })

  it('allows adding a new category', async () => {
    const newCat = {
      id: 'cat3',
      name: 'Hats',
      sortOrder: 3,
      createdAt: '2025-01-03T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
      deletedAt: null,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { category: newCat } }),
      })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Handbag'), {
      target: { value: 'Hats' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /add category/i }).closest('form')!
    )

    await waitFor(() => {
      expect(screen.getByText('Hats')).toBeInTheDocument()
    })
  })

  it('shows error toast when add fails', async () => {
    const toast = await import('react-hot-toast')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Duplicate name' }),
      })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Handbag'), {
      target: { value: 'Bags' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /add category/i }).closest('form')!
    )

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Duplicate name')
    })
  })

  it('enters edit mode when Edit is clicked', () => {
    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Edit')[0])
    expect(screen.getByDisplayValue('Bags')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('cancels edit mode', () => {
    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Edit')[0])
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('saves an updated category', async () => {
    const updated = { ...mockCategories[0], name: 'Backpacks' }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { category: updated } }),
      })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Edit')[0])

    fireEvent.change(screen.getByDisplayValue('Bags'), {
      target: { value: 'Backpacks' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('Backpacks')).toBeInTheDocument()
    })
  })

  it('shows error toast when update fails', async () => {
    const toast = await import('react-hot-toast')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Edit')[0])
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Update failed')
    })
  })

  it('opens delete confirmation dialog', () => {
    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Delete')[0])
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete Category')).toBeInTheDocument()
  })

  it('deletes a category on confirm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Delete')[0])
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(screen.queryByText('Bags')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Shoes')).toBeInTheDocument()
  })

  it('shows error toast when delete fails', async () => {
    const toast = await import('react-hot-toast')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Cannot delete' }),
      })
    )

    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Delete')[0])
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Cannot delete')
    })
  })

  it('closes delete dialog on cancel', () => {
    render(<CategoriesClient initialCategories={mockCategories} />)
    fireEvent.click(screen.getAllByText('Delete')[0])
    fireEvent.click(screen.getByText('Cancel Dialog'))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('disables Add Category button when name is empty', () => {
    render(<CategoriesClient initialCategories={[]} />)
    expect(screen.getByRole('button', { name: /add category/i })).toBeDisabled()
  })
})
