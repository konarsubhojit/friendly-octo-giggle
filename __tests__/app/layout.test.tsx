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
  Analytics: () => <div data-testid="analytics" />,
}))

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <div data-testid="speed-insights" />,
}))

describe('app/layout.tsx', () => {
  it('renders Analytics and SpeedInsights without nonce wiring', async () => {
    // The previous `x-nonce` lookup was dead code (middleware.ts does not
    // set the header). Layout now omits nonce forwarding entirely.
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })

    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { getByTestId } = render(ui)

    expect(getByTestId('analytics')).toBeTruthy()
    expect(getByTestId('speed-insights')).toBeTruthy()
  })

  it('wraps children in the main landmark', async () => {
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })
    const { default: RootLayout } = await import('@/app/layout')
    const ui = await RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { container } = render(ui)
    const mainElements = container.querySelectorAll('main')
    expect(mainElements.length).toBe(1)
    expect(mainElements[0]).toHaveAttribute('id', 'main-content')
    const child = container.querySelector("[data-testid='child']")
    expect(child?.closest('main')).toBeTruthy()
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
