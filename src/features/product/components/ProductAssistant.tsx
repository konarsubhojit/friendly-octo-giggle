'use client'

import { useState, useRef, useEffect } from 'react'

interface ProductAssistantProps {
  readonly productId: string
  readonly productName: string
}

type Message = {
  readonly id: string
  readonly role: 'user' | 'assistant'
  text: string
}

type Status = 'idle' | 'streaming' | 'error'

const STARTER_PROMPTS = [
  'Is this product in stock?',
  'What variants are available?',
  'Tell me more about this product',
]

export default function ProductAssistant({
  productId,
  productName,
}: ProductAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const abortRef = useRef<AbortController | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const isStreaming = status === 'streaming'

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text: string) => {
    if (isStreaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text }
    const requestMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }))

    setMessages((prev) => [...prev, userMsg])
    setStatus('streaming')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/ai/products/${productId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        setStatus('error')
        return
      }

      const contentType = res.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { text: string }
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', text: data.text },
        ])
        setStatus('idle')
        return
      }

      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', text: '' },
      ])

      const reader = res.body?.getReader()
      if (!reader) {
        setStatus('error')
        return
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + chunk } : m
            )
          )
        }
      }

      const remaining = decoder.decode(undefined, { stream: false })
      if (remaining) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: m.text + remaining } : m
          )
        )
      }

      setStatus('idle')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('error')
      }
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    setStatus('idle')
  }

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    void sendMessage(input)
    setInput('')
  }

  const handleStarterClick = (prompt: string) => {
    void sendMessage(prompt)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6 shadow-warm backdrop-blur-lg transition-all duration-300 hover:shadow-warm-lg hover:border-[var(--accent-warm)] focus-warm text-left"
        aria-label={`Ask a question about ${productName}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)]">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <span className="block text-lg font-semibold text-[var(--foreground)]">
              Ask about this product
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Product questions answered
            </span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <section
      className="flex flex-col rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 shadow-warm backdrop-blur-lg overflow-hidden max-h-[32rem]"
      aria-label="Product assistant"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-warm)] bg-gradient-to-r from-[var(--accent-warm)]/10 to-[var(--accent-rose)]/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)]">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <span className="font-semibold text-[var(--foreground)]">
            Product Assistant
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] hover:text-[var(--foreground)] transition-colors focus-warm"
          aria-label="Close assistant"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Ask me anything about <strong>{productName}</strong>:
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleStarterClick(prompt)}
                  className="rounded-full border border-[var(--border-warm)] bg-[var(--accent-cream)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent-warm)] hover:bg-[var(--accent-blush)] focus-warm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white'
                  : 'bg-[var(--accent-cream)] text-[var(--foreground)] border border-[var(--border-warm)]'
              }`}
            >
              <span>{msg.text}</span>
            </div>
          </div>
        ))}

        {isStreaming && !messages.at(-1)?.text && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--accent-cream)] border border-[var(--border-warm)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              Generating response...
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              Something went wrong. Please try again.
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-[var(--border-warm)] px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder="Ask about this product..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[var(--border-warm)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors"
          aria-label="Type your question"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-600 focus-warm"
            aria-label="Stop generating"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white transition-all hover:shadow-warm disabled:opacity-50 disabled:cursor-not-allowed focus-warm"
            aria-label="Send message"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        )}
      </form>
    </section>
  )
}
