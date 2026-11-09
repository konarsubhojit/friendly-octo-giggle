'use client'

import { useEffect, useRef, useState } from 'react'
import { AssistantMarkdown } from '@/features/ai/components/AssistantMarkdown'

type Message = {
  readonly id: string
  readonly role: 'user' | 'assistant'
  text: string
}

type Status = 'idle' | 'streaming' | 'error'

const STARTER_PROMPTS = [
  'I need a gift under ₹2,000',
  'Show me a waterproof bag',
  'Compare your best tote bags',
]

export default function StorefrontAssistant() {
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

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
    }
    const requestMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      text: message.text,
    }))

    setMessages((prev) => [...prev, userMessage])
    setStatus('streaming')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/ai/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        setStatus('error')
        return
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as { text: string }
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

      const reader = response.body?.getReader()
      if (!reader) {
        setStatus('error')
        return
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, text: message.text + chunk }
              : message
          )
        )
      }

      const remaining = decoder.decode(undefined, { stream: false })
      if (remaining) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, text: message.text + remaining }
              : message
          )
        )
      }

      setStatus('idle')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('error')
      }
    }
  }

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (!input.trim()) return
    void sendMessage(input)
    setInput('')
  }

  const stop = () => {
    abortRef.current?.abort()
    setStatus('idle')
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[120] flex items-center gap-3 rounded-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] px-4 py-3 text-sm font-semibold text-white shadow-warm-lg transition-transform hover:scale-[1.02] focus-warm"
        aria-label="Open storefront assistant"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
        >
          ✨
        </span>
        Ask the store
      </button>
    )
  }

  return (
    <section
      aria-label="Storefront assistant"
      className="fixed bottom-4 right-4 z-[120] flex h-[min(42rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm-lg"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-warm)] bg-gradient-to-r from-[var(--accent-warm)]/10 to-[var(--accent-rose)]/10 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Storefront Assistant
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Find products, compare options, and ask order questions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-blush)] hover:text-[var(--foreground)] focus-warm"
          aria-label="Close storefront assistant"
        >
          ✕
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Ask for product ideas, comparisons, or help with your own orders.
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-[var(--border-warm)] bg-[var(--accent-cream)] px-3 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:border-[var(--accent-warm)] hover:bg-[var(--accent-blush)] focus-warm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white'
                  : 'border border-[var(--border-warm)] bg-[var(--accent-cream)] text-[var(--foreground)]'
              }`}
            >
              {message.role === 'assistant' ? (
                <AssistantMarkdown text={message.text} />
              ) : (
                <span>{message.text}</span>
              )}
            </div>
          </div>
        ))}

        {isStreaming && !messages.at(-1)?.text ? (
          <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--accent-cream)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            Generating response...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            Something went wrong. Please try again.
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-[var(--border-warm)] px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSubmit(event)
            }
          }}
          rows={1}
          placeholder="Ask the storefront assistant..."
          className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]"
          aria-label="Ask the storefront assistant"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500 text-white transition-colors hover:bg-red-600 focus-warm"
            aria-label="Stop generating"
          >
            ■
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white transition-all hover:shadow-warm disabled:cursor-not-allowed disabled:opacity-50 focus-warm"
            aria-label="Send message"
          >
            →
          </button>
        )}
      </form>
    </section>
  )
}
