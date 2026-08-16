// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StorefrontAssistant from '@/features/ai/components/StorefrontAssistant'

vi.mock('@/features/ai/components/AssistantMarkdown', () => ({
  AssistantMarkdown: ({ text }: { text: string }) => <span>{text}</span>,
}))

const jsonResponse = (text: string, ok = true) =>
  ({
    ok,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue({ text }),
  }) as unknown as Response

describe('StorefrontAssistant', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('user-id')
      .mockReturnValueOnce('assistant-id')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens, sends a starter prompt, renders a JSON reply, and closes', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('Try the canvas tote.'))
    render(<StorefrontAssistant />)

    fireEvent.click(screen.getByRole('button', { name: /open storefront/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'I need a gift under ₹2,000' })
    )

    expect(await screen.findByText('Try the canvas tote.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/assistant/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'I need a gift under ₹2,000' }],
        }),
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /close storefront/i }))
    expect(
      screen.getByRole('button', { name: /open storefront/i })
    ).toBeInTheDocument()
  })

  it('submits trimmed keyboard input and reports an HTTP failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse('', false))
    render(<StorefrontAssistant />)

    fireEvent.click(screen.getByRole('button', { name: /open storefront/i }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Find a backpack' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(input).toHaveValue('')

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('appends streamed chunks and supports stopping the request', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode('Waterproof '),
      })
      .mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode('options'),
      })
      .mockResolvedValueOnce({ done: true })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/plain' }),
      body: { getReader: () => ({ read }) },
    } as unknown as Response)

    render(<StorefrontAssistant />)
    fireEvent.click(screen.getByRole('button', { name: /open storefront/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Show me a waterproof bag' })
    )

    expect(await screen.findByText('Waterproof options')).toBeInTheDocument()

    vi.mocked(fetch).mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Another request' },
    })
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    fireEvent.click(await screen.findByRole('button', { name: /stop/i }))

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /stop/i })
      ).not.toBeInTheDocument()
    )
  })

  it('handles a missing stream body and aborts an active request on unmount', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: null,
      } as Response)
      .mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          })
      )

    const { unmount } = render(<StorefrontAssistant />)
    fireEvent.click(screen.getByRole('button', { name: /open storefront/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Compare your best tote bags' })
    )
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Keep searching' },
    })
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await act(async () => {
      unmount()
    })
  })
})
