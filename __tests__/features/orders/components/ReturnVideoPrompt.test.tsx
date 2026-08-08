// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReturnVideoPrompt } from '@/features/orders/components/ReturnVideoPrompt'
import { INSTAGRAM_HANDLE } from '@/lib/constants/store'
import { SUPPORT_EMAIL } from '@/lib/constants/checkout-policies'

const RETURN_ID = 'r7N8p9Q'

describe('ReturnVideoPrompt with the Instagram channel enabled', () => {
  it('shows the return id the customer must quote', () => {
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled />)

    expect(screen.getByText(RETURN_ID)).toBeInTheDocument()
  })

  it('links to the Instagram DM composer', () => {
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled />)

    const link = screen.getByRole('link', {
      name: new RegExp(INSTAGRAM_HANDLE, 'i'),
    })
    expect(link).toHaveAttribute('href', expect.stringContaining('ig.me/m/'))
  })

  it('opens the external link safely', () => {
    // Without `noopener` the opened tab gets a `window.opener` handle back
    // into this origin.
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled />)

    const link = screen.getByRole('link', {
      name: new RegExp(INSTAGRAM_HANDLE, 'i'),
    })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('copies the return id, because Instagram cannot prefill message text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled />)
    fireEvent.click(screen.getByRole('button', { name: /copy return id/i }))

    expect(writeText).toHaveBeenCalledWith(RETURN_ID)
    expect(
      await screen.findByRole('button', { name: /copied/i })
    ).toBeInTheDocument()
  })

  it('stays usable when clipboard access is denied', async () => {
    // Denied permission or plain HTTP. The id is displayed in full regardless,
    // so the customer can still select it by hand.
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled />)
    fireEvent.click(screen.getByRole('button', { name: /copy return id/i }))

    expect(screen.getByText(RETURN_ID)).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /copy return id/i })
    ).toBeInTheDocument()
  })
})

describe('ReturnVideoPrompt with the Instagram channel disabled', () => {
  it('falls back to the support email rather than showing nothing', () => {
    // The policy requires a video before review, so the instruction must never
    // simply disappear when the channel is switched off.
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled={false} />)

    expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument()
  })

  it('offers no Instagram link', () => {
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled={false} />)

    expect(
      screen.queryByRole('link', { name: new RegExp(INSTAGRAM_HANDLE, 'i') })
    ).not.toBeInTheDocument()
  })

  it('still shows the return id for correlation', () => {
    render(<ReturnVideoPrompt returnId={RETURN_ID} instagramEnabled={false} />)

    expect(screen.getByText(RETURN_ID)).toBeInTheDocument()
  })
})
