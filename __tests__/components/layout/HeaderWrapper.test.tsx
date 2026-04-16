// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeaderWrapper from '@/components/layout/HeaderWrapper'

const mockUsePathname = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock('@/components/layout/Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}))

describe('HeaderWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when pathname starts with /admin', () => {
    mockUsePathname.mockReturnValue('/admin')
    const { container } = render(<HeaderWrapper />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('header')).toBeNull()
  })

  it('renders null for nested admin paths like /admin/products', () => {
    mockUsePathname.mockReturnValue('/admin/products')
    const { container } = render(<HeaderWrapper />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('header')).toBeNull()
  })

  it('renders Header when pathname is /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<HeaderWrapper />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders Header when pathname is /products', () => {
    mockUsePathname.mockReturnValue('/products')
    render(<HeaderWrapper />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders Header when pathname is /cart', () => {
    mockUsePathname.mockReturnValue('/cart')
    render(<HeaderWrapper />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })
})
