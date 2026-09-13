import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProvider } = vi.hoisted(() => ({
  mockGetProvider: vi.fn(),
}))

vi.mock('@/lib/providers/resolution', () => ({
  getProvider: mockGetProvider,
}))

vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => 'analytics-marker',
}))

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => 'speed-insights-marker',
}))

describe('PlatformAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when the analytics provider is not vercel', async () => {
    mockGetProvider.mockReturnValue('none')
    const { default: PlatformAnalytics } =
      await import('@/components/analytics/PlatformAnalytics')

    const result = await PlatformAnalytics()

    expect(result).toBeNull()
    expect(mockGetProvider).toHaveBeenCalledWith('analytics')
  })

  it('renders Analytics and SpeedInsights when the analytics provider is vercel', async () => {
    mockGetProvider.mockReturnValue('vercel')
    const { default: PlatformAnalytics } =
      await import('@/components/analytics/PlatformAnalytics')

    const result = await PlatformAnalytics()

    expect(result).not.toBeNull()
  })
})
