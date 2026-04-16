// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ProductAssistant from '@/features/product/components/ProductAssistant'

let uuidCounter = 0
const mockRandomUUID = vi.fn(() => `uuid-${++uuidCounter}`)

const makeFetchResponse = (
  opts: { json?: Record<string, string>; stream?: string; status?: number } = {}
) => {
  if (opts.status && opts.status >= 400) {
    return Promise.resolve(new Response(null, { status: opts.status }))
  }

  if (opts.json) {
    return Promise.resolve(
      new Response(JSON.stringify(opts.json), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }

  const encoder = new TextEncoder()
  const chunks = opts.stream ? [opts.stream] : []
  let index = 0
  const readable = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]))
      } else {
        controller.close()
      }
    },
  })
  return Promise.resolve(
    new Response(readable, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  )
}

describe('ProductAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      mockRandomUUID as () => `${string}-${string}-${string}-${string}-${string}`
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders collapsed state with open button', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    expect(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    ).toBeTruthy()
    expect(screen.getByText('Ask about this product')).toBeTruthy()
  })

  it('expands when clicked', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    expect(screen.getByText('Product Assistant')).toBeTruthy()
  })

  it('renders starter prompts when expanded', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    expect(screen.getByText('Is this product in stock?')).toBeTruthy()
    expect(screen.getByText('What variations are available?')).toBeTruthy()
    expect(screen.getByText('Tell me more about this product')).toBeTruthy()
  })

  it('has a textarea for typing questions', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    expect(screen.getByLabelText('Type your question')).toBeTruthy()
  })

  it('can close the assistant', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    expect(screen.getByText('Product Assistant')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close assistant'))
    expect(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    ).toBeTruthy()
  })

  it('does not send empty messages', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.submit(textarea.closest('form')!)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('does not submit on Shift+Enter', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Question' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('POSTs to the correct endpoint when a starter prompt is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ json: { text: 'Yes, in stock!' } }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Is this product in stock?'))
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/ai/products/abc1234/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', text: 'Is this product in stock?' }],
        }),
      })
    )
  })

  it('sends message via form submit and clears input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ json: { text: 'Answer' } }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    await act(async () => {
      fireEvent.submit(textarea.closest('form')!)
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/ai/products/abc1234/chat',
      expect.objectContaining({ method: 'POST' })
    )
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('submits on Enter key press', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ json: { text: 'OK' } }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Question' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })
    expect(vi.mocked(fetch)).toHaveBeenCalled()
  })

  it('displays assistant response from cache (JSON)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ json: { text: 'Cached answer' } }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Is this product in stock?'))
    })
    expect(screen.getByText('Is this product in stock?')).toBeInTheDocument()
    expect(screen.getByText('Cached answer')).toBeInTheDocument()
  })

  it('shows stop button during streaming', () => {
    const neverResolve = new Promise<Response>(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(() => neverResolve)
    )

    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    act(() => {
      fireEvent.submit(textarea.closest('form')!)
    })

    expect(screen.getByLabelText('Stop generating')).toBeInTheDocument()
  })

  it('displays streamed text from a text/plain response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ stream: 'Hello from stream' }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'What is this?' } })

    await act(async () => {
      fireEvent.submit(textarea.closest('form')!)
    })

    expect(screen.getByText('Hello from stream')).toBeInTheDocument()
  })

  it('shows error state on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => makeFetchResponse({ status: 503 }))
    )
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask a question about Test Product' })
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Is this product in stock?'))
    })
    expect(
      screen.getByText('Something went wrong. Please try again.')
    ).toBeInTheDocument()
  })
})
