'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

interface ImageCarouselProps {
  readonly images: string[]
  readonly productName: string
  readonly autoScrollInterval?: number
}

// Auto-scroll every 5 seconds by default
const DEFAULT_INTERVAL = 5000

// Derive slide-in animation class from direction + in-progress flag
const getAnimationClass = (
  direction: 'next' | 'prev',
  isAnimating: boolean
): string => {
  if (!isAnimating) return ''
  return direction === 'next'
    ? 'animate-slide-in-right'
    : 'animate-slide-in-left'
}

const ImageCarousel = ({
  images,
  productName,
  autoScrollInterval = DEFAULT_INTERVAL,
}: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const autoScrollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const total = images.length

  const goToIndex = useCallback(
    (index: number, dir: 'next' | 'prev' = 'next') => {
      if (isAnimating || index === currentIndex) return
      setDirection(dir)
      setIsAnimating(true)
      setCurrentIndex(index)
      setTimeout(() => setIsAnimating(false), 400)
    },
    [isAnimating, currentIndex]
  )

  const goNext = useCallback(() => {
    goToIndex((currentIndex + 1) % total, 'next')
  }, [currentIndex, total, goToIndex])

  const goPrev = useCallback(() => {
    goToIndex((currentIndex - 1 + total) % total, 'prev')
  }, [currentIndex, total, goToIndex])

  // Auto-scroll — always returns a cleanup so the return type is consistent
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined
    if (total > 1) {
      id = setTimeout(goNext, autoScrollInterval)
      autoScrollRef.current = id ?? null
    }
    return () => {
      if (id !== undefined) clearTimeout(id)
    }
  }, [currentIndex, goNext, autoScrollInterval, total])

  // Mouse wheel navigation
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY > 0) {
        goNext()
      } else {
        goPrev()
      }
    }

    const container = containerRef.current
    container?.addEventListener('wheel', handleWheel, { passive: false })
    return () => container?.removeEventListener('wheel', handleWheel)
  }, [goNext, goPrev])

  if (total === 0) return null

  // Single image — no carousel needed, just render image with contain
  if (total === 1) {
    return (
      <div className="relative overflow-hidden">
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-[var(--border-warm)] bg-[var(--accent-blush)]/30">
          <Image
            src={images[0]}
            alt={productName}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
            priority
          />
        </div>
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-[var(--accent-peach)] to-[var(--accent-blush)] rounded-full blur-3xl opacity-30 -z-10" />
        <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-[var(--accent-sage)] to-[var(--accent-cream)] rounded-full blur-3xl opacity-30 -z-10" />
      </div>
    )
  }

  const animationClass = getAnimationClass(direction, isAnimating)

  return (
    <div className="relative select-none overflow-hidden">
      {/* Main image container */}
      <section
        ref={containerRef}
        aria-roledescription="carousel"
        aria-label={`Image carousel for ${productName}. Use the previous and next buttons to navigate.`}
        className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-[var(--border-warm)] bg-[var(--accent-blush)]/30 group focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]"
      >
        <div className={`relative w-full h-full ${animationClass}`}>
          <Image
            src={images[currentIndex]}
            alt={`${productName} image ${currentIndex + 1} of ${total}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain transition-opacity duration-300"
            priority={currentIndex === 0}
          />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Prev button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            goPrev()
          }}
          aria-label="Previous image"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--border-warm)] shadow-warm flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--accent-peach)] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Next button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            goNext()
          }}
          aria-label="Next image"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)]/90 backdrop-blur-sm border border-[var(--border-warm)] shadow-warm flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--accent-peach)] transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Image counter badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 text-white text-xs font-semibold backdrop-blur-sm">
          {currentIndex + 1} / {total}
        </div>
      </section>

      {/* Dot indicators */}
      <div
        className="flex justify-center items-center gap-2 mt-4"
        role="tablist"
        aria-label="Image navigation"
      >
        {images.map((src, idx) => (
          <button
            key={`dot-${src}`}
            role="tab"
            aria-selected={idx === currentIndex}
            aria-label={`Go to image ${idx + 1}`}
            onClick={() => goToIndex(idx, idx > currentIndex ? 'next' : 'prev')}
            className={`rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'w-6 h-2.5 bg-[var(--accent-warm)]'
                : 'w-2.5 h-2.5 bg-[var(--accent-blush)] hover:bg-[var(--accent-peach)]'
            }`}
          />
        ))}
      </div>

      {/* Thumbnail strip (for 2+ images) */}
      {total > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((src, idx) => (
            <button
              key={`thumb-${src}`}
              onClick={() =>
                goToIndex(idx, idx > currentIndex ? 'next' : 'prev')
              }
              aria-label={`View image ${idx + 1}`}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                idx === currentIndex
                  ? 'border-[var(--accent-warm)] shadow-warm scale-105'
                  : 'border-[var(--border-warm)] opacity-60 hover:opacity-100 hover:border-[var(--accent-peach)]'
              }`}
            >
              <Image
                src={src}
                alt={`${productName} thumbnail ${idx + 1}`}
                fill
                sizes="56px"
                className="object-contain bg-[var(--accent-blush)]/30"
              />
            </button>
          ))}
        </div>
      )}

      {/* Decorative blobs */}
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-[var(--accent-peach)] to-[var(--accent-blush)] rounded-full blur-3xl opacity-30 -z-10 pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-[var(--accent-sage)] to-[var(--accent-cream)] rounded-full blur-3xl opacity-30 -z-10 pointer-events-none" />
    </div>
  )
}

export default ImageCarousel
