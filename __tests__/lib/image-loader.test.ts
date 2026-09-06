import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_QUALITY,
  MAX_QUALITY,
  MAX_WIDTH,
  MIN_QUALITY,
  MIN_WIDTH,
  clampQuality,
  clampWidth,
  imageLoader,
} from '@/lib/image-loader'

const ORIGINAL_WORKER_URL = process.env.NEXT_PUBLIC_IMAGE_WORKER_URL

afterEach(() => {
  if (ORIGINAL_WORKER_URL === undefined) {
    delete process.env.NEXT_PUBLIC_IMAGE_WORKER_URL
  } else {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = ORIGINAL_WORKER_URL
  }
})

describe('clampWidth', () => {
  it('passes through an in-range width unchanged', () => {
    expect(clampWidth(800)).toBe(800)
  })

  it('clamps a width below the minimum up to MIN_WIDTH', () => {
    expect(clampWidth(1)).toBe(MIN_WIDTH)
  })

  it('clamps a width above the maximum down to MAX_WIDTH', () => {
    expect(clampWidth(100000)).toBe(MAX_WIDTH)
  })

  it('clamps a negative width up to MIN_WIDTH', () => {
    expect(clampWidth(-50)).toBe(MIN_WIDTH)
  })

  it('rounds a fractional width', () => {
    expect(clampWidth(800.6)).toBe(801)
  })
})

describe('clampQuality', () => {
  it('passes through an in-range quality unchanged', () => {
    expect(clampQuality(80)).toBe(80)
  })

  it('clamps a quality below the minimum up to MIN_QUALITY', () => {
    expect(clampQuality(0)).toBe(MIN_QUALITY)
  })

  it('clamps a quality above the maximum down to MAX_QUALITY', () => {
    expect(clampQuality(150)).toBe(MAX_QUALITY)
  })

  it('clamps a negative quality up to MIN_QUALITY', () => {
    expect(clampQuality(-10)).toBe(MIN_QUALITY)
  })
})

describe('imageLoader', () => {
  it('returns the source unchanged when no Worker URL is configured', () => {
    delete process.env.NEXT_PUBLIC_IMAGE_WORKER_URL
    const src = 'https://images.unsplash.com/photo.jpg'
    expect(imageLoader({ src, width: 800 })).toBe(src)
  })

  it('builds a Worker URL with clamped width and default quality', () => {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = 'https://images.example.com'
    const src = 'https://images.unsplash.com/photo.jpg'

    const result = imageLoader({ src, width: 800 })
    const url = new URL(result)

    expect(url.origin).toBe('https://images.example.com')
    expect(url.searchParams.get('url')).toBe(src)
    expect(url.searchParams.get('w')).toBe('800')
    expect(url.searchParams.get('q')).toBe(String(DEFAULT_QUALITY))
  })

  it('clamps an out-of-range width before building the Worker URL', () => {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = 'https://images.example.com'
    const result = imageLoader({
      src: 'https://images.unsplash.com/photo.jpg',
      width: 999999,
    })
    expect(new URL(result).searchParams.get('w')).toBe(String(MAX_WIDTH))
  })

  it('clamps an out-of-range quality before building the Worker URL', () => {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = 'https://images.example.com'
    const result = imageLoader({
      src: 'https://images.unsplash.com/photo.jpg',
      width: 400,
      quality: 500,
    })
    expect(new URL(result).searchParams.get('q')).toBe(String(MAX_QUALITY))
  })

  it('strips a trailing slash from the configured Worker base URL', () => {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = 'https://images.example.com/'
    const result = imageLoader({
      src: 'https://images.unsplash.com/photo.jpg',
      width: 400,
    })
    expect(result.startsWith('https://images.example.com/?')).toBe(true)
  })

  it('treats a blank Worker URL the same as unconfigured', () => {
    process.env.NEXT_PUBLIC_IMAGE_WORKER_URL = '   '
    const src = 'https://images.unsplash.com/photo.jpg'
    expect(imageLoader({ src, width: 400 })).toBe(src)
  })
})
