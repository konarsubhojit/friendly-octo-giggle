// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('next/font/google', () => ({
  Nunito: () => ({ className: 'nunito' }),
  Playfair_Display: () => ({
    className: 'playfair',
    variable: '--font-display',
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
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

describe('app/[locale]/layout.tsx', () => {
  it('renders Analytics and SpeedInsights for a supported locale', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    const ui = await LocaleLayout({
      children: <span data-testid="child">content</span>,
      params: Promise.resolve({ locale: 'en' }),
    })
    const { getByTestId } = render(ui)
    expect(getByTestId('analytics')).toBeTruthy()
    expect(getByTestId('speed-insights')).toBeTruthy()
  })

  it('renders the locale-level providers around its children without mounting HeaderWrapper directly', async () => {
    // After the (public) route group introduction, HeaderWrapper and the
    // <main> landmark live in src/app/[locale]/(public)/layout.tsx so the
    // /admin section can render its own chrome without the public header.
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    const ui = await LocaleLayout({
      children: <span data-testid="child">content</span>,
      params: Promise.resolve({ locale: 'en' }),
    })
    const { container, getByTestId, queryByTestId } = render(ui)
    expect(container.querySelectorAll('main').length).toBe(0)
    expect(queryByTestId('header-wrapper')).toBeNull()
    expect(getByTestId('child')).toBeTruthy()
  })

  it('renders the skip-to-content link targeting #main-content', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    const ui = await LocaleLayout({
      children: <span data-testid="child">content</span>,
      params: Promise.resolve({ locale: 'en' }),
    })
    const { container } = render(ui)
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    expect(skipLink?.textContent).toBe('Skip to main content')
  })

  it('renders the skip-to-content link in Spanish for the es locale', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    const ui = await LocaleLayout({
      children: <span>content</span>,
      params: Promise.resolve({ locale: 'es' }),
    })
    const { container } = render(ui)
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink?.textContent).toBe('Saltar al contenido principal')
  })

  it('renders for the alternate supported locale without throwing', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    const ui = await LocaleLayout({
      children: <span data-testid="child">content</span>,
      params: Promise.resolve({ locale: 'es' }),
    })
    const { getByTestId } = render(ui)
    expect(getByTestId('child')).toBeTruthy()
  })

  it('calls notFound for unsupported locales', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')
    await expect(
      LocaleLayout({
        children: <span>content</span>,
        params: Promise.resolve({ locale: 'fr' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('pre-renders supported locales via generateStaticParams', async () => {
    const mod = await import('@/app/[locale]/layout')
    expect(mod.generateStaticParams()).toEqual([
      { locale: 'en' },
      { locale: 'es' },
    ])
    expect(mod.dynamicParams).toBe(false)
  })
})
