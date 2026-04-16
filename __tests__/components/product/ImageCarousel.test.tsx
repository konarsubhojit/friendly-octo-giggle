// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ImageCarousel from '@/features/product/components/ImageCarousel'

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

describe('ImageCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for empty images array', () => {
    const { container } = render(
      <ImageCarousel images={[]} productName="Test" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders single image without navigation controls', () => {
    render(<ImageCarousel images={['/img1.jpg']} productName="Product A" />)
    expect(screen.getByRole('img', { name: 'Product A' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /previous/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /next/i })
    ).not.toBeInTheDocument()
  })

  it('renders navigation buttons for multiple images', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        productName="Product B"
      />
    )
    expect(
      screen.getByRole('button', { name: /previous image/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /next image/i })
    ).toBeInTheDocument()
  })

  it('shows image counter badge', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product C"
      />
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('navigates to next image on Next click', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product D"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /next image/i }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('navigates to previous image on Prev click', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product E"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /previous image/i }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('renders dot indicators for each image', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        productName="Product F"
      />
    )
    const dots = screen.getAllByRole('tab')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('navigates to specific image via dot click', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        productName="Product G"
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /go to image 3/i }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('renders thumbnail strip for multiple images', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product H"
      />
    )
    const thumbnailButtons = screen.getAllByRole('button', {
      name: /view image/i,
    })
    expect(thumbnailButtons).toHaveLength(2)
  })

  it('auto-scrolls to next image after interval', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product I"
        autoScrollInterval={1000}
      />
    )
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('does not navigate while animation is in progress', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        productName="Product J"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /next image/i }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next image/i }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('has accessible carousel section', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product K"
      />
    )
    const section = screen.getByRole('region', {
      name: /image carousel for product k/i,
    })
    expect(section).toHaveAttribute('aria-roledescription', 'carousel')
  })
})
