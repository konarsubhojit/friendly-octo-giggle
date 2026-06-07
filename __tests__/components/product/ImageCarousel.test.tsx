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

  it('tracks swipe gestures across multiple touchmove events', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product Swipe"
      />
    )

    const section = screen.getByRole('region', {
      name: /image carousel for product swipe/i,
    })

    fireEvent.touchStart(section, {
      touches: [{ clientX: 220, clientY: 100 }],
    })

    fireEvent.touchMove(section, {
      touches: [{ clientX: 150, clientY: 105 }],
    })
    fireEvent.touchMove(section, {
      touches: [{ clientX: 110, clientY: 108 }],
    })
    fireEvent.touchEnd(section, {
      changedTouches: [{ clientX: 110, clientY: 108 }],
    })

    expect(
      screen.getByRole('img', { name: /product swipe image 2 of 2/i })
    ).toBeInTheDocument()
  })

  it('does not navigate on swipe end while zoomed', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Product Zoom"
      />
    )

    const section = screen.getByRole('region', {
      name: /image carousel for product zoom/i,
    })

    fireEvent.touchStart(section, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 140, clientY: 100 },
      ],
    })
    fireEvent.touchMove(section, {
      touches: [
        { clientX: 80, clientY: 100 },
        { clientX: 180, clientY: 100 },
      ],
    })
    fireEvent.touchStart(section, {
      touches: [{ clientX: 220, clientY: 100 }],
    })
    fireEvent.touchEnd(section, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    })

    expect(
      screen.getByRole('img', { name: /product zoom image 1 of 2/i })
    ).toBeInTheDocument()
  })

  it('supports pinch-to-zoom in the single-image layout', () => {
    render(<ImageCarousel images={['/img1.jpg']} productName="Solo Product" />)

    const image = screen.getByLabelText(/tap to zoom in/i)

    fireEvent.touchStart(image, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 140, clientY: 100 },
      ],
    })

    fireEvent.touchMove(image, {
      touches: [
        { clientX: 80, clientY: 100 },
        { clientX: 180, clientY: 100 },
      ],
    })
    expect(screen.getByLabelText(/tap to zoom out/i)).toBeInTheDocument()
  })

  it('supports Arrow key navigation on carousel region', () => {
    render(
      <ImageCarousel
        images={['/img1.jpg', '/img2.jpg']}
        productName="Keyboard Product"
      />
    )

    const region = screen.getByRole('region', {
      name: /image carousel for keyboard product/i,
    })

    // Keyboard handlers are attached natively to the carousel container so the
    // <section> can stay semantically non-interactive. fireEvent.keyDown bubbles
    // up through React, but the native listener responds to the same event.
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(450)
    })

    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
