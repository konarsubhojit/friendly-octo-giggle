// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RetryButton } from '@/app/(public)/offline/RetryButton'

describe('RetryButton', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockReset()
    vi.stubGlobal('window', {
      ...globalThis.window,
      location: { ...globalThis.window.location, reload },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a "Try Again" button', () => {
    render(<RetryButton />)

    expect(
      screen.getByRole('button', { name: 'Try Again' })
    ).toBeInTheDocument()
  })

  it('reloads the page when clicked', async () => {
    render(<RetryButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
