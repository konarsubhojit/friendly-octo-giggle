'use client'

import { Fragment, type JSX } from 'react'

interface AssistantMarkdownProps {
  readonly text: string
}

const renderInline = (line: string, keyPrefix: string): JSX.Element[] => {
  const parts: JSX.Element[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null = pattern.exec(line)
  let i = 0
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Fragment key={`${keyPrefix}-t${i}`}>
          {line.slice(lastIndex, match.index)}
        </Fragment>
      )
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] font-mono"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(
        <em key={`${keyPrefix}-i${i}`} className="italic">
          {token.slice(1, -1)}
        </em>
      )
    }
    lastIndex = match.index + token.length
    i += 1
    match = pattern.exec(line)
  }
  if (lastIndex < line.length) {
    parts.push(
      <Fragment key={`${keyPrefix}-tend`}>{line.slice(lastIndex)}</Fragment>
    )
  }
  return parts
}

export const AssistantMarkdown = ({ text }: AssistantMarkdownProps) => {
  const lines = text.split('\n')
  const blocks: JSX.Element[] = []
  let listItems: string[] = []
  let blockIdx = 0

  const flushList = () => {
    if (listItems.length === 0) return
    const items = listItems
    listItems = []
    blocks.push(
      <ul
        key={`ul-${blockIdx++}`}
        className="my-1 list-disc space-y-1 pl-5 marker:text-[var(--accent-warm)]"
      >
        {items.map((item, idx) => (
          <li key={`li-${blockIdx}-${idx}`}>
            {renderInline(item, `li-${blockIdx}-${idx}`)}
          </li>
        ))}
      </ul>
    )
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }
    const bulletMatch = /^[*\-•]\s+(.*)$/.exec(line)
    if (bulletMatch) {
      listItems.push(bulletMatch[1])
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${blockIdx}`} className="my-1 first:mt-0 last:mb-0">
        {renderInline(line, `p-${blockIdx}`)}
      </p>
    )
    blockIdx += 1
  }
  flushList()

  return <div className="space-y-1">{blocks}</div>
}
