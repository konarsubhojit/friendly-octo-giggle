"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductGridItem } from "@/components/sections/ProductGrid";

interface BestsellersScrollerProps {
  readonly bestsellers: ProductGridItem[];
}

export function BestsellersScroller({ bestsellers }: BestsellersScrollerProps) {
  const scrollRef = useRef<HTMLUListElement>(null);

  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.querySelector("a")?.offsetWidth ?? 220;
    const gap = 16;
    container.scrollBy({
      left: direction === "right" ? cardWidth + gap : -(cardWidth + gap),
      behavior: "smooth",
    });
  }, []);

  if (bestsellers.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No bestseller data yet.
      </p>
    );
  }

  return (
    <div className="relative group/scroller">
      {/* Left arrow */}
      <button
        type="button"
        aria-label="Scroll bestsellers left"
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border-warm)] shadow-warm text-[var(--foreground)] opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200 hover:bg-[var(--accent-blush)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-rose)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Scroll container */}
      <ul
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth scrollbar-hide list-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-label="Bestsellers horizontal list"
      >
        {bestsellers.map((product, index) => (
          <li key={product.id} className="snap-start flex-none w-48 sm:w-52">
            <Link
              href={`/products/${product.id}`}
              aria-label={`View bestseller ${product.name}`}
              className="group block rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm hover:shadow-warm-lg transition-all duration-300 overflow-hidden"
            >
            <div className="relative aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 192px, 208px"
                priority={index < 3}
              />
              <span className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--btn-primary)] text-white text-xs font-bold">
                {index + 1}
              </span>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent-rose)] transition-colors duration-200">
                {product.name}
              </h3>
            </div>
          </Link>
          </li>
        ))}
      </ul>

      {/* Right arrow */}
      <button
        type="button"
        aria-label="Scroll bestsellers right"
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border-warm)] shadow-warm text-[var(--foreground)] opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200 hover:bg-[var(--accent-blush)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-rose)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
