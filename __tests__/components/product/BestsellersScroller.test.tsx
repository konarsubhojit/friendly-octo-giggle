import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BestsellersScroller } from '@/features/product/components/BestsellersScroller'

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockBestsellers = [
  { id: 'prod1', name: 'Rose Gift Box', image: '/img1.jpg', price: 25 },
  { id: 'prod2', name: 'Lily Vase', image: '/img2.jpg', price: 35 },
  { id: 'prod3', name: 'Tulip Candle', image: '/img3.jpg', price: 15 },
]

describe('BestsellersScroller', () => {
  it('renders empty message when no bestsellers', () => {
    render(<BestsellersScroller bestsellers={[]} />)
    expect(screen.getByText('No bestseller data yet.')).toBeInTheDocument()
  })

  it('renders all bestseller items', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    expect(screen.getByText('Rose Gift Box')).toBeInTheDocument()
    expect(screen.getByText('Lily Vase')).toBeInTheDocument()
    expect(screen.getByText('Tulip Candle')).toBeInTheDocument()
  })

  it('renders rank badges', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('links to product pages', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/products/prod1')
    expect(links[1]).toHaveAttribute('href', '/products/prod2')
  })

  it('renders scroll buttons', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    expect(
      screen.getByRole('button', { name: /scroll bestsellers left/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /scroll bestsellers right/i })
    ).toBeInTheDocument()
  })

  it('calls scrollBy when scroll buttons are clicked', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)

    const scrollByMock = vi.fn()
    const list = screen.getByRole('list', {
      name: /bestsellers horizontal list/i,
    })
    list.scrollBy = scrollByMock

    fireEvent.click(
      screen.getByRole('button', { name: /scroll bestsellers right/i })
    )
    expect(scrollByMock).toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: /scroll bestsellers left/i })
    )
    expect(scrollByMock).toHaveBeenCalledTimes(2)
  })

  it('renders product images', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    expect(screen.getByRole('img', { name: 'Rose Gift Box' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lily Vase' })).toBeInTheDocument()
  })

  it('has accessible list markup', () => {
    render(<BestsellersScroller bestsellers={mockBestsellers} />)
    expect(
      screen.getByRole('list', { name: /bestsellers horizontal list/i })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
