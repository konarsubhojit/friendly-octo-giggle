import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProductAssistant from '@/features/product/components/ProductAssistant'

const mockSendMessage = vi.fn()
const mockStop = vi.fn()

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: 'ready',
    stop: mockStop,
  })),
}))

vi.mock('ai', () => ({
  DefaultChatTransport: class MockTransport {
    api: string
    constructor(opts: { api: string }) {
      this.api = opts.api
    }
  },
}))

describe('ProductAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByText('Product Assistant')).toBeTruthy()
  })

  it('renders starter prompts when expanded', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByText('Is this product in stock?')).toBeTruthy()
    expect(screen.getByText('What variations are available?')).toBeTruthy()
    expect(screen.getByText('Tell me more about this product')).toBeTruthy()
  })

  it('calls sendMessage when a starter prompt is clicked', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    fireEvent.click(screen.getByText('Is this product in stock?'))
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: 'Is this product in stock?',
    })
  })

  it('has a textarea for typing questions', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByLabelText('Type your question')).toBeTruthy()
  })

  it('can close the assistant', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByText('Product Assistant')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close assistant'))
    expect(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    ).toBeTruthy()
  })

  it('sends message via form submit and clears input', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.submit(textarea.closest('form')!)
    expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Hello' })
  })

  it('does not send empty messages', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.submit(textarea.closest('form')!)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('submits on Enter key press', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Question' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(mockSendMessage).toHaveBeenCalledWith({ text: 'Question' })
  })

  it('does not submit on Shift+Enter', () => {
    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    const textarea = screen.getByLabelText('Type your question')
    fireEvent.change(textarea, { target: { value: 'Question' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('renders user and assistant messages', async () => {
    const { useChat } = await import('@ai-sdk/react')
    vi.mocked(useChat).mockReturnValue({
      messages: [
        {
          id: 'msg1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: 'msg2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
        },
      ],
      sendMessage: mockSendMessage,
      status: 'ready',
      stop: mockStop,
    } as unknown as ReturnType<typeof useChat>)

    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
    expect(
      screen.queryByText('Is this product in stock?')
    ).not.toBeInTheDocument()
  })

  it('shows streaming indicator when status is streaming', async () => {
    const { useChat } = await import('@ai-sdk/react')
    vi.mocked(useChat).mockReturnValue({
      messages: [
        {
          id: 'msg1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ],
      sendMessage: mockSendMessage,
      status: 'streaming',
      stop: mockStop,
    } as unknown as ReturnType<typeof useChat>)

    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    expect(screen.getByText('Generating response...')).toBeInTheDocument()
  })

  it('shows stop button during streaming', async () => {
    const { useChat } = await import('@ai-sdk/react')
    vi.mocked(useChat).mockReturnValue({
      messages: [
        {
          id: 'msg1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ],
      sendMessage: mockSendMessage,
      status: 'streaming',
      stop: mockStop,
    } as unknown as ReturnType<typeof useChat>)

    render(<ProductAssistant productId="abc1234" productName="Test Product" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ask a question about Test Product',
      })
    )
    const stopBtn = screen.getByLabelText('Stop generating')
    fireEvent.click(stopBtn)
    expect(mockStop).toHaveBeenCalled()
  })
})
