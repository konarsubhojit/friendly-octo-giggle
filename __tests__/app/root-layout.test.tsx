// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/font/local', () => ({
  default: vi.fn((options: { variable?: string }) => ({
    className: 'nunito',
    variable: options?.variable,
  })),
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
  it('renders Analytics and SpeedInsights', async () => {
    const { default: RootLayout } = await import('@/app/layout')
    const ui = RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { getByTestId } = render(ui)
    expect(getByTestId('analytics')).toBeTruthy()
    expect(getByTestId('speed-insights')).toBeTruthy()
  })

  it('renders the app-level providers around its children without mounting HeaderWrapper directly', async () => {
    // HeaderWrapper and the <main> landmark live in src/app/(public)/layout.tsx
    // so the /admin section can render its own chrome without the public header.
    const { default: RootLayout } = await import('@/app/layout')
    const ui = RootLayout({
      children: <span data-testid="child">content</span>,
    })
    const { container, getByTestId, queryByTestId } = render(ui)
    expect(container.querySelectorAll('main').length).toBe(0)
    expect(queryByTestId('header-wrapper')).toBeNull()
    expect(getByTestId('child')).toBeTruthy()
  })

  it('renders the skip-to-content link targeting #main-content', async () => {
    const { default: RootLayout } = await import('@/app/layout')
    const ui = RootLayout({ children: <span>content</span> })
    const { container } = render(ui)
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    expect(skipLink?.textContent).toBe('Skip to main content')
  })

  it('marks the document as English and exposes no language alternates', async () => {
    const mod = await import('@/app/layout')
    const ui = mod.default({ children: <span>content</span> })
    expect(ui.props.lang).toBe('en')
    expect(mod.metadata.alternates).toBeUndefined()
  })
})
