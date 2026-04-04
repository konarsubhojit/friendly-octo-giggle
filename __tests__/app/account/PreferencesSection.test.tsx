import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PreferencesSection } from '@/app/account/PreferencesSection'

const mockSetCurrency = vi.hoisted(() => vi.fn())

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    currency: 'INR',
    setCurrency: mockSetCurrency,
  }),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector" />,
}))

const mockProfile = {
  id: 'usr1234',
  name: 'Alice',
  email: 'alice@test.com',
  phoneNumber: null,
  image: null,
  role: 'USER',
  hasPassword: true,
  currencyPreference: 'USD',
  createdAt: '2025-01-01T00:00:00.000Z',
}

describe('PreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders preferences heading', () => {
    render(<PreferencesSection profile={null} />)
    expect(screen.getByText('Preferences')).toBeInTheDocument()
  })

  it('renders theme selector', () => {
    render(<PreferencesSection profile={null} />)
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument()
  })

  it('renders currency select with all four options', () => {
    render(<PreferencesSection profile={null} />)
    const select = screen.getByRole('combobox', { name: /select currency/i })
    expect(select).toBeInTheDocument()
    expect(screen.getByText('INR')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText('GBP')).toBeInTheDocument()
  })

  it('syncs currency from profile preference on mount', () => {
    render(<PreferencesSection profile={mockProfile} />)
    expect(mockSetCurrency).toHaveBeenCalledWith('USD')
  })

  it('does not sync currency when profile is null', () => {
    render(<PreferencesSection profile={null} />)
    expect(mockSetCurrency).not.toHaveBeenCalled()
  })

  it('calls setCurrency and fetch when currency select changes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<PreferencesSection profile={null} />)
    const select = screen.getByRole('combobox', { name: /select currency/i })
    fireEvent.change(select, { target: { value: 'EUR' } })

    expect(mockSetCurrency).toHaveBeenCalledWith('EUR')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/account',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })
  })
})
