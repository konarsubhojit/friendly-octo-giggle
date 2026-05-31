// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeaderWrapper from '@/components/layout/HeaderWrapper'

vi.mock('@/components/layout/Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}))

describe('HeaderWrapper', () => {
  // HeaderWrapper is now a pure server component that always renders Header.
  // Admin routes intentionally live outside the `(public)` route group and
  // therefore never mount this wrapper at runtime, replacing the previous
  // client-side pathname check.
  it('renders the Header', () => {
    render(<HeaderWrapper />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })
})
