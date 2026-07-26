// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import HeaderSkeleton from '@/components/skeletons/HeaderSkeleton'
import HeroSkeleton from '@/components/skeletons/HeroSkeleton'
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton'
import BestsellerCardSkeleton from '@/components/skeletons/BestsellerCardSkeleton'

describe('HeaderSkeleton', () => {
  it('renders a header element', () => {
    const { container } = render(<HeaderSkeleton />)
    expect(container.querySelector('header')).toBeTruthy()
  })

  it('has animate-pulse elements', () => {
    const { container } = render(<HeaderSkeleton />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0
    )
  })
})

describe('HeroSkeleton', () => {
  it('renders a section element', () => {
    const { container } = render(<HeroSkeleton />)
    expect(container.querySelector('section')).toBeTruthy()
  })

  it('has multiple animate-pulse elements', () => {
    const { container } = render(<HeroSkeleton />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      1
    )
  })
})

describe('ProductCardSkeleton', () => {
  it('renders the skeleton container', () => {
    const { container } = render(<ProductCardSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it('has animate-pulse elements for loading state', () => {
    const { container } = render(<ProductCardSkeleton />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0
    )
  })

  it('renders image placeholder area', () => {
    const { container } = render(<ProductCardSkeleton />)
    const imageArea = container.querySelector('.h-64')
    expect(imageArea).toBeTruthy()
  })
})

describe('BestsellerCardSkeleton', () => {
  it('matches the bestseller tile track width so tiles do not resize on load', () => {
    const { container } = render(<BestsellerCardSkeleton />)
    const track = container.firstElementChild
    expect(track?.className).toContain('w-48')
    expect(track?.className).toContain('sm:w-52')
    expect(track?.className).toContain('flex-none')
  })

  it('reserves a square media box to avoid layout shift', () => {
    const { container } = render(<BestsellerCardSkeleton />)
    expect(container.querySelector('.aspect-square')).toBeTruthy()
  })

  it('stretches to the row height', () => {
    const { container } = render(<BestsellerCardSkeleton />)
    expect(container.querySelector('.h-full')).toBeTruthy()
  })
})
