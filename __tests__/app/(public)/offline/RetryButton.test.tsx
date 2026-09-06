// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RetryButton } from '@/app/(public)/offline/RetryButton'

describe('RetryButton', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    reload.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: Object.create(originalLocation, {
        reload: { value: reload },
      }),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
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
