// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { InstallBanner } from '@/components/pwa/InstallBanner'

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'
const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: ua,
  })
}

function mockMatchMedia(standalone: boolean) {
  globalThis.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: standalone && query.includes('standalone'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList
  )
}

function createPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
    platforms: string[]
  }
  event.platforms = ['web']
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

describe('InstallBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    setUserAgent(ANDROID_UA)
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing initially on Android (no beforeinstallprompt yet)', () => {
    const { container } = render(<InstallBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when running in standalone display mode', () => {
    mockMatchMedia(true)
    const { container } = render(<InstallBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the iOS install hint on iOS Safari', () => {
    setUserAgent(IOS_SAFARI_UA)

    render(<InstallBanner />)

    expect(
      screen.getByRole('banner', { name: /install kiyon store app/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument()
    // iOS hint has no native install button
    expect(screen.queryByRole('button', { name: /^install$/i })).toBeNull()
  })

  it('shows an Install button when beforeinstallprompt fires', () => {
    render(<InstallBanner />)

    act(() => {
      globalThis.dispatchEvent(createPromptEvent())
    })

    expect(
      screen.getByRole('button', { name: /^install$/i })
    ).toBeInTheDocument()
  })

  it('hides the banner after the user accepts the native prompt', async () => {
    render(<InstallBanner />)

    const promptEvent = createPromptEvent('accepted')
    act(() => {
      globalThis.dispatchEvent(promptEvent)
    })

    const installButton = screen.getByRole('button', { name: /^install$/i })

    await act(async () => {
      fireEvent.click(installButton)
    })

    expect(promptEvent.prompt).toHaveBeenCalled()
    expect(
      screen.queryByRole('banner', { name: /install kiyon store app/i })
    ).toBeNull()
  })

  it('hides the banner and persists dismissal when the close button is clicked', () => {
    setUserAgent(IOS_SAFARI_UA)

    render(<InstallBanner />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(
      screen.queryByRole('banner', { name: /install kiyon store app/i })
    ).toBeNull()
    expect(localStorage.getItem('kiyon-install-banner-dismissed')).toBeTruthy()
  })

  it('does not render again while the previous dismissal is still fresh', () => {
    setUserAgent(IOS_SAFARI_UA)
    localStorage.setItem(
      'kiyon-install-banner-dismissed',
      String(Date.now())
    )

    const { container } = render(<InstallBanner />)

    expect(container.firstChild).toBeNull()
  })
})
