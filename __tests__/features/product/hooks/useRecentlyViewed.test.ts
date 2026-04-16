// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: vi.fn(),
}))

import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'
import { useLocalStorage } from '@/hooks/useLocalStorage'

describe('useRecentlyViewed', () => {
  let storedProducts: Array<{
    id: string
    name: string
    image: string
    price: number
    category: string
    viewedAt: number
  }>
  let mockSetValue: ReturnType<typeof vi.fn>

  beforeEach(() => {
    storedProducts = []
    mockSetValue = vi.fn((updater) => {
      if (typeof updater === 'function') {
        storedProducts = updater(storedProducts)
      } else {
        storedProducts = updater
      }
    })

    vi.mocked(useLocalStorage).mockImplementation(() => [
      storedProducts,
      mockSetValue as never,
    ])
  })

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useRecentlyViewed())
    expect(result.current.recentlyViewed).toEqual([])
  })

  it('tracks a new product', () => {
    const { result } = renderHook(() => useRecentlyViewed())

    act(() => {
      result.current.trackProduct({
        id: 'p1',
        name: 'Product 1',
        image: '/img/p1.jpg',
        price: 100,
        category: 'Cat',
        viewedAt: 1000,
      })
    })

    expect(mockSetValue).toHaveBeenCalled()

    const updater = mockSetValue.mock.calls[0][0]
    const updatedList = updater([])

    expect(updatedList).toHaveLength(1)
    expect(updatedList[0].id).toBe('p1')
  })

  it('moves existing product to front (deduplication)', () => {
    const { result } = renderHook(() => useRecentlyViewed())

    act(() => {
      result.current.trackProduct({
        id: 'p1',
        name: 'Product 1',
        image: '/img/p1.jpg',
        price: 100,
        category: 'Cat',
        viewedAt: 2000,
      })
    })

    const updater = mockSetValue.mock.calls[0][0]
    const existing = [
      {
        id: 'p2',
        name: 'Product 2',
        image: '/img/p2.jpg',
        price: 200,
        category: 'Cat',
        viewedAt: 500,
      },
      {
        id: 'p1',
        name: 'Product 1 Old',
        image: '/img/p1.jpg',
        price: 100,
        category: 'Cat',
        viewedAt: 100,
      },
    ]

    const updatedList = updater(existing)

    expect(updatedList).toHaveLength(2)
    expect(updatedList[0].id).toBe('p1')
    expect(updatedList[1].id).toBe('p2')
  })

  it('limits to 12 items', () => {
    const { result } = renderHook(() => useRecentlyViewed())

    act(() => {
      result.current.trackProduct({
        id: 'new',
        name: 'New',
        image: '/img/new.jpg',
        price: 100,
        category: 'Cat',
        viewedAt: 1000,
      })
    })

    const updater = mockSetValue.mock.calls[0][0]
    const existingItems = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      name: `Product ${i}`,
      image: `/img/p${i}.jpg`,
      price: 100,
      category: 'Cat',
      viewedAt: i,
    }))

    const updatedList = updater(existingItems)
    expect(updatedList).toHaveLength(12)
    expect(updatedList[0].id).toBe('new')
  })

  it('clearHistory sets empty array', () => {
    const { result } = renderHook(() => useRecentlyViewed())

    act(() => {
      result.current.clearHistory()
    })

    expect(mockSetValue).toHaveBeenCalledWith([])
  })
})
