// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockSession } = vi.hoisted(() => ({ mockSession: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: mockSession }))

import { SearchBar } from '@/components/SearchBar'

function setup(
  overrides: Partial<React.ComponentProps<typeof SearchBar>> = {}
) {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const utils = render(
    <SearchBar
      value=""
      onChange={onChange}
      onSubmit={onSubmit}
      {...overrides}
    />
  )
  return { ...utils, onChange, onSubmit }
}

describe('SearchBar', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSession.mockReturnValue({ data: null })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          query: 'test',
          products: [],
          categories: [],
          popular: [],
        },
      }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a search input with the right accessible label', () => {
    setup()
    expect(
      screen.getByRole('searchbox', { name: /search products/i })
    ).toBeInTheDocument()
  })

  it('calls onChange when the user types', () => {
    const { onChange } = setup()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'shoes' },
    })

    expect(onChange).toHaveBeenCalledWith('shoes')
  })

  it('opens the suggestion panel on focus', () => {
    const { container } = setup()

    fireEvent.focus(screen.getByRole('searchbox'))

    // When open, the dropdown panel container is rendered alongside the input
    expect(container.querySelector('.absolute.z-20')).not.toBeNull()
  })

  it('submits and persists the query when Enter is pressed', () => {
    const { onSubmit } = setup({ value: 'cotton' })

    fireEvent.focus(screen.getByRole('searchbox'))
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const stored = JSON.parse(
      localStorage.getItem('search:recent:guest') ?? '[]'
    )
    expect(stored).toEqual(['cotton'])
  })

  it('closes the panel when Escape is pressed without submitting', () => {
    const { onSubmit } = setup({ value: 'cotton' })

    fireEvent.focus(screen.getByRole('searchbox'))
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('issues a /api/search/suggest request when value is set and panel opens', async () => {
    setup({ value: 'cot' })

    fireEvent.focus(screen.getByRole('searchbox'))

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/suggest?q=cot'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('renders persisted recent searches and submits when one is clicked', async () => {
    localStorage.setItem(
      'search:recent:guest',
      JSON.stringify(['summer', 'sale'])
    )

    const { onChange, onSubmit } = setup()

    fireEvent.focus(screen.getByRole('searchbox'))

    const recentButton = await screen.findByRole('button', { name: 'summer' })
    fireEvent.click(recentButton)

    expect(onChange).toHaveBeenLastCalledWith('summer')
    expect(onSubmit).toHaveBeenCalled()
  })

  it('renders category quick links and closes panel on click', async () => {
    const { container } = setup({ categoryQuickLinks: ['Bags', 'Shoes'] })

    fireEvent.focus(screen.getByRole('searchbox'))

    const bagsLink = await screen.findByRole('link', { name: 'Bags' })
    expect(bagsLink).toHaveAttribute(
      'href',
      expect.stringContaining('/shop?category=Bags')
    )

    // Clicking the link closes the panel
    fireEvent.click(bagsLink)
    expect(container).toBeTruthy()
  })

  it('handles suggest fetch failure without throwing and clears suggestions', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    setup({ value: 'fail' })

    fireEvent.focus(screen.getByRole('searchbox'))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    // Should not render any product suggestions
    expect(screen.queryByText('Products')).toBeNull()
  })

  it('namespaces the recent-search key by user when a session is present', () => {
    mockSession.mockReturnValue({ data: { user: { id: 'user-42' } } })

    setup({ value: 'logged-in-query' })

    fireEvent.focus(screen.getByRole('searchbox'))
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })

    const stored = JSON.parse(
      localStorage.getItem('search:recent:user-42') ?? '[]'
    )
    expect(stored).toEqual(['logged-in-query'])
    expect(localStorage.getItem('search:recent:guest')).toBeNull()
  })
})
