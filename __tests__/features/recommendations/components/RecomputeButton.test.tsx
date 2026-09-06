// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecomputeButton } from '@/features/recommendations/components/RecomputeButton'

describe('RecomputeButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a success message when the recompute is published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { dispatch: 'published' } }),
      })
    )

    render(<RecomputeButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Recompute now' }))

    expect(
      screen.getByRole('button', { name: 'Queueing…' })
    ).toBeDisabled()

    await waitFor(() => {
      expect(
        screen.getByText(
          'Recompute queued. Scores refresh when the run completes.'
        )
      ).toBeInTheDocument()
    })
  })

  it('shows a fallback message when the recompute is not published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { dispatch: 'dropped' } }),
      })
    )

    render(<RecomputeButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Recompute now' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Recompute was not queued \(dropped\)/)
      ).toBeInTheDocument()
    })
  })

  it('shows the server error message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Not authorized' }),
      })
    )

    render(<RecomputeButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Recompute now' }))

    await waitFor(() => {
      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
  })

  it('shows a generic error message when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    render(<RecomputeButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Recompute now' }))

    await waitFor(() => {
      expect(
        screen.getByText('Recompute could not be queued.')
      ).toBeInTheDocument()
    })
  })
})
