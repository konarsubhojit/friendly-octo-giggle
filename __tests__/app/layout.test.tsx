// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Hoisted so mockHeaders exists before dynamic import('@/app/layout').
const mockHeaders = vi.hoisted(() => vi.fn())

vi.mock('next/font/google', () => ({
  Nunito: () => ({ className: 'nunito' }),
  Playfair_Display: () => ({
    className: 'playfair',
    variable: '--font-display',
  }),
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@/components/layout/HeaderWrapper', () => ({
  default: () => <div data-testid="header-wrapper" />,
}))

vi.mock('@/components/providers/StoreProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}))

vi.mock('@vercel/analytics/next', () => ({
  Analytics: ({ nonce }: { nonce?: string }) => (
    <div data-testid="analytics" data-nonce={nonce} />
  ),
}))

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: ({ nonce }: { nonce?: string }) => (
    <div data-testid="speed-insights" data-nonce={nonce} />
  ),
}))

describe('app/layout.tsx', () => {
  it('passes request nonce to Analytics and SpeedInsights', async () => {
    mockHeaders.mockResolvedValue({
      get: vi.fn((header: string) =>
        header === 'x-nonce' ? 'test-layout-nonce' : null
      ),
    })

    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { getByTestId } = render(ui)

    expect(getByTestId('analytics').getAttribute('data-nonce')).toBe(
      'test-layout-nonce'
    )
    expect(getByTestId('speed-insights').getAttribute('data-nonce')).toBe(
      'test-layout-nonce'
    )
  })

  it('wraps children in a div, not a main element', async () => {
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })
    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { container } = render(ui)
    const mainElements = container.querySelectorAll('main')
    expect(mainElements.length).toBe(0)
    const child = container.querySelector("[data-testid='child']")
    expect(child?.closest('div')).toBeTruthy()
  })

  it('renders HeaderWrapper', async () => {
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })
    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({ children: <span>content</span> })
    const { getByTestId } = render(ui)
    expect(getByTestId('header-wrapper')).toBeTruthy()
  })

  it('renders children', async () => {
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })
    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { getByTestId } = render(ui)
    expect(getByTestId('child')).toBeTruthy()
  })
})
