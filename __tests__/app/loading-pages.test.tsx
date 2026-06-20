// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/skeletons/HeaderSkeleton', () => ({
  default: () => <div data-testid="header-skeleton">HeaderSkeleton</div>,
}))
vi.mock('@/components/skeletons/HeroSkeleton', () => ({
  default: () => <div data-testid="hero-skeleton">HeroSkeleton</div>,
}))
vi.mock('@/components/skeletons/ProductCardSkeleton', () => ({
  default: () => (
    <div data-testid="product-card-skeleton">ProductCardSkeleton</div>
  ),
}))

describe('app/loading.tsx – Root Loading', () => {
  it('renders without crashing', async () => {
    const { default: Loading } = await import('@/app/[locale]/(public)/loading')
    const { container } = render(<Loading />)
    expect(container).toBeTruthy()
  })

  it('renders HeroSkeleton only (no product card skeletons)', async () => {
    const { default: Loading } = await import('@/app/[locale]/(public)/loading')
    render(<Loading />)
    expect(screen.getByTestId('hero-skeleton')).toBeInTheDocument()
    expect(screen.queryAllByTestId('product-card-skeleton')).toHaveLength(0)
  })

  it('does not render a footer skeleton', async () => {
    const { default: Loading } = await import('@/app/[locale]/(public)/loading')
    const { container } = render(<Loading />)
    expect(container.querySelector('footer')).toBeNull()
  })
})

describe('app/products/loading.tsx – Products Loading', () => {
  it('renders without crashing', async () => {
    const { default: ProductsLoading } =
      await import('@/app/[locale]/(public)/products/loading')
    const { container } = render(<ProductsLoading />)
    expect(container).toBeTruthy()
  })

  it('renders 9 ProductCardSkeletons', async () => {
    const { default: ProductsLoading } =
      await import('@/app/[locale]/(public)/products/loading')
    render(<ProductsLoading />)
    expect(screen.getAllByTestId('product-card-skeleton')).toHaveLength(9)
  })

  it('renders a pagination skeleton', async () => {
    const { default: ProductsLoading } =
      await import('@/app/[locale]/(public)/products/loading')
    const { container } = render(<ProductsLoading />)
    const paginationButtons = container.querySelectorAll('.h-10.w-10')
    expect(paginationButtons.length).toBeGreaterThanOrEqual(5)
  })

  it('contains animate-pulse elements', async () => {
    const { default: ProductsLoading } =
      await import('@/app/[locale]/(public)/products/loading')
    const { container } = render(<ProductsLoading />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })
})

describe('app/products/[id]/loading.tsx – Product Detail Loading', () => {
  it('renders without crashing', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    expect(container).toBeTruthy()
  })

  it('renders an image area skeleton', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    const imageArea = container.querySelector('.shadow-warm-lg')
    expect(imageArea).toBeInTheDocument()
  })

  it('renders 4 variant skeletons', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    const variantSkeletons = container.querySelectorAll('.h-10.w-20')
    expect(variantSkeletons).toHaveLength(4)
  })

  it('renders additional info card skeleton', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    const infoIcons = container.querySelectorAll('.rounded-full.animate-pulse')
    expect(infoIcons.length).toBeGreaterThanOrEqual(3)
  })

  it('contains animate-pulse elements', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })
})

describe('app/wishlist/loading.tsx – Wishlist Loading', () => {
  it('renders without crashing', async () => {
    const { default: WishlistLoading } =
      await import('@/app/[locale]/(public)/wishlist/loading')
    const { container } = render(<WishlistLoading />)
    expect(container).toBeTruthy()
  })

  it('uses pt-8 spacing (not pt-28)', async () => {
    const { default: WishlistLoading } =
      await import('@/app/[locale]/(public)/wishlist/loading')
    const { container } = render(<WishlistLoading />)
    const main = container.querySelector('main')
    expect(main?.className).toContain('pt-8')
    expect(main?.className).not.toContain('pt-28')
  })

  it('contains animate-pulse elements', async () => {
    const { default: WishlistLoading } =
      await import('@/app/[locale]/(public)/wishlist/loading')
    const { container } = render(<WishlistLoading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0
    )
  })
})

describe('app/shop/loading.tsx – Shop Loading', () => {
  it('renders without crashing', async () => {
    const { default: ShopLoading } =
      await import('@/app/[locale]/(public)/shop/loading')
    const { container } = render(<ShopLoading />)
    expect(container).toBeTruthy()
  })

  it('uses pt-8 spacing (not pt-28)', async () => {
    const { default: ShopLoading } =
      await import('@/app/[locale]/(public)/shop/loading')
    const { container } = render(<ShopLoading />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('pt-8')
    expect(section?.className).not.toContain('pt-28')
  })

  it('contains animate-pulse elements', async () => {
    const { default: ShopLoading } =
      await import('@/app/[locale]/(public)/shop/loading')
    const { container } = render(<ShopLoading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0
    )
  })
})

describe('Spacing consistency – pt-8 on all loading skeletons', () => {
  it('products loading uses pt-8', async () => {
    const { default: ProductsLoading } =
      await import('@/app/[locale]/(public)/products/loading')
    const { container } = render(<ProductsLoading />)
    const main = container.querySelector('main')
    expect(main?.className).toContain('pt-8')
    expect(main?.className).not.toContain('pt-28')
  })

  it('product detail loading uses pt-8', async () => {
    const { default: ProductDetailLoading } =
      await import('@/app/[locale]/(public)/products/[id]/loading')
    const { container } = render(<ProductDetailLoading />)
    const main = container.querySelector('main')
    expect(main?.className).toContain('pt-8')
    expect(main?.className).not.toContain('pt-28')
  })
})
